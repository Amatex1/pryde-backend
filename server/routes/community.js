/**
 * Community Features API
 * 
 * Routes for:
 * - Conversation resurfacing
 * - Member spotlight
 * - Weekly themes
 * - Active members
 * 
 * These enhance the community experience with gentle engagement.
 */

import express from 'express';
import auth from '../middleware/auth.js';
import requireActiveUser from '../middleware/requireActiveUser.js';
import { runConversationResurfaceJob } from '../jobs/conversationResurfaceJob.js';
import { getUpcomingThemes } from '../jobs/weeklyThemesJob.js';
import { runMemberSpotlight } from '../jobs/memberSpotlightJob.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * @route   GET /api/community/resurfacing
 * @desc    Get conversations that are resurfacing (older posts with recent activity)
 * @access  Private
 */
router.get('/resurfacing', auth, requireActiveUser, async (req, res) => {
  try {
    const result = await runConversationResurfaceJob();
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('[Community] Error getting resurfacing conversations:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get resurfacing conversations'
    });
  }
});

/**
 * @route   GET /api/community/spotlight
 * @desc    Get current member spotlight
 * @access  Public (no auth required)
 */
router.get('/spotlight', async (req, res) => {
  try {
    // Get recent member spotlight from activity events
    const ActivityEvent = (await import('../models/ActivityEvent.js')).default;
    const recent = await ActivityEvent.find({
      type: 'member_spotlight'
    })
    .sort({ createdAt: -1 })
    .limit(1)
    .populate('userId', 'username displayName profilePhoto bio badges')
    .populate('postId', 'content');
    
    if (recent.length === 0) {
      return res.json({
        success: true,
        spotlight: null
      });
    }
    
    const spotlight = recent[0];
    res.json({
      success: true,
      spotlight: {
        user: spotlight.userId,
        post: spotlight.postId,
        featuredAt: spotlight.createdAt
      }
    });
  } catch (error) {
    logger.error('[Community] Error getting spotlight:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get spotlight'
    });
  }
});

/**
 * @route   POST /api/community/spotlight/trigger
 * @desc    Trigger a new member spotlight (admin only in production)
 * @access  Private (could be restricted to admin)
 */
router.post('/spotlight/trigger', auth, requireActiveUser, async (req, res) => {
  try {
    const result = await runMemberSpotlight();
    
    if (result) {
      res.json({
        success: true,
        message: 'Member spotlight created',
        spotlight: result
      });
    } else {
      res.json({
        success: false,
        message: 'No eligible members for spotlight'
      });
    }
  } catch (error) {
    logger.error('[Community] Error creating spotlight:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to create spotlight'
    });
  }
});

/**
 * @route   GET /api/community/themes
 * @desc    Get upcoming weekly themes
 * @access  Public
 */
router.get('/themes', async (req, res) => {
  try {
    const themes = getUpcomingThemes(4);
    res.json({
      success: true,
      themes
    });
  } catch (error) {
    logger.error('[Community] Error getting themes:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get themes'
    });
  }
});

/**
 * @route   GET /api/community/active-members
 * @desc    Get currently active members (from presence/online tracking)
 * @access  Private
 */
router.get('/active-members', auth, requireActiveUser, async (req, res) => {
  try {
    // Get online users from Redis/socket.io presence
    // For now, return mock or empty - this integrates with your existing presence system
    const { getOnlineUsers } = await import('../socket/presence.js').catch(() => ({}));
    
    let onlineUsers = [];
    if (getOnlineUsers) {
      onlineUsers = await getOnlineUsers();
    }
    
    // If no presence system, get recently active users from database
    if (onlineUsers.length === 0) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const active = await User.find({
        lastActivityDate: { $gte: fiveMinutesAgo },
        role: { $nin: ['system', 'prompts'] }
      })
      .select('username displayName profilePhoto')
      .limit(20);
      
      onlineUsers = active;
    }
    
    res.json({
      success: true,
      members: onlineUsers,
      count: onlineUsers.length
    });
  } catch (error) {
    logger.error('[Community] Error getting active members:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get active members'
    });
  }
});

/**
 * @route   GET /api/community/stats
 * @desc    Get community health stats
 * @access  Private
 */
router.get('/stats', auth, requireActiveUser, async (req, res) => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    
    const Post = (await import('../models/Post.js')).default;
    const User = (await import('../models/User.js')).default;
    const Comment = (await import('../models/Comment.js')).default;
    
    const [
      totalPosts,
      postsToday,
      postsThisWeek,
      totalUsers,
      usersThisWeek,
      activeUsers,
      commentsToday
    ] = await Promise.all([
      Post.countDocuments(),
      Post.countDocuments({ createdAt: { $gte: oneDayAgo } }),
      Post.countDocuments({ createdAt: { $gte: oneWeekAgo } }),
      User.countDocuments({ role: { $nin: ['system', 'prompts'] } }),
      User.countDocuments({ createdAt: { $gte: oneWeekAgo } }),
      User.countDocuments({ lastActivityDate: { $gte: oneDayAgo } }),
      Comment.countDocuments({ createdAt: { $gte: oneDayAgo } })
    ]);
    
    res.json({
      success: true,
      stats: {
        totalPosts,
        postsToday,
        postsThisWeek,
        totalUsers,
        usersThisWeek,
        activeUsers,
        commentsToday
      }
    });
  } catch (error) {
    logger.error('[Community] Error getting stats:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get community stats'
    });
  }
});

export default router;

