/**
 * Feed Builder Service
 * 
 * Implements fan-out-on-write feed architecture.
 * Pre-builds feed entries for followers when a post is created.
 * 
 * Safety Constraints:
 * - Runs asynchronously via setImmediate (non-blocking)
 * - MAX_FEED_FANOUT limit prevents excessive database writes
 * - Logs execution time and follower count for monitoring
 */

import FeedEntry from '../models/FeedEntry.js';
import User from '../models/User.js';
import Post from '../models/Post.js';
import { deleteCache, invalidateUserFeedCache, invalidateGlobalFeedCache } from '../utils/redisCache.js';
import logger from '../utils/logger.js';

// Safety limit: Maximum number of followers to fan out to per post
const MAX_FEED_FANOUT = 500;

// Cache TTL for personalized feed
const FEED_CACHE_TTL = 60;

/**
 * Calculate feed score for a post
 * 
 * Score = reactionCount + (commentCount * 2) + freshnessScore
 * 
 * @param {Object} post - Post document
 * @returns {number} Score value
 */
export const calculateFeedScore = (post) => {
  const now = new Date();
  const createdAt = new Date(post.createdAt);
  
  // Calculate hours since post was created
  const hoursSinceCreated = (now - createdAt) / (1000 * 60 * 60);
  
  // Freshness score: newer posts get higher scores
  // max(0, 100 - hoursSinceCreated) ensures fresh posts score higher
  const freshnessScore = Math.max(0, 100 - hoursSinceCreated);
  
  // Count reactions (both likes and emoji reactions)
  const reactionCount = (post.reactions?.length || 0) + (post.likes?.length || 0);
  
  // Count comments (top-level comments in the embedded array)
  const commentCount = post.comments?.length || 0;
  
  // Calculate final score
  const score = reactionCount + (commentCount * 2) + freshnessScore;
  
  return Math.round(score);
};

/**
 * Handle post created event - build feed entries for followers
 * 
 * This function is called asynchronously via setImmediate to avoid
 * blocking the post creation response.
 * 
 * @param {Object} post - Newly created post document
 * @returns {Promise<void>}
 */
export const handlePostCreated = async (post) => {
  const startTime = Date.now();
  
  try {
    const authorId = post.author;
    
    // Skip if author is missing (shouldn't happen)
    if (!authorId) {
      logger.warn('[FeedBuilder] Post has no author, skipping feed build');
      return;
    }
    
    // Skip if post is not public or followers visibility
    // Only public and followers posts should appear in feeds
    if (!['public', 'followers'].includes(post.visibility)) {
      logger.debug('[FeedBuilder] Post visibility not in feed, skipping:', post.visibility);
      return;
    }
    
    // Skip group and circle posts from personal feeds
    if (post.groupId || post.circleId) {
      logger.debug('[FeedBuilder] Group/Circle post, skipping personal feed');
      return;
    }
    
    // Get author to find followers
    const author = await User.findById(authorId).select('followers').lean();
    
    if (!author || !author.followers || author.followers.length === 0) {
      logger.debug('[FeedBuilder] Author has no followers, skipping feed build');
      return;
    }
    
    // Apply fan-out safety limit
    const followers = author.followers.slice(0, MAX_FEED_FANOUT);
    const followerCount = followers.length;
    
    logger.debug(`[FeedBuilder] Processing ${followerCount} followers (max: ${MAX_FEED_FANOUT})`);
    
    // Calculate score for this post
    const score = calculateFeedScore(post);
    const postId = post._id;
    const createdAt = new Date();
    
    // Build feed entries for each follower
    const feedEntries = followers.map(followerId => ({
      userId: followerId,
      postId: postId,
      score: score,
      createdAt: createdAt
    }));
    
    // Insert feed entries (using insertManySafe for duplicate handling)
    if (feedEntries.length > 0) {
      await FeedEntry.insertManySafe(feedEntries);
      logger.debug(`[FeedBuilder] Inserted ${feedEntries.length} feed entries`);
    }
    
    // Invalidate Redis cache for all affected followers
    // This ensures they get fresh feed on next request
    await invalidateFollowerCaches(followers);
    
    // Also invalidate author's profile feed cache
    await invalidateUserFeedCache(authorId.toString());
    
    // Invalidate global feed cache
    await invalidateGlobalFeedCache();
    
    const executionTime = Date.now() - startTime;
    
    // Log execution metrics
    logger.info(`[FeedBuilder] Executed | postId: ${postId} | followers processed: ${followerCount} | time: ${executionTime}ms`);
    
  } catch (error) {
    logger.error('[FeedBuilder] Error building feed:', error.message);
    // Don't throw - this runs asynchronously and shouldn't affect post creation
  }
};

