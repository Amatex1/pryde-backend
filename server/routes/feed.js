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
import { cacheShort, cacheConditional } from '../middleware/caching.js';
import { getBlockedUserIds } from '../utils/blockHelper.js';
import { asyncHandler, requireAuth, sendError, HttpStatus } from '../utils/errorHandler.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Feed cache config: first page cached 30s, other pages 15s
const feedCache = cacheConditional({ firstPage: 'short', otherPages: 15 });

/**
 * GET /api/feed
 * Root feed endpoint - defaults to global feed
 * Supports page/limit params for backward compatibility
 */
router.get('/', auth, requireActiveUser, feedCache, asyncHandler(async (req, res) => {
  // SAFETY: Guard clause for auth
  const currentUserId = requireAuth(req, res);
  if (!currentUserId) return;

  const { page = 1, limit = 20 } = req.query;

  // SAFETY: Validate pagination params
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

  // Get blocked user IDs to filter them out
  const blockedUserIds = await getBlockedUserIds(currentUserId);

  // Build query
  // Phase 2: Exclude group posts (groupId !== null) from global feed
  // Group posts are intentionally isolated from global feeds
  const query = {
    visibility: 'public',
    author: { $nin: blockedUserIds }, // Exclude blocked users
    groupId: null // Phase 2: Exclude group posts
    // REMOVED 2025-12-26: tagOnly filter deleted (Phase 5)
  };

  // REMOVED 2025-12-26: Tag filter deleted (Phase 5 - hashtags removed)

  // Calculate skip for pagination
  const skip = (pageNum - 1) * limitNum;

  // Fetch posts
  const posts = await Post.find(query)
    .populate('author', 'username displayName profilePhoto isVerified')
    // REMOVED 2025-12-26: originalPost population deleted (Phase 5)
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
router.get('/global', auth, requireActiveUser, cacheShort, asyncHandler(async (req, res) => {
  // SAFETY: Guard clause for auth
  const currentUserId = requireAuth(req, res);
  if (!currentUserId) return;

  const { before, limit = 20 } = req.query;

  // SAFETY: Validate limit param
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

  // Get blocked user IDs to filter them out
  const blockedUserIds = await getBlockedUserIds(currentUserId);

  // Build query
  // Phase 2: Exclude group posts (groupId !== null) from global feed
  // Group posts are intentionally isolated from global feeds
  const query = {
    visibility: 'public',
    author: { $nin: blockedUserIds }, // Exclude blocked users
    groupId: null // Phase 2: Exclude group posts
    // REMOVED 2025-12-26: tagOnly filter deleted (Phase 5)
  };

  // Pagination: posts before a certain timestamp
  if (before) {
    const beforeDate = new Date(before);
    // SAFETY: Validate date
    if (!isNaN(beforeDate.getTime())) {
      query.createdAt = { $lt: beforeDate };
    }
  }

  // REMOVED 2025-12-26: Tag filter deleted (Phase 5 - hashtags removed)

  // Fetch posts with slow weighting
  const posts = await Post.find(query)
    .populate('author', 'username displayName profilePhoto isVerified')
    // REMOVED 2025-12-26: originalPost population deleted (Phase 5)
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
router.get('/following', auth, requireActiveUser, cacheShort, asyncHandler(async (req, res) => {
  // SAFETY: Guard clause for auth
  const currentUserId = requireAuth(req, res);
  if (!currentUserId) return;

  const { before, limit = 20 } = req.query;

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
  // Phase 2: Exclude group posts (groupId !== null) from following feed
  // Group posts are intentionally isolated from global feeds
  const query = {
    author: {
      $in: currentUser.following || [],
      $nin: blockedUserIds // Exclude blocked users
    },
    visibility: { $in: ['public', 'followers'] },
    groupId: null // Phase 2: Exclude group posts
    // REMOVED 2025-12-26: tagOnly filter deleted (Phase 5)
  };

  // Pagination
  if (before) {
    const beforeDate = new Date(before);
    // SAFETY: Validate date
    if (!isNaN(beforeDate.getTime())) {
      query.createdAt = { $lt: beforeDate };
    }
  }

  // REMOVED 2025-12-26: Tag filter deleted (Phase 5 - hashtags removed)

  // Fetch posts
  const posts = await Post.find(query)
    .populate('author', 'username displayName profilePhoto isVerified')
    // REMOVED 2025-12-26: originalPost population deleted (Phase 5)
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

  // REMOVED 2025-12-26: originalPost handling deleted (Phase 5 - share system removed)

  return postObj;
};

export default router;

