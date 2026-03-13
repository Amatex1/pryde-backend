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
      // Quiet Mode V2 sub-toggles
      quietVisuals: user.privacySettings?.quietVisuals ?? true,
      quietWriting: user.privacySettings?.quietWriting ?? true,
      quietMetrics: user.privacySettings?.quietMetrics ?? false,
      // BADGE SYSTEM V1: Hide badges setting
      hideBadges: user.privacySettings?.hideBadges || false,
      // Last seen timestamp visibility
      showLastSeen: user.privacySettings?.showLastSeen ?? true,
      hideFromSuggestedConnections: user.privacySettings?.hideFromSuggestedConnections ?? false,
      // Default post visibility derived from profile visibility
      defaultPostVisibility,
      // =========================================
      // QUIET MODE ENHANCEMENTS (All 10 Improvements)
      // =========================================
      
      // IMPROVEMENT 1: Scheduled/Automatic Quiet Hours
      quietHoursEnabled: user.privacySettings?.quietHoursEnabled ?? false,
      quietHoursStart: user.privacySettings?.quietHoursStart ?? '22:00',
      quietHoursEnd: user.privacySettings?.quietHoursEnd ?? '08:00',
      quietOnWorkFocus: user.privacySettings?.quietOnWorkFocus ?? false,
      
      // IMPROVEMENT 2: Granular Content Filtering
      quietContentFilter: user.privacySettings?.quietContentFilter ?? 'all',
      quietHideViral: user.privacySettings?.quietHideViral ?? false,
      quietFollowedOnly: user.privacySettings?.quietFollowedOnly ?? false,
      
      // IMPROVEMENT 4: Visual Improvements
      quietGentleTransitions: user.privacySettings?.quietGentleTransitions ?? true,
      quietColorScheme: user.privacySettings?.quietColorScheme ?? 'default',
      quietHideStories: user.privacySettings?.quietHideStories ?? false,
      
      // IMPROVEMENT 5: Deep Quiet Mode
      quietDeepQuiet: user.privacySettings?.quietDeepQuiet ?? false,
      quietDisableAnimations: user.privacySettings?.quietDisableAnimations ?? false,
      quietMinimalUI: user.privacySettings?.quietMinimalUI ?? false,
      quietHideTrending: user.privacySettings?.quietHideTrending ?? false,
      
      // IMPROVEMENT 6: Smart Triggers
      quietAutoTrigger: user.privacySettings?.quietAutoTrigger ?? false,
      quietNegativeThreshold: user.privacySettings?.quietNegativeThreshold ?? 5,
      quietKeywordTriggers: user.privacySettings?.quietKeywordTriggers ?? [],
      
      // IMPROVEMENT 7: Better User Feedback
      quietShowHiddenCount: user.privacySettings?.quietShowHiddenCount ?? true,
      quietSessionOverride: user.privacySettings?.quietSessionOverride ?? false,
      
      // IMPROVEMENT 8: Persistence & Context
      quietFeedSettings: user.privacySettings?.quietFeedSettings ?? 'default',
      quietMessageSettings: user.privacySettings?.quietMessageSettings ?? 'default',
      
      // IMPROVEMENT 9: Accessibility
      quietHighContrast: user.privacySettings?.quietHighContrast ?? false,
      
      // IMPROVEMENT 10: Communication Features
      quietHideMentions: user.privacySettings?.quietHideMentions ?? false,
      quietMuteGroupSummary: user.privacySettings?.quietMuteGroupSummary ?? false,
      quietReduceStoryNotifications: user.privacySettings?.quietReduceStoryNotifications ?? false,
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
      // Last seen timestamp visibility
      'showLastSeen',
      // Suggested connections opt-out
      'hideFromSuggestedConnections',
      // CURSOR CUSTOMIZATION: Optional cursor styles
      'cursorStyle',
      // =========================================
      // QUIET MODE ENHANCEMENTS (All 10 Improvements)
      // =========================================
      
      // IMPROVEMENT 1: Scheduled/Automatic Quiet Hours
      'quietHoursEnabled',
      'quietHoursStart',
      'quietHoursEnd',
      'quietOnWorkFocus',
      
      // IMPROVEMENT 2: Granular Content Filtering
      'quietContentFilter',
      'quietHideViral',
      'quietFollowedOnly',
      
      // IMPROVEMENT 4: Visual Improvements
      'quietGentleTransitions',
      'quietColorScheme',
      'quietHideStories',
      
      // IMPROVEMENT 5: Deep Quiet Mode
      'quietDeepQuiet',
      'quietDisableAnimations',
      'quietMinimalUI',
      'quietHideTrending',
      
      // IMPROVEMENT 6: Smart Triggers
      'quietAutoTrigger',
      'quietNegativeThreshold',
      'quietKeywordTriggers',
      
      // IMPROVEMENT 7: Better User Feedback
      'quietShowHiddenCount',
      'quietSessionOverride',
      
      // IMPROVEMENT 8: Persistence & Context
      'quietFeedSettings',
      'quietMessageSettings',
      
      // IMPROVEMENT 9: Accessibility
      'quietHighContrast',
      
      // IMPROVEMENT 10: Communication Features
      'quietHideMentions',
      'quietMuteGroupSummary',
      'quietReduceStoryNotifications',
    ];

    // Validate cursorStyle if provided
    const validCursorStyles = ['system', 'soft-rounded', 'calm-dot', 'high-contrast', 'reduced-motion'];
    if (req.body.cursorStyle && !validCursorStyles.includes(req.body.cursorStyle)) {
      return res.status(400).json({ message: 'Invalid cursor style' });
    }

    // Validate quietContentFilter if provided
    const validContentFilters = ['all', 'videos-only', 'images-only', 'text-only', 'no-polls', 'low-engagement'];
    if (req.body.quietContentFilter && !validContentFilters.includes(req.body.quietContentFilter)) {
      return res.status(400).json({ message: 'Invalid content filter' });
    }

    // Validate quietColorScheme if provided
    const validColorSchemes = ['default', 'monochrome', 'sepia'];
    if (req.body.quietColorScheme && !validColorSchemes.includes(req.body.quietColorScheme)) {
      return res.status(400).json({ message: 'Invalid color scheme' });
    }

    // Validate quietFeedSettings/quietMessageSettings if provided
    const validContextSettings = ['default', 'calm', 'deep', 'minimal'];
    if (req.body.quietFeedSettings && !validContextSettings.includes(req.body.quietFeedSettings)) {
      return res.status(400).json({ message: 'Invalid feed settings' });
    }
    if (req.body.quietMessageSettings && !validContextSettings.includes(req.body.quietMessageSettings)) {
      return res.status(400).json({ message: 'Invalid message settings' });
    }

    // Validate quietHoursStart/quietHoursEnd format (HH:MM)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (req.body.quietHoursStart && !timeRegex.test(req.body.quietHoursStart)) {
      return res.status(400).json({ message: 'Invalid quiet hours start format. Use HH:MM' });
    }
    if (req.body.quietHoursEnd && !timeRegex.test(req.body.quietHoursEnd)) {
      return res.status(400).json({ message: 'Invalid quiet hours end format. Use HH:MM' });
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
        cursorStyle: user.privacySettings?.cursorStyle ?? 'system',
        // Quiet Mode Enhancements
        quietHoursEnabled: user.privacySettings?.quietHoursEnabled ?? false,
        quietHoursStart: user.privacySettings?.quietHoursStart ?? '22:00',
        quietHoursEnd: user.privacySettings?.quietHoursEnd ?? '08:00',
        quietOnWorkFocus: user.privacySettings?.quietOnWorkFocus ?? false,
        quietContentFilter: user.privacySettings?.quietContentFilter ?? 'all',
        quietHideViral: user.privacySettings?.quietHideViral ?? false,
        quietFollowedOnly: user.privacySettings?.quietFollowedOnly ?? false,
        quietGentleTransitions: user.privacySettings?.quietGentleTransitions ?? true,
        quietColorScheme: user.privacySettings?.quietColorScheme ?? 'default',
        quietHideStories: user.privacySettings?.quietHideStories ?? false,
        quietDeepQuiet: user.privacySettings?.quietDeepQuiet ?? false,
        quietDisableAnimations: user.privacySettings?.quietDisableAnimations ?? false,
        quietMinimalUI: user.privacySettings?.quietMinimalUI ?? false,
        quietHideTrending: user.privacySettings?.quietHideTrending ?? false,
        quietAutoTrigger: user.privacySettings?.quietAutoTrigger ?? false,
        quietNegativeThreshold: user.privacySettings?.quietNegativeThreshold ?? 5,
        quietKeywordTriggers: user.privacySettings?.quietKeywordTriggers ?? [],
        quietShowHiddenCount: user.privacySettings?.quietShowHiddenCount ?? true,
        quietSessionOverride: user.privacySettings?.quietSessionOverride ?? false,
        quietFeedSettings: user.privacySettings?.quietFeedSettings ?? 'default',
        quietMessageSettings: user.privacySettings?.quietMessageSettings ?? 'default',
        quietHighContrast: user.privacySettings?.quietHighContrast ?? false,
        quietHideMentions: user.privacySettings?.quietHideMentions ?? false,
        quietMuteGroupSummary: user.privacySettings?.quietMuteGroupSummary ?? false,
        quietReduceStoryNotifications: user.privacySettings?.quietReduceStoryNotifications ?? false,
      }
    });
  } catch (error) {
    logger.error('Update privacy settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
// ── Safety & Privacy Panel (Phase 5) ────────────────────────────────────────
// Separate from privacySettings — these control safety/hardening features.

// GET /api/privacy/safety
router.get('/safety', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('privacy');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      showRealName: user.privacy?.showRealName ?? true,
      allowAnonymousPosts: user.privacy?.allowAnonymousPosts ?? true,
      hideProfileFromSearch: user.privacy?.hideProfileFromSearch ?? false,
      hideOnlineStatus: user.privacy?.hideOnlineStatus ?? false,
      onlineStatusVisibility: user.privacy?.onlineStatusVisibility || 'everyone',
      friendOnlyProfile: user.privacy?.friendOnlyProfile ?? false,
      showBadgesPublicly: user.privacy?.showBadgesPublicly ?? true,
    });
  } catch (error) {
    logger.error('Get safety settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/privacy/safety
router.patch('/safety', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const allowedSafetyFields = [
      'showRealName',
      'allowAnonymousPosts',
      'hideProfileFromSearch',
      'hideOnlineStatus',
      'onlineStatusVisibility',
      'friendOnlyProfile',
      'showBadgesPublicly'
    ];

    // Validate onlineStatusVisibility if provided
    const validOnlineVisibility = ['everyone', 'followers', 'no-one'];
    if (req.body.onlineStatusVisibility && !validOnlineVisibility.includes(req.body.onlineStatusVisibility)) {
      return res.status(400).json({ message: 'Invalid onlineStatusVisibility value' });
    }

    if (!user.privacy) {
      user.privacy = {};
    }

    allowedSafetyFields.forEach(field => {
      if (req.body[field] !== undefined) {
        user.privacy[field] = Boolean(req.body[field]);
      }
    });

    user.markModified('privacy');
    await user.save();

    res.json({
      message: 'Safety settings updated',
      privacy: {
        showRealName: user.privacy.showRealName ?? true,
        allowAnonymousPosts: user.privacy.allowAnonymousPosts ?? true,
        hideProfileFromSearch: user.privacy.hideProfileFromSearch ?? false,
        hideOnlineStatus: user.privacy.hideOnlineStatus ?? false,
        onlineStatusVisibility: user.privacy.onlineStatusVisibility || 'everyone',
        friendOnlyProfile: user.privacy.friendOnlyProfile ?? false,
        showBadgesPublicly: user.privacy.showBadgesPublicly ?? true,
      }
    });
  } catch (error) {
    logger.error('Update safety settings error:', error);
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
