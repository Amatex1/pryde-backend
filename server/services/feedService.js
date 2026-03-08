/**
 * Feed Retrieval Service
 * 
 * Retrieves personalized feed for a user using the FeedEntry system.
 * Falls back to database queries if Redis is unavailable.
 * 
 * Flow:
 * 1. Check Redis cache for user's feed
 * 2. If cache miss, query FeedEntry collection
 * 3. Fetch full post details using postId list
 * 4. Cache result for 60 seconds
 */

import FeedEntry from '../models/FeedEntry.js';
import Post from '../models/Post.js';
import User from '../models/User.js';
import { getCache, setCache, deleteCache, isRedisConnected } from '../utils/redisCache.js';
import { getBlockedUserIds } from '../utils/blockHelper.js';
import logger from '../utils/logger.js';

// Cache TTL for personalized feed (seconds)
const FEED_CACHE_TTL = 60;

// Default limit for feed entries
const DEFAULT_FEED_LIMIT = 50;

/**
 * Sanitize post to hide private like data
 * Helper function to hide like counts from non-owners
 */
const sanitizePostForPrivateLikes = (post, currentUserId) => {
  const postObj = post.toObject ? post.toObject() : { ...post };
  
  // Check if current user liked this post
  const hasLiked = postObj.likes?.some(like =>
    (like._id || like).toString() === currentUserId.toString()
  );
  
  // Replace likes array with just a boolean
  postObj.hasLiked = hasLiked;
  delete postObj.likes;
  
  return postObj;
};

/**
 * Get cache key for user's personalized feed
 * 
 * @param {string} userId - User ID
 * @returns {string} Cache key
 */
const getUserFeedCacheKey = (userId) => {
  return `feed:user:${userId}`;
};

/**
 * Get personalized feed for a user
 * 
 * Uses fan-out-on-read fallback to original feed system if no FeedEntries exist.
 * 
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum posts to return (default: 50)
 * @returns {Promise<Array>} Array of post objects
 */
export const getUserFeed = async (userId, options = {}) => {
  const limit = options.limit || DEFAULT_FEED_LIMIT;
  
  // Try cache first
  const cacheKey = getUserFeedCacheKey(userId);
  
  // Check if Redis is connected
  const redisAvailable = isRedisConnected();
  
  if (redisAvailable) {
    const cachedFeed = await getCache(cacheKey);
    if (cachedFeed) {
      logger.debug(`[FeedService] Cache HIT for user ${userId}`);
      return cachedFeed;
    }
    logger.debug(`[FeedService] Cache MISS for user ${userId}`);
  }
  
  // Cache miss - fetch from database
  try {
    const posts = await fetchFeedFromDatabase(userId, limit);
    
    // Cache the result if Redis is available
    if (redisAvailable && posts.length > 0) {
      await setCache(cacheKey, posts, FEED_CACHE_TTL);
      logger.debug(`[FeedService] Cached ${posts.length} posts for user ${userId}`);
    }
    
    return posts;
    
  } catch (error) {
    logger.error('[FeedService] Error fetching feed from database:', error.message);
    
    // Fallback: try original feed system if FeedEntry system fails
    if (!redisAvailable) {
      logger.warn('[FeedService] Redis unavailable, using fallback feed');
      return getFallbackFeed(userId, limit);
    }
    
    throw error;
  }
};

/**
 * Fetch feed from FeedEntry collection
 * 
 * @param {string} userId - User ID
 * @param {number} limit - Maximum posts to fetch
 * @returns {Promise<Array>} Array of populated post objects
 */
