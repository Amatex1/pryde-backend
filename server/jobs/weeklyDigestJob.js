/**
 * Weekly Digest Email Job
 * 
 * Sends weekly summary emails to active users every Sunday.
 * Includes: new followers, engagement stats, top posts from followed users, community highlights.
 * 
 * Schedule: Every Sunday at 10:00 AM (configurable)
 * 
 * Usage:
 *   import { getQueue } from '../queues/index.js';
 *   await getQueue('email').add('weekly-digest', { userId: user._id });
 */

import User from '../models/User.js';
import Post from '../models/Post.js';
import config from '../config/config.js';
import logger from '../utils/logger.js';

/**
 * Get weekly digest data for a user
 * @param {string} userId - User ID
 * @returns {object} Digest data
 */
export const getWeeklyDigestData = async (userId) => {
  const user = await User.findById(userId).select('username displayName email following');
  
  if (!user) return null;
  
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  // Get posts from followed users in the last week
  const followedPosts = await Post.find({
    author: { $in: user.following || [] },
    createdAt: { $gte: oneWeekAgo },
    isAnonymous: { $ne: true }
  })
  .sort({ createdAt: -1 })
  .limit(10)
  .populate('author', 'username displayName profilePhoto');
  
  // Get user's own posts this week
  const myPosts = await Post.countDocuments({
    author: userId,
    createdAt: { $gte: oneWeekAgo }
  });
  
  // Get engagement on user's posts
  const userPosts = await Post.find({
    author: userId,
    createdAt: { $gte: oneWeekAgo }
  }).select('likes comments');
  
  let totalLikes = 0;
  let totalComments = 0;
  userPosts.forEach(post => {
    totalLikes += post.likes?.length || 0;
    totalComments += post.comments?.length || 0;
  });
  
  // Get new followers this week (would need follower tracking)
  // For now, use placeholder
  const newFollowers = 0;
  
  return {
    user,
    period: {
      start: oneWeekAgo,
      end: new Date()
    },
    stats: {
      postsCreated: myPosts,
      likesReceived: totalLikes,
      commentsReceived: totalComments,
      newFollowers
    },
    topPosts: followedPosts.slice(0, 5)
  };
};

/**
 * Generate weekly digest HTML email
 * @param {object} data - Digest data
 * @returns {string} HTML email content
 */
