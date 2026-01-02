import express from 'express';
const router = express.Router();
import User from '../models/User.js';
import Block from '../models/Block.js';
import auth from '../middleware/auth.js';
import { getBlockedUserIds, hasBlocked } from '../utils/blockHelper.js';
import logger from '../utils/logger.js';

// GET /api/privacy/settings
router.get('/settings', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('privacySettings');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const profileVisibility = user.privacySettings?.profileVisibility || 'public';

    // Derive default post visibility from profile visibility
    // public profile → public posts by default
    // followers profile → followers posts by default
    const defaultPostVisibility = profileVisibility === 'public' ? 'public' : 'followers';

    // Normalize settings to match frontend expectations
    const settings = {
      profileVisibility,
      whoCanMessage: user.privacySettings?.whoCanMessage || 'followers',
      quietModeEnabled: user.privacySettings?.quietModeEnabled || false,
      // BADGE SYSTEM V1: Hide badges setting
      hideBadges: user.privacySettings?.hideBadges || false,
      // Default post visibility derived from profile visibility
      defaultPostVisibility
    };

    res.json(settings);
  } catch (error) {
    logger.error('Get privacy settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/privacy/settings
router.patch('/settings', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Allowed fields for update
    const allowedFields = [
      'profileVisibility',
      'whoCanMessage',
      'quietModeEnabled',
      // Quiet Mode V2 sub-toggles
      'quietVisuals',
      'quietWriting',
      'quietMetrics',
      // BADGE SYSTEM V1: Hide badges option
      'hideBadges',
      // CURSOR CUSTOMIZATION: Optional cursor styles
      'cursorStyle'
    ];

    // Validate cursorStyle if provided
    const validCursorStyles = ['system', 'soft-rounded', 'calm-dot', 'high-contrast', 'reduced-motion'];
    if (req.body.cursorStyle && !validCursorStyles.includes(req.body.cursorStyle)) {
      return res.status(400).json({ message: 'Invalid cursor style' });
    }

    // Update only allowed fields
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (!user.privacySettings) {
          user.privacySettings = {};
        }
        user.privacySettings[field] = req.body[field];
      }
    });

    user.markModified('privacySettings');
    await user.save();

    res.json({
      message: 'Privacy settings updated',
      settings: {
        profileVisibility: user.privacySettings?.profileVisibility,
        whoCanMessage: user.privacySettings?.whoCanMessage,
        quietModeEnabled: user.privacySettings?.quietModeEnabled,
        quietVisuals: user.privacySettings?.quietVisuals ?? true,
        quietWriting: user.privacySettings?.quietWriting ?? true,
        quietMetrics: user.privacySettings?.quietMetrics ?? false,
        hideBadges: user.privacySettings?.hideBadges ?? false,
        cursorStyle: user.privacySettings?.cursorStyle ?? 'system'
      }
    });
  } catch (error) {
    logger.error('Update privacy settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/privacy/blocked-users
router.get('/blocked-users', auth, async (req, res) => {
  try {
    // Get IDs of blocked users
    const blockedUserIds = await getBlockedUserIds(req.userId);

    // Fetch full user details for blocked users
    const blockedUsers = await User.find({
      _id: { $in: blockedUserIds }
    }).select('_id username displayName profilePhoto');

    res.json({ 
      blockedUsers,
      count: blockedUsers.length
    });
  } catch (error) {
    logger.error('Get blocked users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/privacy/block
router.post('/block', auth, async (req, res) => {
  try {
    const { userId } = req.body;

    // Validate input
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Prevent self-blocking
    if (userId === req.userId) {
      return res.status(400).json({ message: 'Cannot block yourself' });
    }

    // Check if target user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Idempotent: if already blocked, return success (no-op)
    const alreadyBlocked = await hasBlocked(req.userId, userId);
    if (alreadyBlocked) {
      logger.debug('noop.block.already_exists', {
        userId: req.userId,
        targetId: userId,
        endpoint: 'POST /privacy/block'
      });
      return res.json({
        message: 'User blocked successfully',
        blockedUser: {
          _id: targetUser._id,
          username: targetUser.username,
          displayName: targetUser.displayName,
          profilePhoto: targetUser.profilePhoto
        }
      });
    }

    // Create block record
    const block = new Block({
      blocker: req.userId,
      blocked: userId,
      createdAt: new Date()
    });

    await block.save();

    res.status(201).json({ 
      message: 'User blocked successfully',
      blockedUser: {
        _id: targetUser._id,
        username: targetUser.username,
        displayName: targetUser.displayName,
        profilePhoto: targetUser.profilePhoto
      }
    });
  } catch (error) {
    logger.error('Block user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/privacy/block/:userId
router.delete('/block/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate input
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Remove block record
    const result = await Block.findOneAndDelete({
      blocker: req.userId,
      blocked: userId
    });

    // Idempotent: if not blocked, return success anyway (no-op)
    if (!result) {
      logger.debug('noop.unblock.not_blocked', {
        userId: req.userId,
        targetId: userId,
        endpoint: 'DELETE /privacy/block/:userId'
      });
    }

    res.json({
      message: 'User unblocked successfully',
      unblockedUserId: userId
    });
  } catch (error) {
    logger.error('Unblock user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
