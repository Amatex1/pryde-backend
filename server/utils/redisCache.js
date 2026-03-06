/**
 * Redis Feed Cache Utility
 * 
 * Provides Redis-based caching for feed queries to reduce MongoDB load.
 * Supports:
 * - Feed caching with TTL
 * - Cache invalidation on new posts/likes
 * - User-scoped cache keys
 * 
 * Uses ioredis for Redis connection (already in dependencies)
 */

import Redis from 'ioredis';
import config from '../config/config.js';
import logger from './logger.js';

let redisClient = null;
let isConnected = false;

/**
 * Initialize Redis client - exported as both names for compatibility
 */
export const initFeedCache = async () => {
  if (!config.redis?.url) {
    logger.warn('[RedisCache] Redis not configured - feed caching disabled');
    return null;
  }

  try {
    const redisUrl = config.redis.url;
    
    // Connection options for ioredis
    let redisOptions = {
      maxRetriesPerRequest: 3,
      retryStrategy: (retries) => {
        if (retries > 10) {
          logger.error('[RedisCache] Max reconnection attempts reached');
          return new Error('Max reconnection attempts reached');
        }
        return Math.min(retries * 100, 3000);
      },
      enableReadyCheck: true,
      connectTimeout: 10000,
    };

    // If URL provided, use it directly
    redisClient = new Redis(redisUrl, redisOptions);

    redisClient.on('error', (err) => {
      logger.error('[RedisCache] Redis error:', err.message);
      isConnected = false;
    });

    redisClient.on('connect', () => {
      logger.info('✅ [RedisCache] Redis connected for feed caching');
      isConnected = true;
    });

    redisClient.on('ready', () => {
      logger.info('[RedisCache] Redis ready for commands');
      isConnected = true;
    });

    redisClient.on('disconnect', () => {
      logger.warn('[RedisCache] Redis disconnected');
      isConnected = false;
    });

    // Wait for initial connection
    await new Promise((resolve, reject) => {
      redisClient.once('ready', resolve);
      redisClient.once('error', reject);
      // Timeout after 10 seconds
      setTimeout(() => reject(new Error('Redis connection timeout')), 10000);
    });
    
    return redisClient;
  } catch (error) {
    logger.error('[RedisCache] Failed to initialize Redis:', error.message);
    return null;
  }
};

// Alias for backwards compatibility
export const initRedisCache = initFeedCache;

/**
 * Get Redis client instance
 */
export const getRedisClient = () => redisClient;

/**
 * Check if Redis is connected
 */
export const isRedisConnected = () => isConnected && redisClient?.isOpen;

/**
 * Generate cache key for feed
 */
export const getFeedCacheKey = (type, userId, page) => {
  return `feed:${type}:${userId || 'global'}:${page}`;
};

/**
 * Get global feed cache key (for feed.js compatibility)
 */
export const getGlobalFeedKey = (page = 1) => {
  return `feed:global:${page}`;
};

/**
 * Get following feed cache key (for feed.js compatibility)
 */
export const getFollowingFeedKey = (userId, page = 1) => {
  return `feed:following:${userId}:${page}`;
};

/**
 * Get trending feed cache key
 */
export const getTrendingFeedKey = (page = 1) => {
  return `feed:trending:${page}`;
};

/**
 * Get user profile feed cache key
 */
export const getUserFeedKey = (userId, page = 1) => {
  return `feed:user:${userId}:${page}`;
};

/**
 * Get generic cache (for feed.js compatibility)
 */
export const getCache = async (key) => {
  if (!isRedisConnected()) {
    return null;
  }

  try {
    const cached = await redisClient.get(key);
    if (cached) {
      logger.debug(`[RedisCache] Cache HIT: ${key}`);
      return JSON.parse(cached);
    }
    logger.debug(`[RedisCache] Cache MISS: ${key}`);
    return null;
  } catch (error) {
    logger.error('[RedisCache] Get cache error:', error.message);
    return null;
  }
};

/**
 * Set generic cache (for feed.js compatibility)
 */
