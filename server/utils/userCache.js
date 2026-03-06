/**
 * User Profile Caching Service
 * 
 * Caches frequently accessed user data in Redis to reduce MongoDB load.
 * Supports 100K+ users by reducing database queries.
 * 
 * Cache Keys:
 * - user:{userId}:profile - Basic user profile
 * - user:{userId}:public - Public profile data
 */

import redisClient from './redisClient.js';
import logger from './logger.js';

const CACHE_TTL = 300; // 5 minutes for user profiles
const PUBLIC_CACHE_TTL = 600; // 10 minutes for public profiles

/**
 * Get cached user profile
 * @param {string} userId - User ID
 * @returns {Promise<object|null>} Cached profile or null
 */
export async function getCachedUserProfile(userId) {
  if (!redisClient || !redisClient.isReady) return null;
  
  try {
    const cached = await redisClient.get(`user:${userId}:profile`);
    if (cached) {
      logger.debug(`[UserCache] HIT for user ${userId}`);
      return JSON.parse(cached);
    }
    logger.debug(`[UserCache] MISS for user ${userId}`);
    return null;
  } catch (error) {
    logger.error('[UserCache] Get error:', error.message);
    return null;
  }
}

/**
 * Cache user profile
 * @param {string} userId - User ID
 * @param {object} profile - User profile data
 */
export async function cacheUserProfile(userId, profile) {
  if (!redisClient || !redisClient.isReady) return;
  
  try {
    await redisClient.setEx(
      `user:${userId}:profile`,
      CACHE_TTL,
      JSON.stringify(profile)
    );
    logger.debug(`[UserCache] Cached profile for user ${userId}`);
  } catch (error) {
    logger.error('[UserCache] Set error:', error.message);
  }
}

/**
 * Get cached public profile
 * @param {string} userId - User ID
 * @returns {Promise<object|null>} Cached public profile or null
 */
export async function getCachedPublicProfile(userId) {
  if (!redisClient || !redisClient.isReady) return null;
  
  try {
    const cached = await redisClient.get(`user:${userId}:public`);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    logger.error('[UserCache] Get public error:', error.message);
    return null;
  }
}

/**
 * Cache public profile (less sensitive data)
 * @param {string} userId - User ID
 * @param {object} profile - Public profile data
 */
export async function cachePublicProfile(userId, profile) {
  if (!redisClient || !redisClient.isReady) return;
  
  try {
    await redisClient.setEx(
      `user:${userId}:public`,
      PUBLIC_CACHE_TTL,
      JSON.stringify(profile)
    );
  } catch (error) {
    logger.error('[UserCache] Set public error:', error.message);
  }
}

/**
 * Invalidate user cache (when profile is updated)
 * @param {string} userId - User ID
 */
export async function invalidateUserCache(userId) {
  if (!redisClient || !redisClient.isReady) return;
  
  try {
    await redisClient.del(`user:${userId}:profile`);
    await redisClient.del(`user:${userId}:public`);
    logger.debug(`[UserCache] Invalidated cache for user ${userId}`);
  } catch (error) {
    logger.error('[UserCache] Invalidate error:', error.message);
  }
}

/**
 * Warm cache with user profiles
 * @param {string[]} userIds - Array of user IDs to cache
 * @param {Function} fetchProfileFn - Function to fetch profile from DB
 */
export async function warmUserCache(userIds, fetchProfileFn) {
  if (!redisClient || !redisClient.isReady) return;
  
  const pipeline = redisClient.pipeline();
  
  for (const userId of userIds) {
    pipeline.get(`user:${userId}:profile`);
  }
  
  try {
    const results = await pipeline.exec();
    
    // Find missing profiles
    const missingIds = [];
    results.forEach((result, index) => {
      if (!result[1]) {
        missingIds.push(userIds[index]);
      }
    });
    
    // Fetch and cache missing profiles
    for (const userId of missingIds) {
      const profile = await fetchProfileFn(userId);
      if (profile) {
        await cacheUserProfile(userId, profile);
      }
    }
    
    logger.info(`[UserCache] Warmed cache for ${missingIds.length} users`);
  } catch (error) {
    logger.error('[UserCache] Warm error:', error.message);
  }
}

export default {
  getCachedUserProfile,
  cacheUserProfile,
  getCachedPublicProfile,
  cachePublicProfile,
  invalidateUserCache,
  warmUserCache
};
