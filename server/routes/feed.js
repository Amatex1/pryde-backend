/**
 * PHASE 2: Feed Routes - Global and Following Feeds
 *
 * Implements slow, chronological feeds with no algorithmic ranking.
 * Only time-based sorting with optional manual promotion.
 *
 * PHASE 2 SAFETY: All routes use guard clauses and optional chaining
 */

import express from 'express';
import Post from '../models/Post.js';
import auth from '../middleware/auth.js';
import requireActiveUser from '../middleware/requireActiveUser.js';
import { getBlockedUserIds } from '../utils/blockHelper.js';
import { asyncHandler, requireAuth, sendError, HttpStatus } from '../utils/errorHandler.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/feed
 * Root feed endpoint - defaults to global feed
 * Supports page/limit params for backward compatibility
 */
router.get('/', auth, requireActiveUser, asyncHandler(async (req, res) => {
  // SAFETY: Guard clause for auth
  const currentUserId = requireAuth(req, res);
  if (!currentUserId) return;

  const { page = 1, limit = 20, tag } = req.query;

  // SAFETY: Validate pagination params
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

  // Get blocked user IDs to filter them out
  const blockedUserIds = await getBlockedUserIds(currentUserId);

  // Build query
  const query = {
    visibility: 'public',
    author: { $nin: blockedUserIds }, // Exclude blocked users
    tagOnly: { $ne: true } // Exclude tag-only posts from main feed
  };

  // Tag filter (for Phase 4 - Community Tags)
  if (tag) {
    query.hashtags = tag.toLowerCase();
  }

  // Calculate skip for pagination
  const skip = (pageNum - 1) * limitNum;

  // Fetch posts
  const posts = await Post.find(query)
    .populate('author', 'username displayName profilePhoto isVerified')
    .populate({
      path: 'originalPost',
      select: 'content media author createdAt',
      populate: {
        path: 'author',
        select: 'username displayName profilePhoto isVerified'
      }
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum)
    .lean();

  // Apply post sanitization (hide likes, etc.)
  const sanitizedPosts = posts.map(post => sanitizePostForPrivateLikes(post, currentUserId));

  res.json({ posts: sanitizedPosts });
}));

/**
 * GET /api/feed/global
 * Returns public posts in reverse chronological order
 * Optional slow weighting for promoted posts
 */
router.get('/global', auth, requireActiveUser, asyncHandler(async (req, res) => {
  // SAFETY: Guard clause for auth
  const currentUserId = requireAuth(req, res);
  if (!currentUserId) return;

  const { before, limit = 20, tag } = req.query;

  // SAFETY: Validate limit param
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

  // Get blocked user IDs to filter them out
  const blockedUserIds = await getBlockedUserIds(currentUserId);

  // Build query
  const query = {
    visibility: 'public',
    author: { $nin: blockedUserIds }, // Exclude blocked users
    tagOnly: { $ne: true } // Exclude tag-only posts from main feed
  };

  // Pagination: posts before a certain timestamp
  if (before) {
    const beforeDate = new Date(before);
    // SAFETY: Validate date
    if (!isNaN(beforeDate.getTime())) {
      query.createdAt = { $lt: beforeDate };
    }
  }

  // Tag filter (for Phase 4 - Community Tags)
  if (tag) {
    query.hashtags = tag.toLowerCase();
  }

  // Fetch posts with slow weighting
  const posts = await Post.find(query)
    .populate('author', 'username displayName profilePhoto isVerified')
    .populate({
      path: 'originalPost',
      select: 'content media author createdAt',
      populate: {
        path: 'author',
        select: 'username displayName profilePhoto isVerified'
      }
    })
    .sort({ createdAt: -1 })
    .limit(limitNum)
    .lean();

  // Apply post sanitization (hide likes, etc.)
  const sanitizedPosts = posts.map(post => sanitizePostForPrivateLikes(post, currentUserId));

  res.json(sanitizedPosts);
}));

/**
 * GET /api/feed/following
 * Returns posts only from users the current user follows
 * Same slow sorting logic as global feed
 */
router.get('/following', auth, requireActiveUser, asyncHandler(async (req, res) => {
  // SAFETY: Guard clause for auth
  const currentUserId = requireAuth(req, res);
  if (!currentUserId) return;

  const { before, limit = 20, tag } = req.query;

  // SAFETY: Validate limit param
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

  // Get user's following list
  const User = (await import('../models/User.js')).default;
  const currentUser = await User.findById(currentUserId).select('following');

  if (!currentUser) {
    return sendError(res, HttpStatus.NOT_FOUND, 'User not found');
  }

  // Get blocked user IDs to filter them out
  const blockedUserIds = await getBlockedUserIds(currentUserId);

  // Build query - posts from followed users (excluding blocked users)
  const query = {
    author: {
      $in: currentUser.following || [],
      $nin: blockedUserIds // Exclude blocked users
    },
    visibility: { $in: ['public', 'followers'] },
    tagOnly: { $ne: true } // Exclude tag-only posts from following feed
  };

  // Pagination
  if (before) {
    const beforeDate = new Date(before);
    // SAFETY: Validate date
    if (!isNaN(beforeDate.getTime())) {
      query.createdAt = { $lt: beforeDate };
    }
  }

  // Tag filter
  if (tag) {
    query.hashtags = tag.toLowerCase();
  }

  // Fetch posts
  const posts = await Post.find(query)
    .populate('author', 'username displayName profilePhoto isVerified')
    .populate({
      path: 'originalPost',
      select: 'content media author createdAt',
      populate: {
        path: 'author',
        select: 'username displayName profilePhoto isVerified'
      }
    })
    .sort({ createdAt: -1 })
    .limit(limitNum)
    .lean();

  // Apply post sanitization
  const sanitizedPosts = posts.map(post => sanitizePostForPrivateLikes(post, currentUserId));

  res.json(sanitizedPosts);
}));

// Helper function to sanitize posts (same as in posts.js)
const sanitizePostForPrivateLikes = (post, currentUserId) => {
  // CRITICAL: Convert Mongoose document to plain object to remove .on() and other methods
  const postObj = post.toObject ? post.toObject() : { ...post };

  // Check if current user liked this post
  const hasLiked = postObj.likes?.some(like =>
    (like._id || like).toString() === currentUserId.toString()
  );

  // Replace likes array with just a boolean
  postObj.hasLiked = hasLiked;
  delete postObj.likes;

  // Handle originalPost (shared posts)
  if (postObj.originalPost) {
    // CRITICAL: Also convert nested originalPost to plain object
    const originalPostObj = postObj.originalPost.toObject ? postObj.originalPost.toObject() : { ...postObj.originalPost };
    const originalHasLiked = originalPostObj.likes?.some(like =>
      (like._id || like).toString() === currentUserId.toString()
    );
    originalPostObj.hasLiked = originalHasLiked;
    delete originalPostObj.likes;
    postObj.originalPost = originalPostObj;
  }

  return postObj;
};

export default router;

