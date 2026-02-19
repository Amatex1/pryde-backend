/**
 * Admin Moderation V2 Routes
 *
 * PRYDE_MODERATION_PLATFORM_V3: Full admin visibility, control, and simulation
 *
 * Features:
 * 1. Real-time moderation event stream (V3 contract)
 * 2. Human override controls
 * 3. Manual moderation tools
 * 4. User moderation profile
 * 5. Rule tuning panel
 * 6. Transparency & appeals
 * 7. Simulation mode (read-only pipeline testing)
 * 8. Shadow mode toggle
 *
 * NON-NEGOTIABLE CONSTRAINTS:
 * - No automated action is final
 * - Admin decisions always supersede bot decisions
 * - Visibility dampening is non-punitive
 * - Expressive formatting never causes strikes
 * - All actions must be reversible
 * - Frontend never recalculates moderation logic
 */

import express from 'express';
import auth from '../middleware/auth.js';
import adminAuth, { checkPermission } from '../middleware/adminAuth.js';
import requireAdminEscalation from '../middleware/requireAdminEscalation.js';
import ModerationEvent from '../models/ModerationEvent.js';
import ModerationOverride from '../models/ModerationOverride.js';
import ModerationSettings from '../models/ModerationSettings.js';
import AdminActionLog from '../models/AdminActionLog.js';
import User from '../models/User.js';
import { moderateContentV2 } from '../utils/moderationV2.js';
import { setAdminOverride, removeAdminOverride, isFeatureEnabled } from '../utils/featureFlags.js';
import logger from '../utils/logger.js';

const router = express.Router();

// All routes require authentication + admin role
router.use(auth);
router.use(adminAuth);

// ═══════════════════════════════════════════════════════════════════════════
// 1. MODERATION EVENT STREAM
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/admin/moderation-v2/events
 * @desc    Get real-time moderation events with filters
 * @access  Admin (canViewReports)
 *
 * V3: Returns events in V3 contract format by default
 * Use ?format=legacy to get raw database format
 */
