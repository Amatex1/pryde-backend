/**
 * Cache Warm-up Service
 * 
 * Pre-caches frequently accessed data for active users on login
 * to reduce initial page load latency.
 */

import { getCache, setCache } from './redisCache.js';
import User from '../models/User.js';
import Post from '../models/Post.js';
import logger from './logger.js';

/**
 * Warm up cache for a user on login
 * @param {string} userId - User ID to warm up cache for
 */
export const warmupUserCache = async (userId) => {
  try {
    logger.debug(`[CacheWarmup] Starting cache warm-up for user ${userId}`);
    
    // 1. Warm up user's home feed (first page)
    await warmupHomeFeed(userId);
    
    // 2. Warm up user's profile data (if needed elsewhere)
    // await warmupUserProfile(userId);
    
    logger.info(`[CacheWarmup] Cache warm-up complete for user ${userId}`);
  } catch (error) {
    logger.error(`[CacheWarmup] Error warming up cache for user ${userId}:`, error.message);
    // Don't throw - cache warm-up is best-effort
  }
};

/**
 * Warm up home feed for a user
 * @param {string} userId - User ID
 */
const warmupHomeFeed = async (userId) => {
  try {
    // Get user's following list
    const user = await User.findById(userId).select('following').lean();
    
    if (!user || !user.following || user.following.length === 0) {
      logger.debug(`[CacheWarmup] User ${userId} has no following list, skipping feed warm-up`);
      return;
    }
    
    // Get blocked users (simplified - in production, use blockHelper)
    const blockedUserIds = [];
    
    // Build feed query (same as in feed.js)
    const query = {
      author: { $in: user.following, $nin: blockedUserIds },
      visibility: { $in: ['public', 'followers'] },
      groupId: null
    };
    
    // Fetch posts (limit 20 like the feed)
    const posts = await Post.find(query)
      .populate('author', 'username displayName profilePhoto isVerified')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    
    // Cache the feed
    const cacheKey = `feed:home:${userId}:following:page1`;
    await setCache(cacheKey, posts, 60); // 60 second TTL for warm-up cache
    
    logger.debug(`[CacheWarmup] Warmed up home feed for user ${userId} (${posts.length} posts)`);
  } catch (error) {
    logger.error(`[CacheWarmup] Error warming up home feed:`, error.message);
  }
};

/**
 * Warm up trending feed
 */
export const warmupTrendingFeed = async () => {
  try {
    // Get trending posts (posts with most likes in last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const trendingPosts = await Post.find({
      createdAt: { $gte: oneDayAgo },
      visibility: 'public',
      groupId: null
    })
      .populate('author', 'username displayName profilePhoto isVerified')
      .sort({ likesCount: -1, createdAt: -1 })
      .limit(20)
      .lean();
    
    // Cache trending feed
    const cacheKey = 'feed:trending:global:public:page1';
    await setCache(cacheKey, trendingPosts, 300); // 5 minute TTL for trending
    
    logger.debug(`[CacheWarmup] Warmed up trending feed (${trendingPosts.length} posts)`);
  } catch (error) {
    logger.error(`[CacheWarmup] Error warming up trending feed:`, error.message);
  }
};

/**
 * Warm up global feed (for unauthenticated users)
 */
export const warmupGlobalFeed = async () => {
  try {
    const posts = await Post.find({
      visibility: 'public',
      groupId: null
    })
      .populate('author', 'username displayName profilePhoto isVerified')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    
    const cacheKey = 'feed:global:anonymous:public:page1';
    await setCache(cacheKey, posts, 60);
    
    logger.debug(`[CacheWarmup] Warmed up global feed (${posts.length} posts)`);
  } catch (error) {
    logger.error(`[CacheWarmup] Error warming up global feed:`, error.message);
  }
};

export default {
  warmupUserCache,
  warmupTrendingFeed,
  warmupGlobalFeed
};
