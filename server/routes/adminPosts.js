/**
 * Admin Posts Routes
 * 
 * PHASE C: Acting On Behalf Of
 * 
 * Allows admins to post as system accounts (pryde_announcements, etc.)
 * while maintaining full audit trail.
 * 
 * Key features:
 * - Admin can post as themselves or as a system account
 * - Post.author = system account (what users see)
 * - Post.createdBy = admin (audit trail)
 * - All actions logged in AdminActionLog
 */

import express from 'express';
import User from '../models/User.js';
import Post from '../models/Post.js';
import AdminActionLog from '../models/AdminActionLog.js';
import { authenticateToken } from '../middleware/auth.js';
import { sanitizeFields } from '../middleware/sanitize.js';
import { getClientIp } from '../utils/sessionUtils.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * Middleware to check if user is admin
 */
const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    req.adminUser = user;
    next();
  } catch (error) {
    logger.error('Admin check error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @route   POST /api/admin/posts
 * @desc    Create a post as admin or as a system account
 * @access  Admin
 * 
 * Body:
 * {
 *   content: string (required),
 *   postAs: string (optional) - username of system account to post as
 *   visibility: string (optional) - 'public', 'friends', 'private'
 * }
 */
router.post('/', authenticateToken, requireAdmin, sanitizeFields(['content']), async (req, res) => {
  try {
    const { content, postAs, visibility = 'public' } = req.body;
    const actorId = req.adminUser._id;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Post content is required' });
    }
    
    let authorId = actorId; // Default: post as yourself
    let asUserId = null;
    
    // If posting as a system account
    if (postAs) {
      const systemAccount = await User.findOne({ 
        username: postAs,
        isSystemAccount: true 
      });
      
      if (!systemAccount) {
        return res.status(404).json({ 
          message: `System account '${postAs}' not found` 
        });
      }
      
      // Check if system account is active
      if (!systemAccount.isActive) {
        return res.status(400).json({ 
          message: `System account '${postAs}' is not active. Activate it first.` 
        });
      }
      
      authorId = systemAccount._id;
      asUserId = systemAccount._id;
    }
    
    // Create the post
    const post = new Post({
      author: authorId,
      createdBy: actorId, // Always track who actually created it
      content: content.trim(),
      visibility: visibility,
      isSystemPost: asUserId ? true : false
    });
    
    await post.save();
    
    // Populate author for response
    await post.populate('author', 'username displayName profilePhoto isVerified isSystemAccount systemRole');
    await post.populate('createdBy', 'username displayName');
    
    // Log the action
    await AdminActionLog.logAction({
      actorId: actorId,
      action: asUserId ? 'POST_AS_SYSTEM' : 'CREATE_POST',
      targetType: 'POST',
      targetId: post._id,
      asUserId: asUserId,
      details: {
        content: content.substring(0, 100),
        visibility: visibility,
        systemAccount: postAs || null
      },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent']
    });
    
    logger.info(`Admin ${req.adminUser.username} created post ${asUserId ? `as ${postAs}` : 'as themselves'}`);
    
    res.status(201).json({
      success: true,
      message: asUserId ? `Posted as ${postAs}` : 'Post created',
      post: post.toObject()
    });
  } catch (error) {
    logger.error('Admin post creation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   GET /api/admin/posts/system-accounts
 * @desc    Get list of available system accounts for posting
 * @access  Admin
 */
router.get('/system-accounts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const systemAccounts = await User.find({ 
      isSystemAccount: true 
    }).select('username displayName systemRole isActive systemDescription');
    
    res.json({
      success: true,
      systemAccounts: systemAccounts
    });
  } catch (error) {
    logger.error('Get system accounts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

