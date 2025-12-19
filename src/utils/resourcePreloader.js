/**
 * Resource Preloader - Reduce network waterfall
 * 
 * STRATEGY:
 * 1. Preload critical API endpoints in parallel
 * 2. Prefetch user data, posts, notifications
 * 3. Cache results for instant display
 * 4. Reduce perceived latency
 * 
 * USAGE:
 * - Call preloadCriticalResources() on app load
 * - Call preloadFeedData() before navigating to feed
 * - Use cached data to show UI instantly
 */

import api from './api';
import logger from './logger';

// Cache for preloaded data
const cache = {
  user: null,
  posts: null,
  notifications: null,
  trending: null,
  timestamp: null
};

// Cache TTL (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Check if cache is still valid
 */
function isCacheValid() {
  if (!cache.timestamp) return false;
  return Date.now() - cache.timestamp < CACHE_TTL;
}

/**
 * Preload critical resources in parallel
 * Call this on app load (after auth bootstrap)
 */
export async function preloadCriticalResources() {
  try {
    logger.debug('🚀 Preloading critical resources...');

    // Preload in parallel for speed
    const [userResponse, notificationsResponse] = await Promise.allSettled([
      api.get('/auth/me').catch(err => {
        logger.debug('User preload failed (non-critical):', err);
        return null;
      }),
      api.get('/notifications?limit=10').catch(err => {
        logger.debug('Notifications preload failed (non-critical):', err);
        return null;
      })
    ]);

    // Cache successful responses
    if (userResponse.status === 'fulfilled' && userResponse.value) {
      cache.user = userResponse.value.data;
      logger.debug('✅ User data preloaded');
    }

    if (notificationsResponse.status === 'fulfilled' && notificationsResponse.value) {
      cache.notifications = notificationsResponse.value.data;
      logger.debug('✅ Notifications preloaded');
    }

    cache.timestamp = Date.now();
    logger.debug('🎉 Critical resources preloaded');
  } catch (error) {
    logger.warn('Resource preload failed (non-critical):', error);
    // Don't throw - this is just an optimization
  }
}

/**
 * Preload feed data
 * Call this before navigating to feed
 */
export async function preloadFeedData() {
  try {
    logger.debug('🚀 Preloading feed data...');

    // Preload in parallel
    const [postsResponse, trendingResponse] = await Promise.allSettled([
      api.get('/feed?page=1&limit=10').catch(err => {
        logger.debug('Posts preload failed (non-critical):', err);
        return null;
      }),
      api.get('/tags/trending').catch(err => {
        logger.debug('Trending preload failed (non-critical):', err);
        return null;
      })
    ]);

    // Cache successful responses
    if (postsResponse.status === 'fulfilled' && postsResponse.value) {
      cache.posts = postsResponse.value.data;
      logger.debug('✅ Posts preloaded');
    }

    if (trendingResponse.status === 'fulfilled' && trendingResponse.value) {
      cache.trending = trendingResponse.value.data;
      logger.debug('✅ Trending preloaded');
    }

    cache.timestamp = Date.now();
    logger.debug('🎉 Feed data preloaded');
  } catch (error) {
    logger.warn('Feed preload failed (non-critical):', error);
  }
}

/**
 * Get cached user data
 */
export function getCachedUser() {
  return isCacheValid() ? cache.user : null;
}

/**
 * Get cached posts
 */
export function getCachedPosts() {
  return isCacheValid() ? cache.posts : null;
}

/**
 * Get cached notifications
 */
export function getCachedNotifications() {
  return isCacheValid() ? cache.notifications : null;
}

/**
 * Get cached trending
 */
export function getCachedTrending() {
  return isCacheValid() ? cache.trending : null;
}

/**
 * Clear cache
 */
export function clearCache() {
  cache.user = null;
  cache.posts = null;
  cache.notifications = null;
  cache.trending = null;
  cache.timestamp = null;
  logger.debug('🗑️ Resource cache cleared');
}

