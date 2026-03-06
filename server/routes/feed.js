/**
 * PHASE 2: Feed Routes - Global and Following Feeds
 *
 * Implements chronological feeds with CALM ranking.
 * Uses calm feed ranking system for gentle community activity signals.
 *
 * PHASE 2 SAFETY: All routes use guard clauses and optional chaining
 * 
 * FEED CACHING: Redis caching added for improved performance
 * - First page cached for 30 seconds
 * - Other pages cached for 15 seconds
 * 
 * CALM FEED SYSTEM:
 * - Active Conversations: 3+ comments in last 6 hours
 * - Ongoing Discussions: 5+ comments spread over time
 * - New Member Boost: Gentle boost for accounts < 7 days
 * - Community Moments: Fill gaps with active older posts
 * - Activity Tags: Visual indicators (no algorithmic pressure)
 */

import express from 'express';
import Post from '../models/Post.js';
import auth from '../middleware/auth.js';
import requireActiveUser from '../middleware/requireActiveUser.js';
import { cacheShort, cacheConditional } from '../middleware/caching.js';
import { getBlockedUserIds } from '../utils/blockHelper.js';
import { asyncHandler, requireAuth, sendError, HttpStatus } from '../utils/errorHandler.js';
import logger from '../utils/logger.js';
import User from '../models/User.js';
import { 
  getGlobalFeedKey, 
  getFollowingFeedKey, 
  getCache, 
  setCache
} from '../utils/redisCache.js';
import { rankPosts, getFeedHeader, injectCommunityMoments } from '../utils/feedRanking.js';

const router = express.Router();

// Cache TTL settings (in seconds)
const FEED_CACHE_TTL = {
  firstPage: 30,
  otherPages: 15
};

// Enable/disable ranking (can be toggled via env)
const ENABLE_CALM_RANKING = process.env.FEED_RANKING !== 'false';

// ── Anonymous Post Sanitization (shared logic) ─────────────────────────────
const STAFF_ROLES = ['moderator', 'admin', 'super_admin'];

function sanitizeAnonymousPost(postObj, viewerRole, currentUserId) {
  if (!postObj?.isAnonymous) return postObj;
  if (STAFF_ROLES.includes(viewerRole)) {
    postObj._staffAnonymousView = true;
    return postObj;
  }
  const realAuthorId = postObj.author?._id;
  if (currentUserId && realAuthorId && String(realAuthorId) === String(currentUserId)) {
    postObj.isOwnPost = true;
  }
  postObj.author = {
    _id: null,
    username: 'anonymous',
    displayName: postObj.anonymousDisplayName || 'Anonymous Member',
    profilePhoto: '',
    isVerified: false,
    pronouns: null,
    badges: []
  };
  return postObj;
}

function sanitizeAnonymousPosts(posts, viewerRole, currentUserId) {
  return posts.map(p => sanitizeAnonymousPost({ ...p }, viewerRole, currentUserId));
}

// Feed cache config: first page cached 30s, other pages 15s
const feedCache = cacheConditional({ firstPage: 'short', otherPages: 15 });

/**
 * Apply CALM ranking if enabled
 */
const applyRanking = (posts, currentUser) => {
  if (!ENABLE_CALM_RANKING || !posts || posts.length === 0) {
    return { posts: posts, feedHeader: null };
  }
  
  // First pass: calculate activity tags and rank
  const rankedPosts = rankPosts(posts, currentUser);
  
  // Second pass: inject community moments if feed is small
  const finalPosts = injectCommunityMoments(rankedPosts, posts);
  
  // Get header for conversation section
  const feedHeader = getFeedHeader(finalPosts);
  
  return { posts: finalPosts, feedHeader };
};

/**
 * GET /api/feed
 * Root feed endpoint - defaults to global feed
 */
