/**
 * Reaction Analytics Utility
 * 
 * Track and analyze reaction patterns for insights.
 * Helps understand user engagement and content performance.
 */

import Post from '../models/Post.js';
import Comment from '../models/Comment.js';

/**
 * Get reaction breakdown for a post
 * 
 * @param {string} postId - Post ID
 * @returns {Object} Reaction breakdown
 */
export const getPostReactionBreakdown = async (postId) => {
  const post = await Post.findById(postId).lean();
  
  if (!post || !post.reactions) {
    return { total: 0, breakdown: {} };
  }
  
  const breakdown = {};
  let total = 0;
  
  for (const [emoji, userIds] of post.reactions.entries()) {
    breakdown[emoji] = userIds.length;
    total += userIds.length;
  }
  
  return { total, breakdown };
};

/**
 * Get top reactions for a user's posts
 * 
 * @param {string} userId - User ID
 * @param {number} limit - Number of posts to analyze
 * @returns {Object} Top reactions
 */
export const getUserTopReactions = async (userId, limit = 100) => {
  const posts = await Post.find({ authorId: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  
  const reactionCounts = {};
  let totalReactions = 0;
  
  for (const post of posts) {
    if (post.reactions) {
      for (const [emoji, userIds] of post.reactions.entries()) {
        reactionCounts[emoji] = (reactionCounts[emoji] || 0) + userIds.length;
        totalReactions += userIds.length;
      }
    }
  }
  
  // Sort by count
  const sorted = Object.entries(reactionCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([emoji, count]) => ({
      emoji,
      count,
      percentage: ((count / totalReactions) * 100).toFixed(1)
    }));
  
  return {
    totalReactions,
    topReactions: sorted,
    postsAnalyzed: posts.length
  };
};

/**
 * Get reaction trends over time
 * 
 * @param {string} userId - User ID
 * @param {number} days - Number of days to analyze
 * @returns {Array} Daily reaction counts
 */
export const getReactionTrends = async (userId, days = 30) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const posts = await Post.find({
    authorId: userId,
    createdAt: { $gte: startDate }
  }).lean();
  
  const dailyCounts = {};
  
  for (const post of posts) {
    const date = post.createdAt.toISOString().split('T')[0];
    
    if (!dailyCounts[date]) {
      dailyCounts[date] = 0;
    }
    
    if (post.reactions) {
      for (const userIds of post.reactions.values()) {
        dailyCounts[date] += userIds.length;
      }
    }
  }
  
  // Fill in missing dates with 0
  const trends = [];
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    trends.push({
      date: dateStr,
      count: dailyCounts[dateStr] || 0
    });
  }
  
  return trends.reverse();
};

/**
 * Get engagement rate for user's posts
 * 
 * @param {string} userId - User ID
 * @param {number} limit - Number of posts to analyze
 * @returns {Object} Engagement metrics
 */
export const getEngagementRate = async (userId, limit = 100) => {
  const posts = await Post.find({ authorId: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  
  let totalReactions = 0;
  let totalComments = 0;
  let totalPosts = posts.length;
  
  for (const post of posts) {
    if (post.reactions) {
      for (const userIds of post.reactions.values()) {
        totalReactions += userIds.length;
      }
    }
    totalComments += post.commentCount || 0;
  }
  
  const avgReactionsPerPost = totalPosts > 0 ? totalReactions / totalPosts : 0;
  const avgCommentsPerPost = totalPosts > 0 ? totalComments / totalPosts : 0;
  const totalEngagement = totalReactions + totalComments;
  const avgEngagementPerPost = totalPosts > 0 ? totalEngagement / totalPosts : 0;
  
  return {
    totalPosts,
    totalReactions,
    totalComments,
    totalEngagement,
    avgReactionsPerPost: avgReactionsPerPost.toFixed(2),
    avgCommentsPerPost: avgCommentsPerPost.toFixed(2),
    avgEngagementPerPost: avgEngagementPerPost.toFixed(2)
  };
};

/**
 * Get most engaging posts
 * 
 * @param {string} userId - User ID
 * @param {number} limit - Number of posts to return
 * @returns {Array} Top posts by engagement
 */
export const getMostEngagingPosts = async (userId, limit = 10) => {
  const posts = await Post.find({ authorId: userId })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  
  const postsWithEngagement = posts.map(post => {
    let reactionCount = 0;
    if (post.reactions) {
      for (const userIds of post.reactions.values()) {
        reactionCount += userIds.length;
      }
    }
    
    const commentCount = post.commentCount || 0;
    const totalEngagement = reactionCount + commentCount;
    
    return {
      _id: post._id,
      content: post.content?.substring(0, 100),
      createdAt: post.createdAt,
      reactionCount,
      commentCount,
      totalEngagement
    };
  });
  
  return postsWithEngagement
    .sort((a, b) => b.totalEngagement - a.totalEngagement)
    .slice(0, limit);
};

