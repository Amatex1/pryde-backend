/**
 * Cache Invalidation Service
 * 
 * Handles real-time cache invalidation via Socket.IO
 * when new content is created that affects cached feeds.
 */

import { deleteCache, deletePattern } from './redisCache.js';
import logger from './logger.js';

/**
 * Invalidate feed caches when a new post is created
 * @param {Object} post - The newly created post
 * @param {Object} io - Socket.IO instance
 */
export const invalidateFeedOnNewPost = async (post, io) => {
  try {
    const authorId = post.author?._id?.toString() || post.author?.toString();
    
    if (!authorId) {
      logger.warn('[CacheInvalidation] Cannot invalidate - no author ID');
      return;
    }
    
    logger.debug(`[CacheInvalidation] Invalidating feeds for new post by ${authorId}`);
    
    // 1. Invalidate author's profile feed cache
    await deleteCache(`feed:profile:${authorId}:page1`);
    
    // 2. Get all followers and invalidate their home feeds
    // Note: In production, you'd want to get this from Redis or a more efficient source
    // For now, we emit an event to let clients know to refresh
    
    if (io) {
      // Emit event to all connected clients to refresh their feeds
      // The frontend can decide whether to refetch based on its current state
      io.emit('feed:new_post', {
        postId: post._id,
        authorId,
        timestamp: post.createdAt
      });
      
      // Also emit to specific user's room if we know who might be affected
      // In a real implementation, you'd track who's following whom
    }
    
    logger.info(`[CacheInvalidation] Feed invalidation complete for post ${post._id}`);
  } catch (error) {
    logger.error(`[CacheInvalidation] Error invalidating feed:`, error.message);
  }
};

/**
 * Invalidate caches when a post is liked/unliked
 * @param {string} postId - Post ID
 * @param {string} authorId - Author of the post
 * @param {Object} io - Socket.IO instance
 */
export const invalidateFeedOnReaction = async (postId, authorId, io) => {
  try {
    // Invalidate author's profile feed (likes count changed)
    if (authorId) {
      await deleteCache(`feed:profile:${authorId}:page1`);
    }
    
    // Notify relevant clients
    if (io) {
      io.emit('post:reaction_update', {
        postId,
        authorId,
        timestamp: Date.now()
      });
    }
  } catch (error) {
    logger.error(`[CacheInvalidation] Error on reaction:`, error.message);
  }
};

/**
 * Invalidate caches when user follows/unfollows
 * @param {string} followerId - User who followed
 * @param {string} followingId - User who was followed
 * @param {Object} io - Socket.IO instance
 */
export const invalidateFeedOnFollow = async (followerId, followingId, io) => {
  try {
    // Invalidate follower's home feed (new person to see posts from)
    await deleteCache(`feed:home:${followerId}:following:page1`);
    
    // Invalidate followed user's profile feed
    await deleteCache(`feed:profile:${followingId}:page1`);
    
    // Notify clients
    if (io) {
      io.emit('user:follow_update', {
        followerId,
        followingId,
        timestamp: Date.now()
      });
    }
  } catch (error) {
    logger.error(`[CacheInvalidation] Error on follow:`, error.message);
  }
};

/**
 * Clear all feed caches (admin action)
 */
export const clearAllFeedCaches = async () => {
  try {
    // Delete all feed-related cache keys
    const deleted = await deletePattern('feed:*');
    logger.info(`[CacheInvalidation] Cleared ${deleted} feed cache entries`);
    return deleted;
  } catch (error) {
    logger.error(`[CacheInvalidation] Error clearing caches:`, error.message);
    throw error;
  }
};

export default {
  invalidateFeedOnNewPost,
  invalidateFeedOnReaction,
  invalidateFeedOnFollow,
  clearAllFeedCaches
};