router.get('/', auth, requireActiveUser, feedCache, asyncHandler(async (req, res) => {
  const currentUserId = requireAuth(req, res);
  if (!currentUserId) return;

  const { page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

  const isFirstPage = pageNum === 1;
  const cacheTtl = isFirstPage ? FEED_CACHE_TTL.firstPage : FEED_CACHE_TTL.otherPages;

  // Try cache first
  const cacheKey = getGlobalFeedKey(pageNum);
  const cachedData = await getCache(cacheKey);
  
  if (cachedData) {
    logger.debug(`[Feed] Cache HIT for page ${pageNum}`);
    return res.json(cachedData);
  }

  // Get blocked users
  const blockedUserIds = await getBlockedUserIds(currentUserId);

  // Build query
  const query = {
    visibility: 'public',
    author: { $nin: blockedUserIds },
    groupId: null
  };

  const skip = (pageNum - 1) * limitNum;

  // Fetch posts with comment stats
  const posts = await Post.find(query)
    .populate('author', 'username displayName profilePhoto isVerified createdAt')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum)
    .lean();

  // Get current user for ranking
  const currentUser = await User.findById(currentUserId).lean();
  
  // Apply CALM ranking
  const { posts: rankedPosts, feedHeader } = applyRanking(posts, currentUser);

  // Apply sanitization
  const sanitizedPosts = rankedPosts.map(post => sanitizePostForPrivateLikes(post, currentUserId));
  const finalPosts = sanitizeAnonymousPosts(sanitizedPosts, req.user?.role, currentUserId);

  const responseData = { 
    posts: finalPosts,
    feedHeader: feedHeader
  };

  // Cache the response
  await setCache(cacheKey, responseData, cacheTtl);
  logger.debug(`[Feed] Cached page ${pageNum} for ${cacheTtl}s`);

  res.json(responseData);
}));

/**
 * GET /api/feed/global
 * Returns public posts with CALM ranking
 */
router.get('/global', auth, requireActiveUser, cacheShort, asyncHandler(async (req, res) => {
  const currentUserId = requireAuth(req, res);
  if (!currentUserId) return;

  const { before, limit = 20, page = 1 } = req.query;
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const pageNum = Math.max(1, parseInt(page) || 1);

  const cacheKey = before 
    ? `feed:global:before:${before}:limit${limitNum}`
    : getGlobalFeedKey(pageNum);

  if (!before) {
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      logger.debug(`[Feed/Global] Cache HIT for page ${pageNum}`);
      return res.json(cachedData);
    }
  }

  const blockedUserIds = await getBlockedUserIds(currentUserId);

  const query = {
    visibility: 'public',
    author: { $nin: blockedUserIds },
    groupId: null
  };

  if (before) {
    const beforeDate = new Date(before);
    if (!isNaN(beforeDate.getTime())) {
      query.createdAt = { $lt: beforeDate };
    }
  }

  const posts = await Post.find(query)
    .populate('author', 'username displayName profilePhoto isVerified createdAt')
    .sort({ createdAt: -1 })
    .limit(limitNum)
    .lean();

  const currentUser = await User.findById(currentUserId).lean();
  const { posts: rankedPosts, feedHeader } = applyRanking(posts, currentUser);

  const sanitizedPosts = rankedPosts.map(post => sanitizePostForPrivateLikes(post, currentUserId));
  const finalPosts = sanitizeAnonymousPosts(sanitizedPosts, req.user?.role, currentUserId);

  const responseData = { 
    posts: finalPosts,
    feedHeader: feedHeader
  };

  if (!before) {
    await setCache(cacheKey, responseData, FEED_CACHE_TTL.firstPage);
    logger.debug(`[Feed/Global] Cached page ${pageNum}`);
  }

  res.json(responseData);
}));

/**
 * GET /api/feed/following
 * Returns posts from followed users with CALM ranking
 */