router.get('/events', checkPermission('canViewReports'), async (req, res) => {
  try {
    const {
      limit = 50,
      offset = 0,
      action,
      contentType,
      overrideStatus,
      userId,
      minConfidence,
      maxConfidence,
      startDate,
      endDate,
      queuePriority,
      shadowMode,
      format = 'v3' // v3 or legacy
    } = req.query;

    const query = {};

    // V3: Support filtering by response.action (new) or action (legacy)
    if (action) {
      // Map V3 action to query - check both response.action and legacy action field
      const actionMap = { 'ALLOW': 'ALLOW', 'NOTE': 'ALLOW_WITH_INTERNAL_NOTE',
                          'DAMPEN': 'VISIBILITY_DAMPEN', 'REVIEW': 'QUEUE_FOR_REVIEW',
                          'MUTE': 'TEMP_MUTE', 'BLOCK': 'HARD_BLOCK' };
      query['response.action'] = actionMap[action] ? action : action;
    }
    if (contentType) query.contentType = contentType;
    if (overrideStatus) query.overrideStatus = overrideStatus;
    if (userId) query.userId = userId;
    if (queuePriority) query.queuePriority = queuePriority;
    if (shadowMode !== undefined) query.shadowMode = shadowMode === 'true';

    if (minConfidence || maxConfidence) {
      query.confidence = {};
      if (minConfidence) query.confidence.$gte = parseInt(minConfidence);
      if (maxConfidence) query.confidence.$lte = parseInt(maxConfidence);
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const [events, total] = await Promise.all([
      ModerationEvent.find(query)
        .populate('userId', 'username displayName profilePhoto')
        .sort({ createdAt: -1 })
        .skip(parseInt(offset))
        .limit(parseInt(limit)),
      ModerationEvent.countDocuments(query)
    ]);

    // V3: Transform to contract format unless legacy requested
    const responseEvents = format === 'legacy'
      ? events.map(e => e.toObject())
      : ModerationEvent.toV3ContractArray(events);

    res.json({
      success: true,
      events: responseEvents,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + events.length < total
      },
      format: format === 'legacy' ? 'legacy' : 'v3'
    });
  } catch (error) {
    logger.error('Get moderation events error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   GET /api/admin/moderation-v2/events/:eventId
 * @desc    Get single moderation event with full details
 * @access  Admin (canViewReports)
 */
router.get('/events/:eventId', checkPermission('canViewReports'), async (req, res) => {
  try {
    const event = await ModerationEvent.findById(req.params.eventId)
      .populate('userId', 'username displayName profilePhoto createdAt moderation')
      .populate('overrideId')
      .lean();

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json({ success: true, event });
  } catch (error) {
    logger.error('Get moderation event error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   GET /api/admin/moderation-v2/queue
 * @desc    Get events queued for review
 * @access  Admin (canViewReports)
 */
router.get('/queue', checkPermission('canViewReports'), async (req, res) => {
  try {
    const { limit = 50, priority } = req.query;

    const query = {
      $or: [
        { overrideStatus: 'pending_review' },
        { action: 'QUEUE_FOR_REVIEW' }
      ]
    };

    if (priority) query.queuePriority = priority;

    const events = await ModerationEvent.find(query)
      .populate('userId', 'username displayName profilePhoto')
      .sort({ queuePriority: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    // Count by priority
    const counts = await ModerationEvent.aggregate([
      { $match: query },
      { $group: { _id: '$queuePriority', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      events,
      counts: counts.reduce((acc, c) => ({ ...acc, [c._id]: c.count }), {})
    });
  } catch (error) {
    logger.error('Get review queue error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. HUMAN OVERRIDE CONTROLS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/admin/moderation-v2/events/:eventId/override
 * @desc    Override an automated moderation decision
 * @access  Admin (canManageUsers) + Escalation required
 */
router.post('/events/:eventId/override',
  checkPermission('canManageUsers'),
  requireAdminEscalation,
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const { overrideAction, reason, newPenalty, trainSystem = false } = req.body;

      // Validate required fields
      if (!overrideAction || !reason) {
        return res.status(400).json({
          message: 'overrideAction and reason are required'
        });
      }

      // Get the event
      const event = await ModerationEvent.findById(eventId);
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      // Create the override
      const override = await ModerationOverride.createOverride({
        eventId,
        userId: event.userId,
        adminId: req.user._id,
        overrideAction,
        reason,
        originalDecision: {
          action: event.action,
          confidence: event.confidence,
          explanation: event.explanation,
          layerOutputs: event.layerOutputs
        },
        newDecision: newPenalty ? {
          action: newPenalty.action || 'ALLOW',
          penalty: newPenalty.penalty
        } : null,
        trainSystem
      });

      // Apply the override effect based on action
      if (overrideAction === 'UNDO' || overrideAction === 'RESTORE_CONTENT') {
        // Restore user's content visibility / undo mute
        await User.findByIdAndUpdate(event.userId, {
          $set: {
            'moderation.isMuted': false,
            'moderation.muteExpires': null,
            'moderation.muteReason': null
          }
        });
      } else if (overrideAction === 'CLEAR_STRIKES') {
        await User.findByIdAndUpdate(event.userId, {
          $set: { 'moderation.violationCount': 0 }
        });
      } else if (overrideAction === 'RESET_BEHAVIOR') {
        await User.findByIdAndUpdate(event.userId, {
          $set: { 'moderation.behaviorScore': 100 }
        });
      }

      // Log the admin action
      await AdminActionLog.logAction({
        actorId: req.user._id,
        action: 'OVERRIDE_MODERATION',
        targetType: 'USER',
        targetId: event.userId,
        details: {
          eventId,
          overrideAction,
          reason,
          originalAction: event.action,
          newDecision: override.newDecision
        },
        escalationMethod: req.escalationMethod,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      logger.info(`Admin ${req.user._id} overrode moderation event ${eventId}: ${overrideAction}`);

      res.json({
        success: true,
        override,
        message: `Successfully applied override: ${overrideAction}`
      });
    } catch (error) {
      logger.error('Override moderation error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

/**
 * @route   GET /api/admin/moderation-v2/overrides
 * @desc    Get override history
 * @access  Admin (canViewReports)
 */
router.get('/overrides', checkPermission('canViewReports'), async (req, res) => {
  try {
    const { limit = 50, offset = 0, adminId, userId, action } = req.query;

    const query = {};
    if (adminId) query.adminId = adminId;
    if (userId) query.userId = userId;
    if (action) query.overrideAction = action;

    const [overrides, total] = await Promise.all([
      ModerationOverride.find(query)
        .populate('adminId', 'username displayName')
        .populate('userId', 'username displayName')
        .populate('eventId')
        .sort({ createdAt: -1 })
        .skip(parseInt(offset))
        .limit(parseInt(limit))
        .lean(),
      ModerationOverride.countDocuments(query)
    ]);

    res.json({
      success: true,
      overrides,
      pagination: { total, limit: parseInt(limit), offset: parseInt(offset) }
    });
  } catch (error) {
    logger.error('Get overrides error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. MANUAL MODERATION TOOLS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/admin/moderation-v2/users/:userId/mute
 * @desc    Manually mute a user (time-based)
 * @access  Admin (canManageUsers) + Escalation required
 */
router.post('/users/:userId/mute',
  checkPermission('canManageUsers'),
  requireAdminEscalation,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { duration, reason, shadow = false } = req.body;

      if (!duration || !reason) {
        return res.status(400).json({ message: 'duration and reason required' });
      }

      const muteExpires = new Date(Date.now() + duration * 60 * 1000);

      await User.findByIdAndUpdate(userId, {
        $set: {
          'moderation.isMuted': true,
          'moderation.muteExpires': muteExpires,
          'moderation.muteReason': reason,
          'moderation.shadowMute': shadow
        }
      });

      // Add to moderation history
      await User.addModerationHistoryCapped(userId, {
        action: 'mute',
        reason,
        duration,
        shadow,
        adminId: req.user._id,
        timestamp: new Date()
      });

      await AdminActionLog.logAction({
        actorId: req.user._id,
        action: shadow ? 'SHADOW_MUTE' : 'MANUAL_MUTE',
        targetType: 'USER',
        targetId: userId,
        details: { duration, reason, shadow, expires: muteExpires },
        escalationMethod: req.escalationMethod,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: `User ${shadow ? 'shadow ' : ''}muted for ${duration} minutes`,
        expires: muteExpires
      });
    } catch (error) {
      logger.error('Manual mute error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

/**
 * @route   POST /api/admin/moderation-v2/users/:userId/unmute
 * @desc    Unmute a user
 * @access  Admin (canManageUsers)
 */
router.post('/users/:userId/unmute',
  checkPermission('canManageUsers'),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { reason } = req.body;

      await User.findByIdAndUpdate(userId, {
        $set: {
          'moderation.isMuted': false,
          'moderation.muteExpires': null,
          'moderation.muteReason': null,
          'moderation.shadowMute': false
        }
      });

      await User.addModerationHistoryCapped(userId, {
        action: 'unmute',
        reason: reason || 'Admin action',
        adminId: req.user._id,
        timestamp: new Date()
      });

      await AdminActionLog.logAction({
        actorId: req.user._id,
        action: 'UNMUTE_USER',
        targetType: 'USER',
        targetId: userId,
        details: { reason },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({ success: true, message: 'User unmuted' });
    } catch (error) {
      logger.error('Unmute error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

/**
 * @route   POST /api/admin/moderation-v2/users/:userId/clear-strikes
 * @desc    Clear all strikes/violations from a user
 * @access  Admin (canManageUsers) + Escalation required
 */
router.post('/users/:userId/clear-strikes',
  checkPermission('canManageUsers'),
  requireAdminEscalation,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ message: 'reason required' });
      }

      const user = await User.findById(userId);
      const previousCount = user?.moderation?.violationCount || 0;

      await User.findByIdAndUpdate(userId, {
        $set: { 'moderation.violationCount': 0 }
      });

      await AdminActionLog.logAction({
        actorId: req.user._id,
        action: 'CLEAR_STRIKES',
        targetType: 'USER',
        targetId: userId,
        details: { reason, previousCount },
        escalationMethod: req.escalationMethod,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: `Cleared ${previousCount} strikes from user`
      });
    } catch (error) {
      logger.error('Clear strikes error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

/**
 * @route   POST /api/admin/moderation-v2/users/:userId/reset-behavior
 * @desc    Reset behavior score to 100
 * @access  Admin (canManageUsers) + Escalation required
 */
router.post('/users/:userId/reset-behavior',
  checkPermission('canManageUsers'),
  requireAdminEscalation,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ message: 'reason required' });
      }

      const user = await User.findById(userId);
      const previousScore = user?.moderation?.behaviorScore || 100;

      await User.findByIdAndUpdate(userId, {
        $set: { 'moderation.behaviorScore': 100 }
      });

      await AdminActionLog.logAction({
        actorId: req.user._id,
        action: 'RESET_BEHAVIOR_SCORE',
        targetType: 'USER',
        targetId: userId,
        details: { reason, previousScore },
        escalationMethod: req.escalationMethod,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: `Reset behavior score from ${previousScore} to 100`
      });
    } catch (error) {
      logger.error('Reset behavior error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

/**
 * @route   POST /api/admin/moderation-v2/users/:userId/watchlist
 * @desc    Add/remove user from watchlist
 * @access  Admin (canManageUsers)
 */
router.post('/users/:userId/watchlist',
  checkPermission('canManageUsers'),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { add = true, reason } = req.body;

      await User.findByIdAndUpdate(userId, {
        $set: {
          'moderation.onWatchlist': add,
          'moderation.watchlistReason': add ? reason : null
        }
      });

      await AdminActionLog.logAction({
        actorId: req.user._id,
        action: add ? 'ADD_WATCHLIST' : 'REMOVE_WATCHLIST',
        targetType: 'USER',
        targetId: userId,
        details: { reason },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: add ? 'User added to watchlist' : 'User removed from watchlist'
      });
    } catch (error) {
      logger.error('Watchlist error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

/**
 * @route   POST /api/admin/moderation-v2/users/:userId/trusted
 * @desc    Mark/unmark user as trusted (bypass some checks)
 * @access  Admin (canManageUsers) + Escalation required
 */
router.post('/users/:userId/trusted',
  checkPermission('canManageUsers'),
  requireAdminEscalation,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { trusted = true, reason } = req.body;

      if (!reason) {
        return res.status(400).json({ message: 'reason required' });
      }

      await User.findByIdAndUpdate(userId, {
        $set: { 'moderation.trusted': trusted }
      });

      await AdminActionLog.logAction({
        actorId: req.user._id,
        action: trusted ? 'ADD_TRUSTED' : 'REMOVE_TRUSTED',
        targetType: 'USER',
        targetId: userId,
        details: { reason },
        escalationMethod: req.escalationMethod,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: trusted ? 'User marked as trusted' : 'Trusted status removed'
      });
    } catch (error) {
      logger.error('Trusted status error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// 4. USER MODERATION PROFILE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/admin/moderation-v2/users/:userId/profile
 * @desc    Get complete moderation profile for a user
 * @access  Admin (canViewReports)
 */
router.get('/users/:userId/profile', checkPermission('canViewReports'), async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user with moderation data
    const user = await User.findById(userId)
      .select('username displayName profilePhoto createdAt moderation moderationHistory')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get moderation events for this user
    const [events, overrides, eventStats] = await Promise.all([
      ModerationEvent.find({ userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      ModerationOverride.find({ userId })
        .populate('adminId', 'username displayName')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      ModerationEvent.aggregate([
        { $match: { userId: user._id } },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    // Calculate account age
    const accountAge = Math.floor((Date.now() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24));

    res.json({
      success: true,
      profile: {
        user: {
          _id: user._id,
          username: user.username,
          displayName: user.displayName,
          profilePhoto: user.profilePhoto,
          createdAt: user.createdAt,
          accountAgeDays: accountAge
        },
        moderation: user.moderation || {},
        moderationHistory: user.moderationHistory || [],
        recentEvents: events,
        overrideHistory: overrides,
        eventStats: eventStats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
        flags: {
          isMuted: user.moderation?.isMuted || false,
          onWatchlist: user.moderation?.onWatchlist || false,
          trusted: user.moderation?.trusted || false,
          violationCount: user.moderation?.violationCount || 0,
          behaviorScore: user.moderation?.behaviorScore || 100
        }
      }
    });
  } catch (error) {
    logger.error('Get user moderation profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/admin/moderation-v2/users/:userId/note
 * @desc    Add admin note to user's moderation history
 * @access  Admin (canManageUsers)
 */
router.post('/users/:userId/note', checkPermission('canManageUsers'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { note } = req.body;

    if (!note) {
      return res.status(400).json({ message: 'note required' });
    }

    await User.addModerationHistoryCapped(userId, {
      action: 'admin-note',
      reason: note,
      adminId: req.user._id,
      timestamp: new Date()
    });

    res.json({ success: true, message: 'Note added' });
  } catch (error) {
    logger.error('Add note error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. RULE TUNING PANEL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/admin/moderation-v2/settings
 * @desc    Get moderation V2 settings
 * @access  Admin (canViewAnalytics)
 */
router.get('/settings', checkPermission('canViewAnalytics'), async (req, res) => {
  try {
    const settings = await ModerationSettings.getSettings();
    res.json({
      success: true,
      settings: settings.moderationV2 || {}
    });
  } catch (error) {
    logger.error('Get settings error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   PUT /api/admin/moderation-v2/settings
 * @desc    Update moderation V2/V3 settings (live, no redeploy)
 * @access  Admin (super_admin only) + Escalation required
 *
 * V3 SLOW TUNING CONTROLS:
 * - Changes affect FUTURE events only
 * - UI shows "Effective from now" via lastUpdated
 * - No retroactive punishment
 */
router.put('/settings',
  adminAuth(['super_admin']),
  requireAdminEscalation,
  async (req, res) => {
    try {
      const updates = req.body;

      // V3: Updated allowed keys with new naming
      const allowedKeys = [
        // V3 numeric scales (0-100)
        'expressiveTolerance', 'behaviorEscalationSensitivity',
        'newAccountStrictness', 'reviewThreshold',
        // V3 named duration fields
        'dampeningDurationMinutes', 'autoExpiryHours',
        // Legacy fields (kept for backward compatibility)
        'visibilityDampeningDuration', 'autoExpiryDuration',
        'reviewQueueThresholds', 'transparency'
      ];

      const sanitized = {};
      for (const key of allowedKeys) {
        if (updates[key] !== undefined) {
          sanitized[`moderationV2.${key}`] = updates[key];
        }
      }

      // V3: Always update lastUpdated for "Effective from now" display
      sanitized['moderationV2.lastUpdated'] = new Date();

      const settings = await ModerationSettings.updateSettings(sanitized, req.user._id);

      await AdminActionLog.logAction({
        actorId: req.user._id,
        action: 'UPDATE_MODERATION_SETTINGS',
        targetType: 'SETTINGS',
        details: { updates: sanitized },
        escalationMethod: req.escalationMethod,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      logger.info(`Admin ${req.user._id} updated moderation V3 settings`);

      res.json({
        success: true,
        settings: settings.moderationV2,
        message: 'Settings updated - effective immediately for all new content',
        effectiveFrom: sanitized['moderationV2.lastUpdated'],
        note: 'Changes only affect future moderation events. No retroactive adjustments.'
      });
    } catch (error) {
      logger.error('Update settings error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// 6. DASHBOARD STATS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/admin/moderation-v2/stats
 * @desc    Get moderation dashboard statistics
 * @access  Admin (canViewAnalytics)
 */
router.get('/stats', checkPermission('canViewAnalytics'), async (req, res) => {
  try {
    const { period = '24h' } = req.query;

    // Calculate time range
    const periodMs = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    const since = new Date(Date.now() - (periodMs[period] || periodMs['24h']));

    const [
      actionCounts,
      queueSize,
      overrideRate,
      topUsers
    ] = await Promise.all([
      // Count by action type
      ModerationEvent.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$action', count: { $sum: 1 } } }
      ]),
      // Queue size
      ModerationEvent.countDocuments({
        $or: [
          { overrideStatus: 'pending_review' },
          { action: 'QUEUE_FOR_REVIEW' }
        ]
      }),
      // Override rate
      Promise.all([
        ModerationEvent.countDocuments({ createdAt: { $gte: since } }),
        ModerationOverride.countDocuments({ createdAt: { $gte: since } })
      ]),
      // Top moderated users
      ModerationEvent.aggregate([
        { $match: { createdAt: { $gte: since }, action: { $ne: 'ALLOW' } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        {
          $project: {
            count: 1,
            username: '$user.username',
            displayName: '$user.displayName'
          }
        }
      ])
    ]);

    const [totalEvents, totalOverrides] = overrideRate;

    res.json({
      success: true,
      stats: {
        period,
        actionCounts: actionCounts.reduce((acc, a) => ({ ...acc, [a._id]: a.count }), {}),
        queueSize,
        totalEvents,
        totalOverrides,
        overrideRate: totalEvents > 0 ? (totalOverrides / totalEvents * 100).toFixed(2) : 0,
        topModeratedUsers: topUsers
      }
    });
  } catch (error) {
    logger.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. SIMULATION MODE (V3)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/admin/moderation-v2/simulate
 * @desc    Run content through moderation pipeline without persisting
 * @access  Admin (canViewReports)
 *
 * V3 SIMULATION MODE:
 * - Runs content through Layers 1-4
 * - Does NOT persist data
 * - Does NOT affect user state
 * - Returns ModerationEvent shape without id or timestamps
 *
 * Use cases:
 * - Debug false positives
 * - Train moderators
 * - Tune thresholds safely
 */
router.post('/simulate', checkPermission('canViewReports'), async (req, res) => {
  try {
    const { content, contentType = 'other', userId } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ message: 'Content is required and must be a string' });
    }

    if (content.length > 10000) {
      return res.status(400).json({ message: 'Content too long (max 10000 characters)' });
    }

    // Build user context if userId provided
    let userContext = {};
    if (userId) {
      try {
        const user = await User.findById(userId).select('createdAt moderation moderationHistory displayName username');
        if (user) {
          userContext = {
            accountAge: user.createdAt ? Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 365,
            violationCount: user.moderation?.violationCount || 0,
            isTrusted: user.trusted || false,
            onWatchlist: user.onWatchlist || false
          };
        }
      } catch (userError) {
        logger.warn('Failed to fetch user context for simulation:', userError);
      }
    }

    // Run through moderation pipeline WITHOUT emitting event
    const result = await moderateContentV2(content, userId || null, {
      contentType,
      emitEvent: false,      // Don't persist
      returnAllLayers: true, // Return full layer breakdown
      userContext
    });

    // V4 Contract: Build simulation response with id="SIMULATION"
    const simulationResult = {
      id: 'SIMULATION', // V4: Explicit simulation marker
      contentType: contentType === 'chat' ? 'global_chat' : contentType,
      contentPreview: content.substring(0, 500),
      userId: userId || null,
      // No createdAt - this is a simulation

      // V3 Contract: Expression
      expression: {
        classification: result.layer_outputs?.layer1?.classification === 'expressive' ||
                        result.layer_outputs?.layer1?.classification === 'symbolic'
                        ? 'emphatic' : 'normal',
        expressiveRatio: result.layer_outputs?.layer1?.expressive_ratio || 0,
        realWordRatio: result.layer_outputs?.layer1?.real_word_ratio || 0
      },

      // V3 Contract: Intent
      intent: {
        category: result.layer_outputs?.layer2?.intent_category || 'neutral',
        score: result.layer_outputs?.layer2?.intent_score || 0,
        targetDetected: (result.layer_outputs?.layer2?.targets || []).length > 0
      },

      // V3 Contract: Behavior
      behavior: {
        score: result.layer_outputs?.layer3?.behavior_score || 0,
        trend: result.layer_outputs?.layer3?.behavior_score >= 60 ? 'rising' :
               result.layer_outputs?.layer3?.behavior_score <= 20 ? 'falling' : 'stable',
        accountAgeDays: userContext.accountAge || 0
      },

      // V3 Contract: Response
      response: {
        action: {
          'ALLOW': 'ALLOW',
          'ALLOW_WITH_INTERNAL_NOTE': 'NOTE',
          'VISIBILITY_DAMPEN': 'DAMPEN',
          'QUEUE_FOR_REVIEW': 'REVIEW',
          'TEMP_MUTE': 'MUTE',
          'HARD_BLOCK': 'BLOCK'
        }[result.action] || 'ALLOW',
        durationMinutes: result.dampening_duration || 0,
        automated: true
      },

      confidence: result.confidence,
      explanationCode: {
        'ALLOW': 'ALLOWED',
        'ALLOW_WITH_INTERNAL_NOTE': 'FLAGGED_FOR_MONITORING',
        'VISIBILITY_DAMPEN': 'VISIBILITY_DAMPENED',
        'QUEUE_FOR_REVIEW': 'QUEUED_FOR_REVIEW',
        'TEMP_MUTE': 'TEMPORARILY_MUTED',
        'HARD_BLOCK': 'CONTENT_BLOCKED'
      }[result.action] || 'ALLOWED',
      shadowMode: true, // V4: Simulations are always shadow mode (no enforcement)
      overridden: false,

      // Additional simulation-specific data
      _simulation: {
        isSimulation: true,
        rawAction: result.action,
        layerBreakdown: result.layer_breakdown,
        fullLayerOutputs: result.layer_outputs
      }
    };

    res.json({
      message: 'Simulation complete',
      event: simulationResult
    });

  } catch (error) {
    logger.error('Simulation error:', error);
    res.status(500).json({ message: 'Simulation failed', error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. SHADOW MODE TOGGLE (V3)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/admin/moderation-v2/mode
 * @desc    Get current moderation mode (LIVE or SHADOW)
 * @access  Admin (canViewReports)
 */
router.get('/mode', checkPermission('canViewReports'), async (req, res) => {
  try {
    const settings = await ModerationSettings.findOne({});

    res.json({
      mode: settings?.moderationV2?.moderationMode || 'SHADOW', // V4: Default to SHADOW
      lastUpdated: settings?.moderationV2?.lastUpdated || null
    });
  } catch (error) {
    logger.error('Get mode error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   PUT /api/admin/moderation-v2/mode
 * @desc    Toggle moderation mode between LIVE and SHADOW
 * @access  Super Admin (requires escalation)
 *
 * V3 SHADOW MODE:
 * - In SHADOW mode: All layers 1-4 execute, events logged, NO user-facing penalties
 * - Switching modes does not require redeploy
 */
router.put('/mode', checkPermission('canManageUsers'), requireAdminEscalation, async (req, res) => {
  try {
    const { mode } = req.body;

    if (!mode || !['LIVE', 'SHADOW'].includes(mode)) {
      return res.status(400).json({ message: 'Mode must be LIVE or SHADOW' });
    }

    // Only super_admin can toggle shadow mode
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Only super_admin can toggle moderation mode' });
    }

    let settings = await ModerationSettings.findOne({});
    if (!settings) {
      settings = new ModerationSettings({});
    }

    const previousMode = settings.moderationV2?.moderationMode || 'LIVE';

    // Update mode
    if (!settings.moderationV2) {
      settings.moderationV2 = {};
    }
    settings.moderationV2.moderationMode = mode;
    settings.moderationV2.lastUpdated = new Date();
    settings.updatedBy = req.user._id;
    await settings.save();

    // Log the action
    await AdminActionLog.create({
      adminId: req.user._id,
      actionType: 'UPDATE_SETTINGS',
      targetType: 'moderation_settings',
      targetId: settings._id,
      changes: {
        moderationMode: { from: previousMode, to: mode }
      },
      reason: `Switched moderation mode from ${previousMode} to ${mode}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    logger.info(`Moderation mode changed: ${previousMode} -> ${mode} by admin ${req.user._id}`);

    res.json({
      message: `Moderation mode set to ${mode}`,
      mode,
      previousMode,
      lastUpdated: settings.moderationV2.lastUpdated,
      effectiveImmediately: true
    });

  } catch (error) {
    logger.error('Set mode error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. GRADUAL ROLLOUT (V4)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/admin/moderation-v2/rollout
 * @desc    Get current rollout status and enabled actions
 * @access  Admin (canViewReports)
 */
router.get('/rollout', checkPermission('canViewReports'), async (req, res) => {
  try {
    const settings = await ModerationSettings.findOne({});
    const moderationV2 = settings?.moderationV2 || {};

    const enabledActions = moderationV2.enabledActions || {
      NOTE: true, DAMPEN: false, REVIEW: false, MUTE: false, BLOCK: false
    };

    // Calculate current phase
    let currentPhase = 0;
    if (enabledActions.BLOCK) currentPhase = 5;
    else if (enabledActions.MUTE) currentPhase = 4;
    else if (enabledActions.REVIEW) currentPhase = 3;
    else if (enabledActions.DAMPEN) currentPhase = 2;
    else if (enabledActions.NOTE) currentPhase = 1;

    const phases = [
      { phase: 0, name: 'Shadow Only', actions: ['NOTE'], description: 'All layers execute, no penalties' },
      { phase: 1, name: 'Logging', actions: ['NOTE'], description: 'NOTE action enabled in LIVE mode' },
      { phase: 2, name: 'Dampening', actions: ['NOTE', 'DAMPEN'], description: 'Visibility dampening enabled' },
      { phase: 3, name: 'Review Queue', actions: ['NOTE', 'DAMPEN', 'REVIEW'], description: 'Human review queue enabled' },
      { phase: 4, name: 'Muting', actions: ['NOTE', 'DAMPEN', 'REVIEW', 'MUTE'], description: 'Temporary muting enabled' },
      { phase: 5, name: 'Full Enforcement', actions: ['NOTE', 'DAMPEN', 'REVIEW', 'MUTE', 'BLOCK'], description: 'All actions enabled' }
    ];

    res.json({
      mode: moderationV2.moderationMode || 'SHADOW',
      currentPhase,
      phaseName: phases[currentPhase]?.name || 'Unknown',
      enabledActions,
      rollout: moderationV2.rollout || { startedAt: null, phaseHistory: [] },
      phases,
      lastUpdated: moderationV2.lastUpdated
    });
  } catch (error) {
    logger.error('Get rollout error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   PUT /api/admin/moderation-v2/rollout/enable
 * @desc    Enable a single action (gradual rollout - one at a time)
 * @access  Super Admin (requires escalation)
 *
 * V4 GRADUAL ENABLEMENT:
 * - Only one action can be enabled at a time
 * - Must follow rollout order: NOTE → DAMPEN → REVIEW → MUTE → BLOCK
 * - NO BULK ENABLES. NO SILENT CHANGES.
 */
router.put('/rollout/enable', adminAuth(['super_admin']), requireAdminEscalation, async (req, res) => {
  try {
    const { action } = req.body;
    const validActions = ['NOTE', 'DAMPEN', 'REVIEW', 'MUTE', 'BLOCK'];

    if (!action || !validActions.includes(action)) {
      return res.status(400).json({
        message: `Action must be one of: ${validActions.join(', ')}`
      });
    }

    let settings = await ModerationSettings.findOne({});
    if (!settings) {
      settings = new ModerationSettings({});
    }

    if (!settings.moderationV2) settings.moderationV2 = {};
    if (!settings.moderationV2.enabledActions) {
      settings.moderationV2.enabledActions = {
        NOTE: true, DAMPEN: false, REVIEW: false, MUTE: false, BLOCK: false
      };
    }
    if (!settings.moderationV2.rollout) {
      settings.moderationV2.rollout = { startedAt: null, currentPhase: 0, phaseHistory: [] };
    }

    const enabledActions = settings.moderationV2.enabledActions;

    // Check rollout order
    const rolloutOrder = ['NOTE', 'DAMPEN', 'REVIEW', 'MUTE', 'BLOCK'];
    const actionIndex = rolloutOrder.indexOf(action);

    // Ensure all previous actions are enabled
    for (let i = 0; i < actionIndex; i++) {
      if (!enabledActions[rolloutOrder[i]]) {
        return res.status(400).json({
          message: `Cannot enable ${action}. Must enable ${rolloutOrder[i]} first.`,
          hint: 'Rollout order: NOTE → DAMPEN → REVIEW → MUTE → BLOCK'
        });
      }
    }

    // Check if already enabled
    if (enabledActions[action]) {
      return res.status(400).json({ message: `${action} is already enabled` });
    }

    // Enable the action
    enabledActions[action] = true;
    settings.moderationV2.lastUpdated = new Date();
    settings.updatedBy = req.user._id;

    // Update rollout tracking
    if (!settings.moderationV2.rollout.startedAt) {
      settings.moderationV2.rollout.startedAt = new Date();
    }
    settings.moderationV2.rollout.currentPhase = actionIndex + 1;
    settings.moderationV2.rollout.phaseHistory.push({
      phase: actionIndex + 1,
      enabledAt: new Date(),
      enabledBy: req.user._id
    });

    await settings.save();

    // Log the action
    await AdminActionLog.create({
      adminId: req.user._id,
      actionType: 'UPDATE_SETTINGS',
      targetType: 'moderation_rollout',
      targetId: settings._id,
      changes: { enabledAction: action, phase: actionIndex + 1 },
      reason: `Enabled ${action} action (Phase ${actionIndex + 1})`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    logger.info(`Rollout: ${action} enabled (Phase ${actionIndex + 1}) by admin ${req.user._id}`);

    res.json({
      message: `${action} action enabled`,
      action,
      phase: actionIndex + 1,
      enabledActions,
      note: 'Observe for 48-72 hours before enabling next action'
    });

  } catch (error) {
    logger.error('Enable action error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   PUT /api/admin/moderation-v2/rollout/disable
 * @desc    Disable an action (rollback)
 * @access  Super Admin (requires escalation)
 */
router.put('/rollout/disable', adminAuth(['super_admin']), requireAdminEscalation, async (req, res) => {
  try {
    const { action } = req.body;
    const validActions = ['DAMPEN', 'REVIEW', 'MUTE', 'BLOCK']; // NOTE cannot be disabled

    if (!action || !validActions.includes(action)) {
      return res.status(400).json({
        message: `Action must be one of: ${validActions.join(', ')} (NOTE cannot be disabled)`
      });
    }

    let settings = await ModerationSettings.findOne({});
    if (!settings?.moderationV2?.enabledActions) {
      return res.status(400).json({ message: 'No rollout configuration found' });
    }

    const enabledActions = settings.moderationV2.enabledActions;

    // Check if already disabled
    if (!enabledActions[action]) {
      return res.status(400).json({ message: `${action} is already disabled` });
    }

    // Disable this action and all actions after it
    const rolloutOrder = ['NOTE', 'DAMPEN', 'REVIEW', 'MUTE', 'BLOCK'];
    const actionIndex = rolloutOrder.indexOf(action);

    for (let i = actionIndex; i < rolloutOrder.length; i++) {
      enabledActions[rolloutOrder[i]] = false;
    }
    enabledActions.NOTE = true; // NOTE always stays enabled

    settings.moderationV2.lastUpdated = new Date();
    settings.updatedBy = req.user._id;
    settings.moderationV2.rollout.currentPhase = actionIndex;

    await settings.save();

    await AdminActionLog.create({
      adminId: req.user._id,
      actionType: 'UPDATE_SETTINGS',
      targetType: 'moderation_rollout',
      targetId: settings._id,
      changes: { disabledAction: action, phase: actionIndex },
      reason: `Disabled ${action} action (rolled back to Phase ${actionIndex})`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    logger.info(`Rollout: ${action} disabled (Phase ${actionIndex}) by admin ${req.user._id}`);

    res.json({
      message: `${action} action disabled`,
      action,
      phase: actionIndex,
      enabledActions
    });

  } catch (error) {
    logger.error('Disable action error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. EMERGENCY CONTAINMENT TOGGLE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/admin/toggle-emergency
 * @desc    Enable or disable Emergency Containment mode
 * @access  Admin (canManageUsers)
 *
 * When ENABLED:
 *   - Blocks new post creation for accounts < 24 hours old
 *   - Reduces post rate limit to 1 per 10 minutes (enforced in posts.js)
 *   - Disables global chat route (enforced in globalChat.js)
 *   - Restricts DMs to mutual-follow only (enforced in messages.js)
 *
 * All changes are in-memory and fully reversible without a redeploy.
 * Toggle event is logged to AdminActionLog for audit trail.
 */
router.post('/toggle-emergency', checkPermission('canManageUsers'), async (req, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: '`enabled` (boolean) is required' });
    }

    const previousState = isFeatureEnabled('EMERGENCY_CONTAINMENT');

    if (enabled) {
      setAdminOverride('EMERGENCY_CONTAINMENT', true, req.user._id);
    } else {
      removeAdminOverride('EMERGENCY_CONTAINMENT');
    }

    await AdminActionLog.logAction({
      actorId: req.user._id,
      action: enabled ? 'EMERGENCY_CONTAINMENT_ENABLED' : 'EMERGENCY_CONTAINMENT_DISABLED',
      targetType: 'PLATFORM',
      targetId: null,
      details: {
        previousState,
        newState: enabled,
        reason: req.body.reason || null
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    logger.warn(
      `[Emergency Containment] ${enabled ? 'ENABLED' : 'DISABLED'} by admin ${req.user._id} from ${req.ip}`
    );

    res.json({
      success: true,
      emergencyContainment: enabled,
      message: enabled
        ? 'Emergency containment ENABLED — new posts from new accounts blocked, rate limits tightened, global chat disabled, DMs restricted.'
        : 'Emergency containment DISABLED — platform restored to normal operation.'
    });
  } catch (error) {
    logger.error('Toggle emergency containment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   GET /api/admin/toggle-emergency
 * @desc    Get current Emergency Containment state
 * @access  Admin (canViewReports)
 */
router.get('/toggle-emergency', checkPermission('canViewReports'), (req, res) => {
  const active = isFeatureEnabled('EMERGENCY_CONTAINMENT');
  res.json({ emergencyContainment: active });
});

// ═══════════════════════════════════════════════════════════════════════════
// GOVERNANCE V1: ADMIN OVERRIDE — RESTORE & FULL RESET
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/admin/moderation-v2/restore-user/:userId
 * @desc    Fully restore a user: clear governanceStatus, restrictedUntil, and all strike counters.
 *          Works for permanently banned users (overrideable by design).
 * @access  Admin (canManageUsers)
 *
 * Body (optional):
 *   reason {string} - Admin reason for the restore (logged for audit)
 *
 * Logs a ModerationEvent with action RESTORE_AND_RESET and a ModerationOverride record.
 */
router.post('/restore-user/:userId', checkPermission('canManageUsers'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason = 'Admin restore and reset' } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const previousStatus = user.governanceStatus;

    // ── Full reset ──────────────────────────────────────────────────────────
    user.governanceStatus = 'active';
    user.restrictedUntil  = null;
    user.postStrikes      = 0;
    user.commentStrikes   = 0;
    user.dmStrikes        = 0;
    user.globalStrikes    = 0;

    await user.save();

    // ── Log ModerationEvent ─────────────────────────────────────────────────
    let moderationEventId = null;
    try {
      const event = await ModerationEvent.create({
        userId: user._id,
        contentType: 'other',
        contentId: null,
        contentPreview: '',
        expression: { classification: 'normal', expressiveRatio: 0, realWordRatio: 0 },
        intent:     { category: 'neutral', score: 0, targetDetected: false },
        behavior:   { score: 0, trend: 'stable', accountAgeDays: 0 },
        response: {
          action:          'RESTORE_AND_RESET',
          durationMinutes: 0,
          automated:       false
        },
        confidence:      100,
        explanationCode: 'RESTORE_AND_RESET',
        shadowMode:      false,
        strikeCategory:  null,
        strikeLevel:     null,
        globalStrikeCount: 0,
        restrictionDurationMs: 0,
        overrideStatus: 'overridden'
      });
      moderationEventId = event._id;
    } catch (eventErr) {
      logger.error('[GOVERNANCE] restore-user: failed to create ModerationEvent:', eventErr);
    }

    // ── Log ModerationOverride ──────────────────────────────────────────────
    if (moderationEventId) {
      try {
        await ModerationOverride.create({
          eventId:        moderationEventId,
          userId:         user._id,
          adminId:        req.user._id,
          overrideAction: 'CLEAR_STRIKES',
          reason,
          originalDecision: { action: previousStatus },
          newDecision:      { action: 'RESTORE_AND_RESET' },
          trainSystem:      false,
          applied:          true
        });
      } catch (overrideErr) {
        logger.error('[GOVERNANCE] restore-user: failed to create ModerationOverride:', overrideErr);
      }
    }

    // ── Log AdminActionLog ──────────────────────────────────────────────────
    try {
      await AdminActionLog.logAction({
        actorId:    req.user._id,
        action:     'RESTORE_AND_RESET',
        targetType: 'USER',
        targetId:   user._id,
        details: {
          previousStatus,
          newStatus:      'active',
          strikesCleared: true,
          reason
        },
        ipAddress:  req.ip,
        userAgent:  req.get('User-Agent')
      });
    } catch (logErr) {
      logger.warn('[GOVERNANCE] restore-user: failed to log AdminActionLog:', logErr);
    }

    logger.info(
      `[GOVERNANCE] Admin ${req.user._id} restored user ${user._id} (was: ${previousStatus})`
    );

    return res.json({
      success:        true,
      userId:         user._id,
      previousStatus,
      newStatus:      'active',
      strikesCleared: true,
      message:        'User fully restored and all strike counters reset.'
    });

  } catch (error) {
    logger.error('restore-user error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

export default router;