const fetchFeedFromDatabase = async (userId, limit) => {
  // Get feed entries for this user, sorted by score and time
  const feedEntries = await FeedEntry.find({ userId })
    .sort({ score: -1, createdAt: -1 })
    .limit(limit)
    .lean();
  
  if (feedEntries.length === 0) {
    logger.debug(`[FeedService] No feed entries for user ${userId}, using fallback`);
    return getFallbackFeed(userId, limit);
  }
  
  // Extract post IDs
  const postIds = feedEntries.map(entry => entry.postId);
  
  // Get blocked users to filter
  const blockedUserIds = await getBlockedUserIds(userId);
  
  // Fetch full posts
  const posts = await Post.find({
    _id: { $in: postIds },
    author: { $nin: blockedUserIds }
  })
  .populate('author', 'username displayName profilePhoto isVerified pronouns badges')
  .populate('comments.user', 'username displayName profilePhoto isVerified pronouns badges')
  .populate('reactions.user', 'username displayName profilePhoto')
  .lean();
  
  // Sort posts to match feed entry order (by score)
  const postMap = new Map(posts.map(p => [p._id.toString(), p]));
  const orderedPosts = postIds
    .map(id => postMap.get(id.toString()))
    .filter(Boolean);
  
  // Sanitize posts (hide like counts)
  const sanitizedPosts = orderedPosts.map(post => sanitizePostForPrivateLikes(post, userId));
  
  return sanitizedPosts;
};

/**
 * Fallback feed using original system
 * 
 * Used when FeedEntry system has no data for user (initial state or migration)
 * 
 * @param {string} userId - User ID
 * @param {number} limit - Maximum posts to fetch
 * @returns {Promise<Array>} Array of post objects
 */
const getFallbackFeed = async (userId, limit) => {
  logger.debug(`[FeedService] Using fallback feed for user ${userId}`);
  
  // Get current user to find followed users
  const currentUser = await User.findById(userId).select('following').lean();
  
  if (!currentUser || !currentUser.following || currentUser.following.length === 0) {
    return [];
  }
  
  // Get blocked users
  const blockedUserIds = await getBlockedUserIds(userId);
  
  // Query posts from followed users
  const posts = await Post.find({
    author: { 
      $in: currentUser.following,
      $nin: blockedUserIds
    },
    visibility: { $in: ['public', 'followers'] },
    groupId: null,
    circleId: null
  })
  .populate('author', 'username displayName profilePhoto isVerified pronouns badges')
  .populate('comments.user', 'username displayName profilePhoto isVerified pronouns badges')
  .populate('reactions.user', 'username displayName profilePhoto')
  .sort({ createdAt: -1 })
  .limit(limit)
  .lean();
  
  // Sanitize posts
  const sanitizedPosts = posts.map(post => sanitizePostForPrivateLikes(post, userId));
  
  return sanitizedPosts;
};

/**
 * Invalidate user's feed cache
 * 
 * Call this when:
 * - User's feed should refresh (new posts from followed users)
 * - User's following list changes
 * 
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
export const invalidateUserFeedCache = async (userId) => {
  try {
    const cacheKey = getUserFeedCacheKey(userId);
    const result = await deleteCache(cacheKey);
    logger.debug(`[FeedService] Invalidated cache for user ${userId}`);
    return result;
  } catch (error) {
    logger.error('[FeedService] Error invalidating cache:', error.message);
    return false;
  }
};

/**
 * Pre-warm cache for a user
 * 
 * Called when user logs in or when we want to proactively cache
 * 
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export const warmUserFeedCache = async (userId) => {
  try {
    const cacheKey = getUserFeedCacheKey(userId);
    
    // Check if already cached
    const existing = await getCache(cacheKey);
    if (existing) {
      logger.debug(`[FeedService] Feed already cached for user ${userId}`);
      return;
    }
    
    // Fetch and cache
    const posts = await getUserFeed(userId);
    
    if (posts.length > 0) {
      await setCache(cacheKey, posts, FEED_CACHE_TTL);
      logger.debug(`[FeedService] Warmed cache for user ${userId}: ${posts.length} posts`);
    }
  } catch (error) {
    logger.warn('[FeedService] Error warming feed cache:', error.message);
  }
};

export default {
  getUserFeed,
  invalidateUserFeedCache,
  warmUserFeedCache
};