router.get('/following', auth, requireActiveUser, cacheShort, asyncHandler(async (req, res) => {
  const currentUserId = requireAuth(req, res);
  if (!currentUserId) return;

  const { before, limit = 20, page = 1 } = req.query;
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const pageNum = Math.max(1, parseInt(page) || 1);

  const cacheKey = before
    ? `feed:following:${currentUserId}:before:${before}:limit${limitNum}`
    : getFollowingFeedKey(currentUserId, pageNum);

  if (!before) {
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      logger.debug(`[Feed/Following] Cache HIT for user ${currentUserId} page ${pageNum}`);
      return res.json(cachedData);
    }
  }

  const currentUser = await User.findById(currentUserId).select('following');

  if (!currentUser) {
    return sendError(res, HttpStatus.NOT_FOUND, 'User not found');
  }

  const blockedUserIds = await getBlockedUserIds(currentUserId);

  const query = {
    author: {
      $in: currentUser.following || [],
      $nin: blockedUserIds
    },
    visibility: { $in: ['public', 'followers'] },
    groupId: null
  };

  if (before) {
    const beforeDate = new Date(before);
    if (!isNaN(beforeDate.getTime())) {
      query.createdAt = { $lt: beforeDate };
    }
  }

  const posts = await Post.find(query)
    .populate('author', 'username displayName profilePhoto isVerified createdAt')
    .sort({ createdAt: -1 })
    .limit(limitNum)
    .lean();

  const { posts: rankedPosts, feedHeader } = applyRanking(posts, currentUser);

  const sanitizedPosts = rankedPosts.map(post => sanitizePostForPrivateLikes(post, currentUserId));
  const finalPosts = sanitizeAnonymousPosts(sanitizedPosts, req.user?.role, currentUserId);

  const responseData = { 
    posts: finalPosts,
    feedHeader: feedHeader
  };

  if (!before) {
    await setCache(cacheKey, responseData, FEED_CACHE_TTL.firstPage);
    logger.debug(`[Feed/Following] Cached user ${currentUserId} page ${pageNum}`);
  }

  res.json(responseData);
}));

// Helper function to sanitize posts
const sanitizePostForPrivateLikes = (post, currentUserId) => {
  const postObj = post.toObject ? post.toObject() : { ...post };

  const hasLiked = postObj.likes?.some(like =>
    (like._id || like).toString() === currentUserId.toString()
  );

  postObj.hasLiked = hasLiked;
  delete postObj.likes;

  const authorId = postObj.author?._id ?? postObj.author;
  postObj.isOwnPost = !!(currentUserId && authorId && String(authorId) === String(currentUserId));

  return postObj;
};

/**
 * GET /api/feed/conversations
 * Returns suggested conversations - posts with 4+ comments in last 24 hours
 */
router.get('/conversations', auth, requireActiveUser, cacheShort, asyncHandler(async (req, res) => {
  const currentUserId = requireAuth(req, res);
  if (!currentUserId) return;

  const cacheKey = 'feed:suggested:conversations';
  const cachedData = await getCache(cacheKey);
  
  if (cachedData) {
    logger.debug('[Feed/Conversations] Cache HIT');
    return res.json(cachedData);
  }

  const blockedUserIds = await getBlockedUserIds(currentUserId);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const query = {
    visibility: 'public',
    author: { $nin: blockedUserIds },
    groupId: null,
    commentCount: { $gte: 4 },
    createdAt: { $gte: twentyFourHoursAgo }
  };

  const posts = await Post.find(query)
    .populate('author', 'username displayName profilePhoto isVerified role')
    .sort({ commentCount: -1, createdAt: -1 })
    .limit(3)
    .lean();

  const sanitizedPosts = posts.map(post => sanitizePostForPrivateLikes(post, currentUserId));
  const finalPosts = sanitizeAnonymousPosts(sanitizedPosts, req.user?.role, currentUserId);

  const responseData = { suggestedConversations: finalPosts };

  await setCache(cacheKey, responseData, 300);
  logger.debug('[Feed/Conversations] Cached suggested conversations');

  res.json(responseData);
}));

export default router;
