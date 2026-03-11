/**
 * Thank You Moments Service
 * 
 * Recognizes users for their contributions to the community.
 * Sends "thank you for contributing" moments when users:
 * - Make their first post
 * - Get their first comment
 * - Reach engagement milestones
 * 
 * Usage:
 *   import { checkAndSendThankYou } from './services/thankYouService.js';
 *   await checkAndSendThankYou(userId, 'first_post');
 */

import User from '../models/User.js';
import Notification from '../models/Notification.js';
import logger from '../utils/logger.js';
import { emitNotificationCreated } from '../utils/notificationEmitter.js';

/**
 * Thank you message templates
 */
const THANK_YOU_MESSAGES = {
  first_post: {
    emoji: '✨',
    title: 'Your First Post!',
    message: 'Thank you for sharing with the community! Your voice matters here.'
  },
  first_comment: {
    emoji: '💬',
    title: 'Welcome to the Conversation!',
    message: 'Thanks for commenting! Engagement is what makes our community thrive.'
  },
  ten_posts: {
    emoji: '🎉',
    title: '10 Posts Milestone!',
    message: "You've shared 10 posts with us. That's amazing contribution!"
  },
  fifty_posts: {
    emoji: '🌟',
    title: '50 Posts Champion!',
    message: "50 posts! You're a core part of this community. Thank you!"
  },
  hundred_posts: {
    emoji: '💜',
    title: 'Century Club!',
    message: "100 posts! You've shown incredible dedication. We're grateful for you."
  },
  active_member: {
    emoji: '🌈',
    title: 'Thank You!',
    message: 'Thanks for being an active part of our community this week!'
  }
};

/**
 * Track which milestones user has achieved
 */
const userMilestones = new Map();

/**
 * Get user's milestone tracking data
 */
const getUserMilestones = (userId) => {
  if (!userMilestones.has(userId)) {
    userMilestones.set(userId, {
      posts: 0,
      comments: 0,
      thankYouSent: new Set()
    });
  }
  return userMilestones.get(userId);
};

/**
 * Check and send thank you notification
 * @param {string} userId - User ID
 * @param {string} milestoneType - Type of milestone to check
 * @param {object} io - Socket.io instance for real-time
 */
export const checkAndSendThankYou = async (userId, milestoneType, io = null) => {
  const milestones = getUserMilestones(userId);
  
  // Check if already sent this type of thank you
  if (milestones.thankYouSent.has(milestoneType)) {
    return { sent: false, reason: 'already_sent' };
  }
  
  const template = THANK_YOU_MESSAGES[milestoneType];
  if (!template) {
    return { sent: false, reason: 'unknown_type' };
  }
  
  try {
    // Get user
    const user = await User.findById(userId).select('username displayName email');
    
    if (!user) {
      return { sent: false, reason: 'no_user' };
    }
    
    // Create in-app notification
    const notification = await Notification.create({
      recipient: userId,
      sender: null, // System notification
      type: 'thank_you',
      message: `${template.emoji} ${template.title} ${template.message}`,
      data: {
        milestoneType,
        thankYou: true
      }
    });
    
    // Mark as sent
    milestones.thankYouSent.add(milestoneType);
    
    // Emit real-time if available
    if (io) {
      const populated = await Notification.findById(notification._id)
        .populate('sender', 'username displayName profilePhoto');
      
      emitNotificationCreated(io, userId, populated);
    }
    
    logger.info(`[ThankYou] Sent ${milestoneType} thank you to user ${userId}`);
    
    return { sent: true, notification };
  } catch (error) {
    logger.error(`[ThankYou] Error sending thank you: ${error.message}`);
    return { sent: false, error: error.message };
  }
};

/**
 * Check post milestone
 * Call this when a user creates a post
 */
export const checkPostMilestone = async (userId, postCount, io = null) => {
  const milestones = getUserMilestones(userId);
  milestones.posts = postCount;
  
  // Check milestones
  if (postCount === 1 && !milestones.thankYouSent.has('first_post')) {
    return checkAndSendThankYou(userId, 'first_post', io);
  }
  else if (postCount === 10 && !milestones.thankYouSent.has('ten_posts')) {
    return checkAndSendThankYou(userId, 'ten_posts', io);
  }
  else if (postCount === 50 && !milestones.thankYouSent.has('fifty_posts')) {
    return checkAndSendThankYou(userId, 'fifty_posts', io);
  }
  else if (postCount === 100 && !milestones.thankYouSent.has('hundred_posts')) {
    return checkAndSendThankYou(userId, 'hundred_posts', io);
  }
  
  return { sent: false, reason: 'no_milestone' };
};

/**
 * Check comment milestone
 * Call this when a user creates a comment
 */
export const checkCommentMilestone = async (userId, commentCount, io = null) => {
  const milestones = getUserMilestones(userId);
  milestones.comments = commentCount;
  
  // Check first comment milestone
  if (commentCount === 1 && !milestones.thankYouSent.has('first_comment')) {
    return checkAndSendThankYou(userId, 'first_comment', io);
  }
  
  return { sent: false, reason: 'no_milestone' };
};

/**
 * Send weekly active member thank you
 * Should be run weekly for active users
 */
export const sendWeeklyThankYous = async (activeUserIds) => {
  const results = [];
  
  for (const userId of activeUserIds) {
    const result = await checkAndSendThankYou(userId, 'active_member');
    results.push({ userId, ...result });
    
    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  return results;
};

export default {
  THANK_YOU_MESSAGES,
  checkAndSendThankYou,
  checkPostMilestone,
  checkCommentMilestone,
  sendWeeklyThankYous
};

