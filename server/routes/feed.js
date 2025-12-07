/**
 * PHASE 2: Feed Routes - Global and Following Feeds
 * 
 * Implements slow, chronological feeds with no algorithmic ranking.
 * Only time-based sorting with optional manual promotion.
 */

import express from 'express';
import Post from '../models/Post.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/feed/global
 * Returns public posts in reverse chronological order
 * Optional slow weighting for promoted posts
 */
router.get('/global', authenticateToken, async (req, res) => {
  try {
    const { before, limit = 20, tag } = req.query;
    const currentUserId = req.user.id;

    // Build query
    const query = { visibility: 'public' };
    
    // Pagination: posts before a certain timestamp
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    // Tag filter (for Phase 4 - Community Tags)
    if (tag) {
      query.hashtags = tag.toLowerCase();
    }

    // Fetch posts with slow weighting
    // Using lean() for better performance (returns plain JS objects instead of Mongoose documents)
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
      .sort({
        // Primary sort: reverse chronological
        createdAt: -1
      })
      .limit(parseInt(limit))
      .lean();

    // Apply post sanitization (hide likes, etc.)
    const sanitizedPosts = posts.map(post => sanitizePostForPrivateLikes(post, currentUserId));

    res.json(sanitizedPosts);
  } catch (error) {
    console.error('Error fetching global feed:', error);
    res.status(500).json({ message: 'Failed to fetch global feed' });
  }
});

/**
 * GET /api/feed/following
 * Returns posts only from users the current user follows
 * Same slow sorting logic as global feed
 */
router.get('/following', authenticateToken, async (req, res) => {
  try {
    const { before, limit = 20, tag } = req.query;
    const currentUserId = req.user.id;

    // Get user's following list
    const User = (await import('../models/User.js')).default;
    const currentUser = await User.findById(currentUserId).select('following');
    
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Build query - posts from followed users
    const query = {
      author: { $in: currentUser.following },
      visibility: { $in: ['public', 'followers'] }
    };
    
    // Pagination
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    // Tag filter
    if (tag) {
      query.hashtags = tag.toLowerCase();
    }

    // Fetch posts
    // Using lean() for better performance (returns plain JS objects instead of Mongoose documents)
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
      .limit(parseInt(limit))
      .lean();

    // Apply post sanitization
    const sanitizedPosts = posts.map(post => sanitizePostForPrivateLikes(post, currentUserId));

    res.json(sanitizedPosts);
  } catch (error) {
    console.error('Error fetching following feed:', error);
    res.status(500).json({ message: 'Failed to fetch following feed' });
  }
});

// Helper function to sanitize posts (same as in posts.js)
const sanitizePostForPrivateLikes = (post, currentUserId) => {
  const postObj = post.toObject ? post.toObject() : post;
  
  // Check if current user liked this post
  const hasLiked = postObj.likes?.some(like => 
    (like._id || like).toString() === currentUserId.toString()
  );
  
  // Replace likes array with just a boolean
  postObj.hasLiked = hasLiked;
  delete postObj.likes;
  
  // Handle originalPost (shared posts)
  if (postObj.originalPost) {
    const originalHasLiked = postObj.originalPost.likes?.some(like =>
      (like._id || like).toString() === currentUserId.toString()
    );
    postObj.originalPost.hasLiked = originalHasLiked;
    delete postObj.originalPost.likes;
  }
  
  return postObj;
};

export default router;

