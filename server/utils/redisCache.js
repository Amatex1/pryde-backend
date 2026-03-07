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

// Cache metrics for hit rate monitoring
const cacheMetrics = {
  hits: 0,
  misses: 0,
  errors: 0,
  sets: 0,
  deletes: 0,
  lastReset: Date.now(),
  
  /**
   * Get current hit rate percentage
   */
  getHitRate() {
    const total = this.hits + this.misses;
    return total > 0 ? ((this.hits / total) * 100).toFixed(2) : 0;
  },
  
  /**
   * Get metrics summary
   */
  getMetrics() {
    return {
      hits: this.hits,
      misses: this.misses,
      errors: this.errors,
      sets: this.sets,
      deletes: this.deletes,
      hitRate: this.getHitRate() + '%',
      uptimeMs: Date.now() - this.lastReset
    };
  },
  
  /**
   * Reset metrics
   */
  reset() {
    this.hits = 0;
    this.misses = 0;
    this.errors = 0;
    this.sets = 0;
    this.deletes = 0;
    this.lastReset = Date.now();
  }
};

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
    cacheMetrics.misses++;
    return null;
  }

  try {
    const cached = await redisClient.get(key);
    if (cached) {
      cacheMetrics.hits++;
      logger.debug(`[RedisCache] Cache HIT: ${key}`);
      return JSON.parse(cached);
    }
    cacheMetrics.misses++;
    logger.debug(`[RedisCache] Cache MISS: ${key}`);
    return null;
  } catch (error) {
    cacheMetrics.errors++;
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
 * Feed Cache Warming
 * Pre-warms cache for popular feeds to improve response times
 */

const WARMUP_CONFIG = {
  // Pages to pre-warm per feed type
  pagesToWarm: [1, 2],
  // TTL for warmed cache (slightly shorter than regular cache)
  warmupTtlSeconds: 45,
  // Maximum time to spend warming (ms)
  maxWarmupTimeMs: 5000,
  // Batch size for warming
  batchSize: 10
};

/**
 * Warm cache for a specific user's feed
 * Call this after user logs in or when their feed is likely to be requested
 */
export const warmUserFeed = async (userId, fetchFeedFn) => {
  if (!isRedisConnected() || !fetchFeedFn) {
    return false;
  }

  try {
    for (const page of WARMUP_CONFIG.pagesToWarm) {
      const key = getFeedCacheKey('following', userId, page);
      
      // Check if already cached
      const existing = await redisClient.get(key);
      if (existing) {
        continue; // Skip if already cached
      }

      // Fetch fresh data
      const feedData = await fetchFeedFn(userId, page);
      if (feedData) {
        await redisClient.setEx(key, WARMUP_CONFIG.warmupTtlSeconds, JSON.stringify(feedData));
        logger.debug(`[RedisCache] Warmed feed for user ${userId}, page ${page}`);
      }
    }
    return true;
  } catch (error) {
    logger.error('[RedisCache] Feed warmup error:', error.message);
    return false;
  }
};

/**
 * Warm global feed cache
 * Call this periodically or after significant content changes
 */
export const warmGlobalFeed = async (fetchFeedFn) => {
  if (!isRedisConnected() || !fetchFeedFn) {
    return false;
  }

  try {
    for (const page of WARMUP_CONFIG.pagesToWarm) {
      const key = getFeedCacheKey('global', null, page);
      
      const existing = await redisClient.get(key);
      if (existing) {
        continue;
      }

      const feedData = await fetchFeedFn(page);
      if (feedData) {
        await redisClient.setEx(key, WARMUP_CONFIG.warmupTtlSeconds, JSON.stringify(feedData));
        logger.debug(`[RedisCache] Warmed global feed, page ${page}`);
      }
    }
    return true;
  } catch (error) {
    logger.error('[RedisCache] Global feed warmup error:', error.message);
    return false;
  }
};

/**
 * Scheduled feed cache warming
 * Should be called periodically (e.g., every 5 minutes)
 */
export const scheduledFeedWarmup = async (services) => {
  if (!isRedisConnected()) {
    return;
  }

  const startTime = Date.now();
  logger.info('[RedisCache] Starting scheduled feed warmup...');

  try {
    // Warm trending feed
    if (services?.trendingService) {
      for (const page of WARMUP_CONFIG.pagesToWarm) {
        const key = getTrendingFeedKey(page);
        const trendingData = await services.trendingService.getTrendingPosts(page);
        if (trendingData) {
          await redisClient.setEx(key, WARMUP_CONFIG.warmupTtlSeconds, JSON.stringify(trendingData));
        }
      }
    }

    // Warm global feed
    if (services?.feedService) {
      await warmGlobalFeed(services.feedService.getGlobalFeed.bind(services.feedService));
    }

    const elapsed = Date.now() - startTime;
    logger.info(`[RedisCache] Scheduled feed warmup completed in ${elapsed}ms`);
  } catch (error) {
    logger.error('[RedisCache] Scheduled warmup error:', error.message);
  }
};

/**
 * Get cache warming status
 */
export const getWarmupStatus = () => {
  return {
    config: WARMUP_CONFIG,
    redisConnected: isRedisConnected()
  };
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