export const setCache = async (key, data, ttlSeconds = 30) => {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(data));
    logger.debug(`[RedisCache] Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
    return true;
  } catch (error) {
    logger.error('[RedisCache] Set cache error:', error.message);
    return false;
  }
};

/**
 * Delete cache key
 */
export const deleteCache = async (key) => {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    await redisClient.del(key);
    logger.debug(`[RedisCache] Cache DELETE: ${key}`);
    return true;
  } catch (error) {
    logger.error('[RedisCache] Delete cache error:', error.message);
    return false;
  }
};

/**
 * Get cached feed data
 */
export const getCachedFeed = async (type, userId, page) => {
  if (!isRedisConnected()) {
    return null;
  }

  try {
    const key = getFeedCacheKey(type, userId, page);
    const cached = await redisClient.get(key);
    
    if (cached) {
      logger.debug(`[RedisCache] Cache HIT: ${key}`);
      return JSON.parse(cached);
    }
    
    logger.debug(`[RedisCache] Cache MISS: ${key}`);
    return null;
  } catch (error) {
    logger.error('[RedisCache] Get cache error:', error.message);
    return null;
  }
};

/**
 * Set feed cache with TTL
 */
export const setCachedFeed = async (type, userId, page, data, ttlSeconds = 30) => {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    const key = getFeedCacheKey(type, userId, page);
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(data));
    logger.debug(`[RedisCache] Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
    return true;
  } catch (error) {
    logger.error('[RedisCache] Set cache error:', error.message);
    return false;
  }
};

/**
 * Invalidate user feed cache
 */
export const invalidateUserFeedCache = async (userId) => {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    // Delete user's following feed cache
    const followingKeys = await redisClient.keys(`feed:following:${userId}:*`);
    if (followingKeys.length > 0) {
      await redisClient.del(followingKeys);
      logger.debug(`[RedisCache] Invalidated ${followingKeys.length} following feed keys for user ${userId}`);
    }

    // Delete user's profile feed cache
    const profileKeys = await redisClient.keys(`feed:user:${userId}:*`);
    if (profileKeys.length > 0) {
      await redisClient.del(profileKeys);
      logger.debug(`[RedisCache] Invalidated ${profileKeys.length} user feed keys for user ${userId}`);
    }

    return true;
  } catch (error) {
    logger.error('[RedisCache] Invalidate cache error:', error.message);
    return false;
  }
};

/**
 * Invalidate global feed cache
 */
export const invalidateGlobalFeedCache = async () => {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    const globalKeys = await redisClient.keys('feed:global:*');
    if (globalKeys.length > 0) {
      await redisClient.del(globalKeys);
      logger.debug(`[RedisCache] Invalidated ${globalKeys.length} global feed keys`);
    }
    return true;
  } catch (error) {
    logger.error('[RedisCache] Invalidate global cache error:', error.message);
    return false;
  }
};

/**
 * Invalidate all feed caches (for trending/engagement changes)
 */
export const invalidateAllFeedCache = async () => {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    const allKeys = await redisClient.keys('feed:*');
    if (allKeys.length > 0) {
      await redisClient.del(allKeys);
      logger.debug(`[RedisCache] Invalidated ${allKeys.length} feed cache keys`);
    }
    return true;
  } catch (error) {
    logger.error('[RedisCache] Invalidate all cache error:', error.message);
    return false;
  }
};

/**
 * Invalidate feed when new post is created
 */
export const onNewPost = async (post) => {
  const authorId = post.author?.toString();
  
  // Invalidate author's profile feed
  if (authorId) {
    await invalidateUserFeedCache(authorId);
  }

  // Invalidate global feed
  await invalidateGlobalFeedCache();

  // Invalidate followers' feeds
  // This would require fetching followers - handled by caller if needed
  logger.info(`[RedisCache] Feed invalidated for new post by ${authorId}`);
};

/**
 * Invalidate feed when content is liked/commented
 */
export const onContentInteraction = async (postId, authorId) => {
  // Invalidate the post author's feed cache
  if (authorId) {
    await invalidateUserFeedCache(authorId.toString());
  }
  
  // Invalidate global feed since engagement metrics changed
  await invalidateGlobalFeedCache();
  
  logger.info(`[RedisCache] Feed invalidated for interaction on post ${postId}`);
};

/**
 * Close Redis connection
 */
export const closeRedisCache = async () => {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    isConnected = false;
    logger.info('[RedisCache] Redis connection closed');
  }
};

export default {
  initFeedCache,
  initRedisCache,
  getRedisClient,
  isRedisConnected,
  getFeedCacheKey,
  getGlobalFeedKey,
  getFollowingFeedKey,
  getTrendingFeedKey,
  getUserFeedKey,
  getCache,
  setCache,
  deleteCache,
  getCachedFeed,
  setCachedFeed,
  invalidateUserFeedCache,
  invalidateGlobalFeedCache,
  invalidateAllFeedCache,
  onNewPost,
  onContentInteraction,
  closeRedisCache
};