/**
 * Invalidate cache for multiple followers efficiently
 * 
 * @param {Array} followers - Array of follower user IDs
 */
const invalidateFollowerCaches = async (followers) => {
  try {
    // Batch invalidate using Redis KEYS pattern for better performance
    // Since invalidateUserFeedCache uses KEYS internally, we call it per user
    // but we could optimize this with Redis pipeline in the future
    
    const cachePromises = followers.map(followerId => 
      invalidateUserFeedCache(followerId.toString())
    );
    
    await Promise.all(cachePromises);
    
  } catch (error) {
    logger.warn('[FeedBuilder] Error invalidating follower caches:', error.message);
  }
};

/**
 * Rebuild feed entries for a user
 * 
 * Used when recalculating feeds is needed (e.g., after follower changes)
 * 
 * @param {string|ObjectId} userId - User ID
 * @returns {Promise<number>} Number of entries created
 */
export const rebuildUserFeed = async (userId) => {
  try {
    // Get users that this user follows
    const user = await User.findById(userId).select('following').lean();
    
    if (!user || !user.following || user.following.length === 0) {
      return 0;
    }
    
    // Get posts from followed users
    const posts = await Post.find({
      author: { $in: user.following },
      visibility: { $in: ['public', 'followers'] },
      groupId: null,
      circleId: null
    })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
    
    // Clear existing feed entries for this user
    await FeedEntry.deleteMany({ userId });
    
    // Build new feed entries
    const feedEntries = posts.map(post => ({
      userId: userId,
      postId: post._id,
      score: calculateFeedScore(post),
      createdAt: new Date()
    }));
    
    if (feedEntries.length > 0) {
      await FeedEntry.insertManySafe(feedEntries);
    }
    
    // Invalidate cache
    await invalidateUserFeedCache(userId.toString());
    
    logger.info(`[FeedBuilder] Rebuilt feed for user ${userId}: ${feedEntries.length} entries`);
    
    return feedEntries.length;
    
  } catch (error) {
    logger.error('[FeedBuilder] Error rebuilding user feed:', error.message);
    throw error;
  }
};

/**
 * Update feed scores for a post's entries
 * 
 * Called when post engagement changes (new reaction, comment, etc.)
 * 
 * @param {string|ObjectId} postId - Post ID
 * @returns {Promise<number>} Number of entries updated
 */
export const updatePostFeedScore = async (postId) => {
  try {
    // Fetch the post to recalculate score
    const post = await Post.findById(postId).lean();
    
    if (!post) {
      return 0;
    }
    
    const newScore = calculateFeedScore(post);
    
    // Update all feed entries for this post
    const result = await FeedEntry.updateScore(postId, newScore);
    
    // Invalidate all affected user caches
    const entries = await FeedEntry.find({ postId }).lean();
    const userIds = [...new Set(entries.map(e => e.userId.toString()))];
    
    for (const userId of userIds) {
      await invalidateUserFeedCache(userId);
    }
    
    logger.debug(`[FeedBuilder] Updated score for post ${postId}: ${result.modifiedCount} entries`);
    
    return result.modifiedCount;
    
  } catch (error) {
    logger.error('[FeedBuilder] Error updating post feed score:', error.message);
    throw error;
  }
};

export default {
  handlePostCreated,
  calculateFeedScore,
  rebuildUserFeed,
  updatePostFeedScore
};

