/**
 * Reaction Cache Utility
 * 
 * In-memory cache for reaction counts to reduce database queries.
 * Implements write-through caching with automatic invalidation.
 * 
 * Strategy: Cache reaction counts and user reactions for 5 minutes
 */

/**
 * Cache structure:
 * {
 *   'post:123:counts': { like: 5, love: 2, haha: 1 },
 *   'post:123:user:456': 'like',
 *   'comment:789:counts': { like: 3 }
 * }
 */
const cache = new Map();

/**
 * Cache TTL in milliseconds (5 minutes)
 */
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Cache entry structure
 */
class CacheEntry {
  constructor(value) {
    this.value = value;
    this.timestamp = Date.now();
  }
  
  isExpired() {
    return Date.now() - this.timestamp > CACHE_TTL;
  }
}

/**
 * Get reaction counts for a target
 * 
 * @param {string} targetType - 'post' or 'comment'
 * @param {string} targetId - Target ID
 * @returns {Object|null} Reaction counts or null if not cached
 */
export const getReactionCounts = (targetType, targetId) => {
  const key = `${targetType}:${targetId}:counts`;
  const entry = cache.get(key);
  
  if (!entry || entry.isExpired()) {
    cache.delete(key);
    return null;
  }
  
  return entry.value;
};

/**
 * Set reaction counts for a target
 * 
 * @param {string} targetType - 'post' or 'comment'
 * @param {string} targetId - Target ID
 * @param {Object} counts - Reaction counts { like: 5, love: 2, ... }
 */
export const setReactionCounts = (targetType, targetId, counts) => {
  const key = `${targetType}:${targetId}:counts`;
  cache.set(key, new CacheEntry(counts));
  console.log(`✅ Cached reaction counts for ${targetType}:${targetId}`);
};

/**
 * Get user's reaction on a target
 * 
 * @param {string} targetType - 'post' or 'comment'
 * @param {string} targetId - Target ID
 * @param {string} userId - User ID
 * @returns {string|null} Reaction type or null if not cached
 */
export const getUserReaction = (targetType, targetId, userId) => {
  const key = `${targetType}:${targetId}:user:${userId}`;
  const entry = cache.get(key);
  
  if (!entry || entry.isExpired()) {
    cache.delete(key);
    return null;
  }
  
  return entry.value;
};

/**
 * Set user's reaction on a target
 * 
 * @param {string} targetType - 'post' or 'comment'
 * @param {string} targetId - Target ID
 * @param {string} userId - User ID
 * @param {string|null} reactionType - Reaction type or null if removed
 */
export const setUserReaction = (targetType, targetId, userId, reactionType) => {
  const key = `${targetType}:${targetId}:user:${userId}`;
  
  if (reactionType === null) {
    cache.delete(key);
    console.log(`🗑️ Removed cached reaction for ${targetType}:${targetId}:user:${userId}`);
  } else {
    cache.set(key, new CacheEntry(reactionType));
    console.log(`✅ Cached user reaction for ${targetType}:${targetId}:user:${userId}`);
  }
};

/**
 * Invalidate all cache entries for a target
 * 
 * @param {string} targetType - 'post' or 'comment'
 * @param {string} targetId - Target ID
 */
export const invalidateTarget = (targetType, targetId) => {
  const prefix = `${targetType}:${targetId}:`;
  let count = 0;
  
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
      count++;
    }
  }
  
  console.log(`🗑️ Invalidated ${count} cache entries for ${targetType}:${targetId}`);
};

/**
 * Increment reaction count in cache
 * 
 * @param {string} targetType - 'post' or 'comment'
 * @param {string} targetId - Target ID
 * @param {string} reactionType - Reaction type to increment
 */
export const incrementReactionCount = (targetType, targetId, reactionType) => {
  const counts = getReactionCounts(targetType, targetId);
  if (counts) {
    counts[reactionType] = (counts[reactionType] || 0) + 1;
    setReactionCounts(targetType, targetId, counts);
  }
};

/**
 * Decrement reaction count in cache
 * 
 * @param {string} targetType - 'post' or 'comment'
 * @param {string} targetId - Target ID
 * @param {string} reactionType - Reaction type to decrement
 */
export const decrementReactionCount = (targetType, targetId, reactionType) => {
  const counts = getReactionCounts(targetType, targetId);
  if (counts && counts[reactionType] > 0) {
    counts[reactionType]--;
    setReactionCounts(targetType, targetId, counts);
  }
};

/**
 * Clear all expired entries (cleanup job)
 */
export const clearExpiredEntries = () => {
  let count = 0;

  for (const [key, entry] of cache.entries()) {
    if (entry.isExpired()) {
      cache.delete(key);
      count++;
    }
  }

  if (count > 0) {
    console.log(`🧹 Cleared ${count} expired cache entries`);
  }

  return count;
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => {
  let expired = 0;
  let valid = 0;

  for (const entry of cache.values()) {
    if (entry.isExpired()) {
      expired++;
    } else {
      valid++;
    }
  }

  return {
    total: cache.size,
    valid,
    expired,
    hitRate: 0 // TODO: Track hits/misses
  };
};

/**
 * Clear entire cache (for testing)
 */
export const clearCache = () => {
  cache.clear();
  console.log('🧹 Reaction cache cleared');
};

// Run cleanup every 2 minutes
setInterval(clearExpiredEntries, 2 * 60 * 1000);

