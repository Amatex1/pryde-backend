/**
 * Conversation Resurfacing Job
 * 
 * Finds older discussions that have become active again and highlights them.
 * This helps bring attention to conversations that are gaining new engagement.
 * 
 * Schedule: Every 30 minutes (to catch re-engaged conversations)
 * 
 * Usage:
 *   import { findResurfacingConversations } from './jobs/conversationResurfaceJob.js';
 *   const conversations = await findResurfacingConversations();
 */

import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import logger from '../utils/logger.js';

/**
 * Configuration
 */
const CONFIG = {
  // Posts from 2-7 days old that have recent comments
  minAgeHours: 48,
  maxAgeHours: 168, // 7 days
  // At least 2 new comments in last 2 hours
  minRecentComments: 2,
  recentCommentWindowHours: 2,
  // Max conversations to return
  maxResults: 5
};

/**
 * Find conversations that are resurfacing
 * Returns posts that are older but have recent activity
 */
export const findResurfacingConversations = async () => {
  const now = new Date();
  const minAge = new Date(now.getTime() - CONFIG.maxAgeHours * 60 * 60 * 1000);
  const maxAge = new Date(now.getTime() - CONFIG.minAgeHours * 60 * 60 * 1000);
  const recentWindow = new Date(now.getTime() - CONFIG.recentCommentWindowHours * 60 * 60 * 1000);
  
  // Get posts from 2-7 days ago
  const olderPosts = await Post.find({
    createdAt: { $gte: minAge, $lte: maxAge },
    isAnonymous: { $ne: true },
    commentCount: { $gte: 2 }
  })
  .select('_id author content createdAt commentCount lastCommentAt')
  .populate('author', 'username displayName profilePhoto')
  .limit(50);
  
  if (olderPosts.length === 0) {
    return [];
  }
  
  // For each post, check if there are recent comments
  const resurfacing = [];
  
  for (const post of olderPosts) {
    // Count comments in the recent window
    const recentCommentCount = await Comment.countDocuments({
      postId: post._id,
      createdAt: { $gte: recentWindow }
    });
    
    if (recentCommentCount >= CONFIG.minRecentComments) {
      resurfacing.push({
        post,
        recentCommentCount,
        originalPostDate: post.createdAt,
        resurfaceDate: now
      });
    }
  }
  
  // Sort by most recent activity
  resurfacing.sort((a, b) => b.recentCommentCount - a.recentCommentCount);
  
  logger.info(`[ConversationResurface] Found ${resurfacing.length} resurfacing conversations`);
  
  return resurfacing.slice(0, CONFIG.maxResults);
};

/**
 * Get the message for a resurfacing conversation
 */
export const getResurfaceMessage = (conversation) => {
  const { post, recentCommentCount } = conversation;
  const hoursAgo = Math.floor((Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60));
  
  const messages = [
    `🔥 This discussion is active again!`,
    `💬 ${recentCommentCount} new comments on an older post`,
    `🌟 A conversation from ${hoursAgo} hours ago is getting attention`,
    `✨ This post from earlier is seeing new engagement`
  ];
  
  return messages[Math.floor(Math.random() * messages.length)];
};

/**
 * Mark a conversation as surfaced (to avoid repeat notifications)
 * Stores in Redis with TTL
 */
export const markConversationSurfaced = async (postId, redisClient) => {
  if (!redisClient) return;
  
  const key = `conversation:resurfaced:${postId}`;
  await redisClient.setEx(key, 86400, '1'); // 24 hour TTL
};

/**
 * Check if conversation was recently surfaced
 */
export const wasRecentlySurfaced = async (postId, redisClient) => {
  if (!redisClient) return false;
  
  const key = `conversation:resurfaced:${postId}`;
  const exists = await redisClient.exists(key);
  return exists === 1;
};

/**
 * Run the conversation resurfacing job
 * Returns conversations that should be highlighted
 */
export const runConversationResurfaceJob = async () => {
  try {
    const conversations = await findResurfacingConversations();
    
    if (conversations.length === 0) {
      return { surfaced: 0, conversations: [] };
    }
    
    // Format for response
    const result = conversations.map(c => ({
      postId: c.post._id,
      content: c.post.content?.substring(0, 100),
      author: c.post.author,
      commentCount: c.post.commentCount,
      recentComments: c.recentCommentCount,
      message: getResurfaceMessage(c),
      originalAge: Math.floor((Date.now() - new Date(c.post.createdAt).getTime()) / (1000 * 60 * 60))
    }));
    
    return {
      surfaced: result.length,
      conversations: result
    };
  } catch (error) {
    logger.error('[ConversationResurface] Error:', error.message);
    throw error;
  }
};

export default {
  CONFIG,
  findResurfacingConversations,
  getResurfaceMessage,
  markConversationSurfaced,
  wasRecentlySurfaced,
  runConversationResurfaceJob
};