export const generateWeeklyDigestEmail = (data) => {
  const { user, stats, topPosts } = data;
  const appUrl = config.app?.url || 'https://prydeapp.com';
  
  const postsHtml = topPosts.length > 0 ? topPosts.map(post => `
    <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 12px 0;">
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <img src="${post.author?.profilePhoto || `${appUrl}/default-avatar.png`}" 
             style="width: 32px; height: 32px; border-radius: 50%; margin-right: 12px;" 
             alt="${post.author?.username}">
        <div>
          <strong>${post.author?.displayName || post.author?.username}</strong>
          <span style="color: #6b7280; font-size: 12px;">@${post.author?.username}</span>
        </div>
      </div>
      <p style="margin: 0; color: #374151;">${post.content?.substring(0, 150)}${post.content?.length > 150 ? '...' : ''}</p>
      <div style="margin-top: 8px; color: #6b7280; font-size: 12px;">
        ❤️ ${post.likes?.length || 0} 💬 ${post.comments?.length || 0}
      </div>
    </div>
  `).join('') : '<p style="color: #6b7280;">No posts from people you follow this week.</p>';
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #6366f1; margin: 0;">🌈 Pryde Social</h1>
    </div>
    
    <h2 style="color: #1f2937; margin-top: 0;">Your Weekly Digest</h2>
    <p style="color: #4b5563; line-height: 1.6;">Hey ${user.displayName || user.username}! Here's what happened this week on Pryde.</p>
    
    <!-- Stats -->
    <div style="display: flex; justify-content: space-around; margin: 24px 0; background: #f3f4f6; border-radius: 12px; padding: 16px;">
      <div style="text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #6366f1;">${stats.postsCreated}</div>
        <div style="font-size: 12px; color: #6b7280;">Your Posts</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #ec4899;">${stats.likesReceived}</div>
        <div style="font-size: 12px; color: #6b7280;">Likes</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #10b981;">${stats.commentsReceived}</div>
        <div style="font-size: 12px; color: #6b7280;">Comments</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #f59e0b;">${stats.newFollowers}</div>
        <div style="font-size: 12px; color: #6b7280;">New Followers</div>
      </div>
    </div>
    
    <!-- Top Posts from Following -->
    <h3 style="color: #1f2937; margin-top: 24px;">📬 Posts from people you follow</h3>
    ${postsHtml}
    
    <!-- Community Prompt -->
    <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 12px; padding: 24px; margin-top: 24px; text-align: center; color: white;">
      <h3 style="margin: 0 0 8px 0;">💭 This Week's Prompt</h3>
      <p style="margin: 0; font-size: 18px;">What small win did you have this week?</p>
      <a href="${appUrl}/feed" style="display: inline-block; background: white; color: #6366f1; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">Share Your Win</a>
    </div>
    
    <div style="text-align: center; margin-top: 24px;">
      <a href="${appUrl}/settings" style="color: #6b7280; font-size: 12px;">Email preferences</a>
      <span style="color: #d1d5db;"> | </span>
      <a href="${appUrl}/feed" style="color: #6b7280; font-size: 12px;">View in browser</a>
    </div>
  </div>
  
  <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">
    © ${new Date().getFullYear()} Pryde Social - A calmer space for the LGBTQ+ community
  </p>
</body>
</html>
  `;
  
  return html;
}

/**
 * Process weekly digest job
 * @param {object} job - BullMQ job
 */
export async function processWeeklyDigestJob(job) {
  const { userId } = job.data;
  logger.info(`[WeeklyDigest] Processing digest for user ${userId}`);
  
  try {
    const data = await getWeeklyDigestData(userId);
    
    if (!data || !data.user.email) {
      logger.warn(`[WeeklyDigest] No user data for ${userId}`);
      return { success: false, reason: 'no_user_data' };
    }
    
    const html = generateWeeklyDigestEmail(data);
    const subject = `🌈 Your Weekly Pryde Digest - ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
    
    // Import email service
    const { sendEmail } = await import('../services/emailService.js');
    const result = await sendEmail(data.user.email, subject, html);
    
    if (result.success) {
      logger.info(`[WeeklyDigest] Sent to ${data.user.email}`);
      return { success: true };
    } else {
      logger.error(`[WeeklyDigest] Failed: ${result.error}`);
      return { success: false, error: result.error };
    }
  } catch (error) {
    logger.error(`[WeeklyDigest] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Send weekly digest to all active users
 * Should be run once per week (e.g., Sunday morning)
 */
export const sendWeeklyDigestsToAllUsers = async () => {
  logger.info('[WeeklyDigest] Starting weekly digest batch');
  
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  
  // Get users who were active in the last 2 weeks and have email
  const users = await User.find({
    email: { $exists: true, $ne: null },
    lastActivityDate: { $gte: twoWeeksAgo },
    role: { $nin: ['system', 'prompts'] }
  }).select('_id email username displayName').limit(1000);
  
  logger.info(`[WeeklyDigest] Found ${users.length} eligible users`);
  
  let sent = 0;
  let failed = 0;
  
  for (const user of users) {
    try {
      const { sendEmail } = await import('../services/emailService.js');
      const data = await getWeeklyDigestData(user._id);
      
      if (data && data.user.email) {
        const html = generateWeeklyDigestEmail(data);
        const subject = `🌈 Your Weekly Pryde Digest`;
        
        await sendEmail(data.user.email, subject, html);
        sent++;
        
        // Rate limiting - small delay between emails
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      logger.error(`[WeeklyDigest] Failed for user ${user._id}: ${error.message}`);
      failed++;
    }
  }
  
  logger.info(`[WeeklyDigest] Batch complete: ${sent} sent, ${failed} failed`);
  return { sent, failed };
};

export default {
  getWeeklyDigestData,
  generateWeeklyDigestEmail,
  processWeeklyDigestJob,
  sendWeeklyDigestsToAllUsers
};

