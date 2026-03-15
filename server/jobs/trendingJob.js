/**
 * Trending Job
 * 
 * Runs every 15 minutes to compute trending posts.
 * Computes score: reactionCount + (commentCount * 2)
 * Stores top 20 posts in Redis key: trending:day
 * 
 * Usage:
 * - Run manually: node jobs/trendingJob.js
 * - Or integrate with node-cron for scheduled runs
 */

import Post from '../models/Post.js';
import { getRedisClient, isRedisConnected } from '../utils/redisCache.js';
import logger from '../utils/logger.js';

// Trending configuration
const TRENDING_CONFIG = {
  redisKey: 'trending:day',
  limit: 20,
  timeWindowHours: 24,
  scoreWeights: {
    reaction: 1,
    comment: 2
  }
};

/**
 * Compute score for a post
 * Score = reactionCount + (commentCount * 2)
 */
const computeTrendingScore = (post) => {
  const reactionCount = post.reactions?.length || 0;
  const commentCount = post.comments?.length || 0;
  
  return (
    (reactionCount * TRENDING_CONFIG.scoreWeights.reaction) +
    (commentCount * TRENDING_CONFIG.scoreWeights.comment)
  );
};

/**
 * Main trending job function
 */
export const runTrendingJob = async () => {
  const startTime = Date.now();
  logger.info('[TrendingJob] Starting trending posts computation...');
  
  try {
    // Check Redis connection
    if (!isRedisConnected()) {
      logger.warn('[TrendingJob] Redis not connected, skipping trending computation');
      return null;
    }
    
    const redisClient = getRedisClient();
    
    // IDEMPOTENT: Skip posts already scored recently (TASK #7)
    const cutoff = new Date(Date.now() - 15 * 60 * 1000); // 15min ago
    const timeWindowStart = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h window
    
    const posts = await Post.find({
      visibility: 'public',
      createdAt: { $gte: timeWindowStart },
      groupId: null,
      circleId: null,
      lastTrendingScoreAt: { $lt: cutoff } // Only unscored recently
    })
    .select('_id author content createdAt reactions comments')
    .populate('author', 'username displayName profilePhoto')
    .lean();
    
    if (posts.length === 0) {
      logger.debug('[TrendingJob] No posts found in time window');
      
      // Clear trending if no posts
      await redisClient.del(TRENDING_CONFIG.redisKey);
      return null;
    }
    
    // Compute scores for each post
    const scoredPosts = posts.map(post => ({
      ...post,
      trendingScore: computeTrendingScore(post)
    }));
    
    // Sort by score descending
    scoredPosts.sort((a, b) => b.trendingScore - a.trendingScore);
    
    // Take top N posts
    const topPosts = scoredPosts.slice(0, TRENDING_CONFIG.limit);
    
    // Format for storage (remove heavy fields, keep essentials)
    const trendingData = topPosts.map(post => ({
      _id: post._id,
      author: post.author,
      content: post.content?.substring(0, 200), // Truncate long content
      trendingScore: post.trendingScore,
      createdAt: post.createdAt
    }));
    
    // Store in Redis with 1 hour TTL (refreshed every 15 min)
    const ttlSeconds = 60 * 60; // 1 hour
    await redisClient.setEx(
      TRENDING_CONFIG.redisKey,
      ttlSeconds,
      JSON.stringify(trendingData)
    );
    
    const elapsed = Date.now() - startTime;
    logger.info(
      `[TrendingJob] Completed in ${elapsed}ms. Top post score: ${topPosts[0]?.trendingScore || 0}`
    );
    
    return trendingData;
    
  } catch (error) {
    logger.error('[TrendingJob] Error computing trending:', error.message);
    throw error;
  }
};

/**
 * Get trending posts from cache
 */
export const getTrendingPosts = async () => {
  try {
    if (!isRedisConnected()) {
      return null;
    }
    
    const redisClient = getRedisClient();
    const cached = await redisClient.get(TRENDING_CONFIG.redisKey);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    return null;
  } catch (error) {
    logger.error('[TrendingJob] Error getting trending:', error.message);
    return null;
  }
};

// Run if executed directly
if (process.argv[1]?.includes('trendingJob')) {
  runTrendingJob()
    .then(() => {
      console.log('Trending job completed');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Trending job failed:', err);
      process.exit(1);
    });
}

export default {
  runTrendingJob,
  getTrendingPosts
};

