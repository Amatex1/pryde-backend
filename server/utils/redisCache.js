/**
 * Redis Cache Service for Feed Caching
 * 
 * Provides server-side Redis caching for feed queries.
 * Falls back to in-memory cache if Redis is not available.
 */

import config from '../config/config.js';
import logger from './logger.js';

let redisClient = null;
let useRedis = false;

// In-memory fallback cache
const memoryCache = new Map();
const memoryCacheExpiry = new Map();

/**
 * Initialize Redis connection for feed caching
 * Uses a separate connection from rate limiting
 */
export const initFeedCache = async () => {
  try {
    // Check if Redis is configured
    if (!config.redis) {
      logger.warn('[FeedCache] Redis not configured - using in-memory cache');
      return false;
    }

    const Redis = (await import('ioredis')).default;
    
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      tls: config.redis.tls,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      connectionTimeout: 5000,
    });

    await redisClient.connect();
    useRedis = true;
    logger.info('[FeedCache] Redis connected successfully for feed caching');
    
    redisClient.on('error', (err) => {
      logger.error('[FeedCache] Redis error:', err.message);
      useRedis = false;
    });

    return true;
  } catch (error) {
    logger.warn('[FeedCache] Failed to connect to Redis, using in-memory cache:', error.message);
    useRedis = false;
    return false;
  }
};

/**
 * Generate cache key for feed queries
 * @param {string} userId - User ID (null for global feeds)
 * @param {string} feedType - 'global', 'following', 'home'
 * @param {number} page - Page number
 * @param {string} filter - Feed filter (followers, public)
 */
export const getFeedCacheKey = (userId, feedType, page, filter = 'public') => {
  if (userId) {
    return `feed:${feedType}:${userId}:${filter}:page${page}`;
  }
  return `feed:${feedType}:global:${filter}:page${page}`;
};

/**
 * Generate cache key for user's home feed
 */
export const getHomeFeedKey = (userId, page) => {
  return getFeedCacheKey(userId, 'home', page, 'following');
};

/**
 * Generate cache key for global feed
 */
export const getGlobalFeedKey = (page) => {
  return getFeedCacheKey(null, 'global', page, 'public');
};

/**
 * Generate cache key for following feed
 */
export const getFollowingFeedKey = (userId, page) => {
  const userIdStr = userId ? String(userId) : 'anonymous';
  return getFeedCacheKey(userIdStr, 'following', page, 'followers');
};

/**
 * Get cached data from Redis or memory
 * @param {string} key - Cache key
 * @returns {Promise<object|null>} - Cached data or null
 */
export const getCache = async (key) => {
  try {
    if (useRedis && redisClient) {
      const data = await redisClient.get(key);
      if (data) {
        logger.debug(`[FeedCache] HIT: ${key}`);
        return JSON.parse(data);
      }
      logger.debug(`[FeedCache] MISS: ${key}`);
      return null;
    }
    
    // Fallback to in-memory cache
    const expiry = memoryCacheExpiry.get(key);
    if (expiry && Date.now() < expiry) {
      logger.debug(`[FeedCache] MEM HIT: ${key}`);
      return memoryCache.get(key);
    }
    
    // Clean up expired entry
    memoryCache.delete(key);
    memoryCacheExpiry.delete(key);
    logger.debug(`[FeedCache] MEM MISS: ${key}`);
    return null;
  } catch (error) {
    logger.error('[FeedCache] Get error:', error.message);
    return null;
  }
};

/**
 * Set cached data in Redis or memory
 * @param {string} key - Cache key
 * @param {object} data - Data to cache
 * @param {number} ttlSeconds - Time to live in seconds
 */
export const setCache = async (key, data, ttlSeconds = 30) => {
  try {
    if (useRedis && redisClient) {
      await redisClient.setex(key, ttlSeconds, JSON.stringify(data));
      logger.debug(`[FeedCache] SET: ${key} (TTL: ${ttlSeconds}s)`);
      return true;
    }
    
    // Fallback to in-memory cache
    memoryCache.set(key, data);
    memoryCacheExpiry.set(key, Date.now() + (ttlSeconds * 1000));
    logger.debug(`[FeedCache] MEM SET: ${key} (TTL: ${ttlSeconds}s)`);
    return true;
  } catch (error) {
    logger.error('[FeedCache] Set error:', error.message);
    return false;
  }
};

/**
 * Invalidate cache for a specific user's feed
 * @param {string} userId - User ID to invalidate
 */
export const invalidateUserFeedCache = async (userId) => {
  try {
    if (useRedis && redisClient) {
      const pattern = `feed:*:${userId}:*`;
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
        logger.info(`[FeedCache] Invalidated ${keys.length} keys for user ${userId}`);
      }
    } else {
      // In-memory cleanup
      for (const key of memoryCache.keys()) {
        if (key.includes(`:${userId}:`)) {
          memoryCache.delete(key);
          memoryCacheExpiry.delete(key);
        }
      }
    }
  } catch (error) {
    logger.error('[FeedCache] Invalidate user error:', error.message);
  }
};

/**
 * Invalidate global feed cache
 */
export const invalidateGlobalFeedCache = async () => {
  try {
    if (useRedis && redisClient) {
      const pattern = 'feed:global:*';
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
        logger.info(`[FeedCache] Invalidated ${keys.length} global feed keys`);
      }
    } else {
      // In-memory cleanup
      for (const key of memoryCache.keys()) {
        if (key.includes('feed:global:')) {
          memoryCache.delete(key);
          memoryCacheExpiry.delete(key);
        }
      }
    }
  } catch (error) {
    logger.error('[FeedCache] Invalidate global error:', error.message);
  }
};

/**
 * Invalidate all feed caches (for admin operations)
 */
export const invalidateAllFeedCache = async () => {
  try {
    if (useRedis && redisClient) {
      const pattern = 'feed:*';
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
        logger.info(`[FeedCache] Invalidated all ${keys.length} feed keys`);
      }
    } else {
      memoryCache.clear();
      memoryCacheExpiry.clear();
      logger.info('[FeedCache] Cleared in-memory feed cache');
    }
  } catch (error) {
    logger.error('[FeedCache] Invalidate all error:', error.message);
  }
};

/**
 * Invalidate feed caches when new post is created
 * @param {string} authorId - Post author ID
 * @param {string} visibility - Post visibility (public, followers)
 */
export const invalidateFeedOnNewPost = async (authorId, visibility) => {
  // Invalidate global feed for public posts
  if (visibility === 'public') {
    await invalidateGlobalFeedCache();
  }
  
  // Invalidate author's feed cache
  if (authorId) {
    await invalidateUserFeedCache(authorId);
  }
};

/**
 * Clean up old in-memory cache entries
 * Call periodically to prevent memory leaks
 */
export const cleanupMemoryCache = () => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, expiry] of memoryCacheExpiry.entries()) {
    if (now > expiry) {
      memoryCache.delete(key);
      memoryCacheExpiry.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    logger.debug(`[FeedCache] Cleaned ${cleaned} expired memory cache entries`);
  }
};

// Start periodic cleanup (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupMemoryCache, 5 * 60 * 1000);
}

/**
 * Close Redis connection
 */
export const closeFeedCache = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    useRedis = false;
    logger.info('[FeedCache] Redis connection closed');
  }
};

export default {
  initFeedCache,
  getFeedCacheKey,
  getHomeFeedKey,
  getGlobalFeedKey,
  getFollowingFeedKey,
  getCache,
  setCache,
  invalidateUserFeedCache,
  invalidateGlobalFeedCache,
  invalidateAllFeedCache,
  invalidateFeedOnNewPost,
  closeFeedCache
};
