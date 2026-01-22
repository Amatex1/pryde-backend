/**
 * Badge Routes
 *
 * Public: Get available badges, badge explanations
 * Admin: Assign/revoke badges, manage badge definitions, view audit log
 *
 * Badge System v1 Principles:
 * - Badges communicate context, not status
 * - No popularity or ranking badges
 * - Automatic badges are system-owned
 * - Manual badges require intent and accountability (reason required)
 * - Badges must never undermine Quiet Mode
 */

import express from 'express';
import auth from '../middleware/auth.js';
import adminAuth from '../middleware/adminAuth.js';
import { cacheLong, cacheMedium } from '../middleware/caching.js';
import Badge from '../models/Badge.js';
import BadgeAssignmentLog from '../models/BadgeAssignmentLog.js';
import User from '../models/User.js';
import {
  processUserBadgesById,
  runBatchBadgeProcessing,
  seedAutomaticBadges
} from '../services/autoBadgeService.js';

const router = express.Router();

// ============================================================
// PUBLIC ROUTES
// ============================================================

// @route   GET /api/badges
// @desc    Get all active badges with optional filtering
// @access  Public
router.get('/', cacheLong, async (req, res) => {
  try {
    const { type, assignmentType } = req.query;
    const query = { isActive: true };

    if (type) query.type = type;
    if (assignmentType) query.assignmentType = assignmentType;

    const badges = await Badge.find(query)
      .sort({ priority: 1, label: 1 })
      .lean();
    res.json(badges);
  } catch (error) {
    console.error('Get badges error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/badges/explain
// @desc    Get user-facing explanation of the badge system
// @access  Public
router.get('/explain', cacheLong, async (req, res) => {
  try {
    res.json({
      title: 'About Badges',
      description: 'Badges on Pryde are contextual signals that help you understand a bit more about other members. They are not rankings or popularity markers.',
      principles: [
        'Badges communicate context, not status',
        'Some badges are automatically assigned based on facts (like when you joined)',
        'Some badges are manually assigned by our team for recognition',
        'Badges never indicate popularity or ranking'
      ],
      quietModeNote: 'Badges can be hidden if you prefer a calmer experience. Enable "Hide badges" in your Quiet Mode settings.',
      categories: {
        automatic: {
          label: 'Automatic Badges',
          description: 'These are assigned by the system based on facts about your account.',
          examples: ['Early Member', 'Founding Member', 'Profile Complete']
        },
        manual: {
          label: 'Recognition Badges',
          description: 'These are assigned by our team to recognize contributions.',
          examples: ['Community Champion', 'Pryde Team']
        }
      }
    });
  } catch (error) {
    console.error('Get badge explanation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/badges/catalog
// @desc    Get badge catalog with categories
// @access  Public
router.get('/catalog', cacheLong, async (req, res) => {
  try {
    const badges = await Badge.find({ isActive: true })
      .sort({ priority: 1, label: 1 })
      .lean();

    // Group by assignment type
    const automatic = badges.filter(b => b.assignmentType === 'automatic');
    const manual = badges.filter(b => b.assignmentType === 'manual');

    res.json({
      automatic: {
        label: 'Automatic Badges',
        description: 'Assigned by the system based on account activity and facts',
        badges: automatic
      },
      manual: {
        label: 'Recognition Badges',
        description: 'Assigned by admins for community contributions',
        badges: manual
      },
      total: badges.length
    });
  } catch (error) {
    console.error('Get badge catalog error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/badges/me
// @desc    Get current user's badges and badge settings
// @access  Authenticated
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('badges publicBadges hiddenBadges privacySettings.hideBadges')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get full badge details
    const badges = await Badge.find({
      id: { $in: user.badges || [] },
      isActive: true
    }).sort({ priority: 1 }).lean();

    res.json({
      badges,
      publicBadges: user.publicBadges || [],
      hiddenBadges: user.hiddenBadges || [],
      hideBadges: user.privacySettings?.hideBadges || false,
      count: badges.length
    });
  } catch (error) {
    console.error('Get my badges error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/badges/me/visibility
// @desc    Update badge visibility settings (public/hidden badges)
// @access  Authenticated
router.put('/me/visibility', auth, async (req, res) => {
  try {
    const { publicBadges, hiddenBadges } = req.body;

    // Get user's current badges
    const user = await User.findById(req.userId).select('badges');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If user has no badges, allow empty arrays but reject non-empty ones
    if (!user.badges || user.badges.length === 0) {
      if ((publicBadges && publicBadges.length > 0) || (hiddenBadges && hiddenBadges.length > 0)) {
        return res.status(400).json({ message: 'You have no badges to configure' });
      }
      // Allow setting empty arrays even with no badges
      const updatedUser = await User.findByIdAndUpdate(
        req.userId,
        { $set: { publicBadges: [], hiddenBadges: [] } },
        { new: true, runValidators: true }
      ).select('badges publicBadges hiddenBadges');

      return res.json({
        message: 'Badge visibility updated',
        badges: updatedUser.badges || [],
        publicBadges: updatedUser.publicBadges || [],
        hiddenBadges: updatedUser.hiddenBadges || []
      });
    }

    // Validate that all publicBadges belong to user
    if (publicBadges && publicBadges.length > 0) {
      const invalidBadges = publicBadges.filter(badgeId => !user.badges.includes(badgeId));
      if (invalidBadges.length > 0) {
        return res.status(400).json({ message: 'You can only make your own badges public' });
      }

      // Validate publicBadges array (excluding CORE_ROLE badges from the 3-badge limit)
      const publicBadgeDetails = await Badge.find({ id: { $in: publicBadges } }).select('id category');
      const nonCoreRoleBadges = publicBadgeDetails.filter(b => b.category !== 'CORE_ROLE');
      if (nonCoreRoleBadges.length > 3) {
        return res.status(400).json({
          message: 'You can only display up to 3 public badges (excluding core role badges like Founder/Admin/Moderator/Verified)'
        });
      }
    }

    // Validate that hiddenBadges are not CORE_ROLE badges
    if (hiddenBadges && hiddenBadges.length > 0) {
      const badgesToHide = await Badge.find({ id: { $in: hiddenBadges } }).select('id category');
      const coreRoleBadges = badgesToHide.filter(b => b.category === 'CORE_ROLE');
      if (coreRoleBadges.length > 0) {
        return res.status(400).json({
          message: 'Core role badges (Founder/Admin/Moderator/Verified) cannot be hidden'
        });
      }
    }

    // Update user's badge visibility settings
    const updateData = {};
    if (publicBadges !== undefined) updateData.publicBadges = publicBadges;
    if (hiddenBadges !== undefined) updateData.hiddenBadges = hiddenBadges;

    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('badges publicBadges hiddenBadges');

    res.json({
      message: 'Badge visibility updated successfully',
      publicBadges: updatedUser.publicBadges,
      hiddenBadges: updatedUser.hiddenBadges
    });
  } catch (error) {
    console.error('Update badge visibility error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/badges/user/:userId
// @desc    Get badges for a specific user (with full badge details, respecting visibility settings)
// @access  Public
router.get('/user/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('badges publicBadges hiddenBadges privacySettings.hideBadges')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If user has hidden badges, return empty array (respect Quiet Mode)
    if (user.privacySettings?.hideBadges) {
      return res.json([]);
    }

    // Get full badge details for user's badges
    const allBadges = await Badge.find({
      id: { $in: user.badges || [] },
      isActive: true
    }).lean();

    // Filter badges based on user's visibility settings
    let visibleBadges = allBadges;

    // If user has configured public badges, show only those + CORE_ROLE badges
    if (user.publicBadges && user.publicBadges.length > 0) {
      visibleBadges = allBadges.filter(badge =>
        badge.category === 'CORE_ROLE' || user.publicBadges.includes(badge.id)
      );
    } else {
      // Otherwise, show all badges except hidden ones
      visibleBadges = allBadges.filter(badge =>
        !user.hiddenBadges?.includes(badge.id)
      );
    }

    // Sort by priority
    visibleBadges.sort((a, b) => (a.priority || 100) - (b.priority || 100));

    res.json(visibleBadges);
  } catch (error) {
    console.error('Get user badges error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/badges/:id
// @desc    Get a specific badge by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const badge = await Badge.findOne({ id: req.params.id }).lean();
    if (!badge) {
      return res.status(404).json({ message: 'Badge not found' });
    }
    res.json(badge);
  } catch (error) {
    console.error('Get badge error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================================
// ADMIN ROUTES
// ============================================================

// @route   GET /api/badges/admin/catalog
// @desc    Get full badge catalog for admin panel (includes inactive)
// @access  Admin
router.get('/admin/catalog', auth, adminAuth(['admin', 'super_admin']), async (req, res) => {
  try {
    const badges = await Badge.find({})
      .sort({ assignmentType: 1, priority: 1, label: 1 })
      .lean();

    // Group by assignment type
    const automatic = badges.filter(b => b.assignmentType === 'automatic');
    const manual = badges.filter(b => b.assignmentType === 'manual');

    res.json({
      automatic: {
        label: 'Automatic Badges (View Only)',
        description: 'System-assigned badges based on rules. Cannot be manually assigned.',
        badges: automatic
      },
      manual: {
        label: 'Manual Badges',
        description: 'Admin-assigned badges. Require a reason for accountability.',
        badges: manual
      },
      total: badges.length
    });
  } catch (error) {
    console.error('Get admin badge catalog error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/badges/admin/audit-log
// @desc    Get badge assignment audit log
// @access  Admin
router.get('/admin/audit-log', auth, adminAuth(['admin', 'super_admin']), async (req, res) => {
  try {
    const { limit = 50, page = 1, userId, badgeId, action, isAutomatic } = req.query;
    const query = {};

    if (userId) query.userId = userId;
    if (badgeId) query.badgeId = badgeId;
    if (action) query.action = action;
    if (isAutomatic !== undefined) query.isAutomatic = isAutomatic === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      BadgeAssignmentLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      BadgeAssignmentLog.countDocuments(query)
    ]);

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get badge audit log error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/badges/admin/audit-stats
// @desc    Get badge assignment audit statistics (to identify churn)
// @access  Admin
router.get('/admin/audit-stats', auth, adminAuth(['admin', 'super_admin']), async (req, res) => {
  try {
    // Get badge churn by badge type
    const badgeStats = await BadgeAssignmentLog.aggregate([
      {
        $group: {
          _id: { badgeId: '$badgeId', action: '$action' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get users with the most badge changes
    const userChurn = await BadgeAssignmentLog.aggregate([
      {
        $group: {
          _id: '$userId',
          username: { $first: '$username' },
          totalChanges: { $sum: 1 },
          assigned: { $sum: { $cond: [{ $eq: ['$action', 'assigned'] }, 1, 0] } },
          revoked: { $sum: { $cond: [{ $eq: ['$action', 'revoked'] }, 1, 0] } }
        }
      },
      { $sort: { totalChanges: -1 } },
      { $limit: 20 }
    ]);

    // Get recent churn patterns (same badge assigned/revoked within 48 hours)
    const recentChurn = await BadgeAssignmentLog.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 48 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: { userId: '$userId', badgeId: '$badgeId' },
          username: { $first: '$username' },
          actions: { $push: { action: '$action', time: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $match: { count: { $gte: 2 } } }, // Only show if 2+ changes for same badge
      { $sort: { count: -1 } },
      { $limit: 50 }
    ]);

    // Overall stats
    const overallStats = await BadgeAssignmentLog.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          assigned: { $sum: { $cond: [{ $eq: ['$action', 'assigned'] }, 1, 0] } },
          revoked: { $sum: { $cond: [{ $eq: ['$action', 'revoked'] }, 1, 0] } },
          automatic: { $sum: { $cond: ['$isAutomatic', 1, 0] } },
          manual: { $sum: { $cond: ['$isAutomatic', 0, 1] } }
        }
      }
    ]);

    res.json({
      overall: overallStats[0] || { total: 0, assigned: 0, revoked: 0, automatic: 0, manual: 0 },
      byBadge: badgeStats,
      topUserChurn: userChurn,
      recentChurn: recentChurn
    });
  } catch (error) {
    console.error('Get badge audit stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/badges
// @desc    Create a new badge (admin only)
// @access  Admin
router.post('/', auth, adminAuth(['admin', 'super_admin']), async (req, res) => {
  try {
    const { id, label, type, icon, tooltip, priority, color, assignmentType, automaticRule, description } = req.body;

    // Validate required fields
    if (!id || !label || !type || !tooltip) {
      return res.status(400).json({ message: 'Missing required fields: id, label, type, tooltip' });
    }

    // Check if badge already exists
    const existing = await Badge.findOne({ id: id.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'Badge with this ID already exists' });
    }

    const badge = new Badge({
      id: id.toLowerCase(),
      label,
      type,
      icon: icon || '⭐',
      tooltip,
      description: description || '',
      priority: priority || 100,
      color: color || 'default',
      assignmentType: assignmentType || 'manual',
      automaticRule: automaticRule || null
    });

    await badge.save();
    res.status(201).json(badge);
  } catch (error) {
    console.error('Create badge error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/badges/:id
// @desc    Update a badge (admin only)
// @access  Admin
router.put('/:id', auth, adminAuth(['admin', 'super_admin']), async (req, res) => {
  try {
    const { label, type, icon, tooltip, priority, color, isActive, description, assignmentType, automaticRule } = req.body;

    const badge = await Badge.findOne({ id: req.params.id });
    if (!badge) {
      return res.status(404).json({ message: 'Badge not found' });
    }

    // Update fields if provided
    if (label) badge.label = label;
    if (type) badge.type = type;
    if (icon) badge.icon = icon;
    if (tooltip) badge.tooltip = tooltip;
    if (description !== undefined) badge.description = description;
    if (priority !== undefined) badge.priority = priority;
    if (color) badge.color = color;
    if (isActive !== undefined) badge.isActive = isActive;
    if (assignmentType) badge.assignmentType = assignmentType;
    if (automaticRule !== undefined) badge.automaticRule = automaticRule;

    await badge.save();
    res.json(badge);
  } catch (error) {
    console.error('Update badge error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/badges/assign
// @desc    Assign a badge to a user (admin only)
// @access  Admin
// Manual badges REQUIRE a reason for accountability
router.post('/assign', auth, adminAuth(['admin', 'super_admin']), async (req, res) => {
  try {
    const { userId, badgeId, reason } = req.body;

    if (!userId || !badgeId) {
      return res.status(400).json({ message: 'Missing userId or badgeId' });
    }

    // Verify badge exists
    const badge = await Badge.findOne({ id: badgeId, isActive: true });
    if (!badge) {
      return res.status(404).json({ message: 'Badge not found or inactive' });
    }

    // Manual badges require a reason
    if (badge.assignmentType === 'manual' && (!reason || reason.trim().length < 10)) {
      return res.status(400).json({
        message: 'Manual badge assignments require a reason (minimum 10 characters)'
      });
    }

    // Check if user already has this badge
    const existingUser = await User.findById(userId).select('badges username');
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (existingUser.badges.includes(badgeId)) {
      return res.status(400).json({ message: 'User already has this badge' });
    }

    // Add badge to user
    const user = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { badges: badgeId } },
      { new: true }
    ).select('badges username displayName');

    // Create audit log entry
    await BadgeAssignmentLog.create({
      userId: user._id,
      username: user.username,
      badgeId: badge.id,
      badgeLabel: badge.label,
      action: 'assigned',
      performedBy: req.userId,
      performedByUsername: req.user.username,
      isAutomatic: false,
      reason: reason || ''
    });

    res.json({
      message: 'Badge assigned successfully',
      user: { id: user._id, username: user.username, badges: user.badges }
    });
  } catch (error) {
    console.error('Assign badge error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/badges/revoke
// @desc    Revoke a badge from a user (admin only)
// @access  Admin
router.post('/revoke', auth, adminAuth(['admin', 'super_admin']), async (req, res) => {
  try {
    const { userId, badgeId, reason } = req.body;

    if (!userId || !badgeId) {
      return res.status(400).json({ message: 'Missing userId or badgeId' });
    }

    // Get badge info for audit log
    const badge = await Badge.findOne({ id: badgeId });

    // Get user info before update
    const existingUser = await User.findById(userId).select('badges username');
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!existingUser.badges.includes(badgeId)) {
      return res.status(400).json({ message: 'User does not have this badge' });
    }

    // Remove badge from user
    const user = await User.findByIdAndUpdate(
      userId,
      { $pull: { badges: badgeId } },
      { new: true }
    ).select('badges username displayName');

    // Create audit log entry
    await BadgeAssignmentLog.create({
      userId: user._id,
      username: user.username,
      badgeId: badgeId,
      badgeLabel: badge?.label || badgeId,
      action: 'revoked',
      performedBy: req.userId,
      performedByUsername: req.user.username,
      isAutomatic: false,
      reason: reason || ''
    });

    res.json({
      message: 'Badge revoked successfully',
      user: { id: user._id, username: user.username, badges: user.badges }
    });
  } catch (error) {
    console.error('Revoke badge error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================================
// ADMIN ROUTE ALIASES (for frontend compatibility)
// These routes alias to the main routes above
// ============================================================

// @route   POST /api/badges/admin/create
// @desc    Create a new badge (alias for POST /api/badges)
// @access  Admin
router.post('/admin/create', auth, adminAuth(['admin', 'super_admin']), async (req, res) => {
  try {
    const { id, label, type, icon, tooltip, priority, color, assignmentType, automaticRule, description } = req.body;

    // Validate required fields
    if (!id || !label || !type || !tooltip) {
      return res.status(400).json({ message: 'Missing required fields: id, label, type, tooltip' });
    }

    // Check if badge already exists
    const existing = await Badge.findOne({ id: id.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'Badge with this ID already exists' });
    }

    const badge = new Badge({
      id: id.toLowerCase(),
      label,
      type,
      icon: icon || '⭐',
      tooltip,
      description: description || '',
      priority: priority || 100,
      color: color || 'default',
      assignmentType: assignmentType || 'manual',
      automaticRule: automaticRule || null
    });

    await badge.save();
    res.status(201).json(badge);
  } catch (error) {
    console.error('Create badge error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/badges/admin/assign
// @desc    Assign a badge to a user (alias for POST /api/badges/assign)
// @access  Admin
router.post('/admin/assign', auth, adminAuth(['admin', 'super_admin']), async (req, res) => {
  try {
    const { userId, badgeId, reason } = req.body;

    if (!userId || !badgeId) {
      return res.status(400).json({ message: 'Missing userId or badgeId' });
    }

    // Verify badge exists
    const badge = await Badge.findOne({ id: badgeId, isActive: true });
    if (!badge) {
      return res.status(404).json({ message: 'Badge not found or inactive' });
    }

    // For manual badges, reason is required (accountability)
    if (badge.assignmentType === 'manual' && !reason) {
      return res.status(400).json({ message: 'Reason required for manual badge assignment' });
    }

    // Check if user already has badge
    const existingUser = await User.findById(userId).select('badges username');
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (existingUser.badges.includes(badgeId)) {
      return res.status(400).json({ message: 'User already has this badge' });
    }

    // Assign badge
    const user = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { badges: badgeId } },
      { new: true }
    ).select('badges username displayName');

    // Create audit log entry
    await BadgeAssignmentLog.create({
      userId: user._id,
      username: user.username,
      badgeId: badgeId,
      badgeLabel: badge.label,
      action: 'assigned',
      performedBy: req.userId,
      performedByUsername: req.user.username,
      isAutomatic: false,
      reason: reason || ''
    });

    res.json({
      message: 'Badge assigned successfully',
      user: { id: user._id, username: user.username, badges: user.badges }
    });
  } catch (error) {
    console.error('Assign badge error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/badges/admin/revoke
// @desc    Revoke a badge from a user (alias for POST /api/badges/revoke)
// @access  Admin
router.post('/admin/revoke', auth, adminAuth(['admin', 'super_admin']), async (req, res) => {
  try {
    const { userId, badgeId, reason } = req.body;

    if (!userId || !badgeId) {
      return res.status(400).json({ message: 'Missing userId or badgeId' });
    }

    // Get badge info for audit log
    const badge = await Badge.findOne({ id: badgeId });

    // Get user info before update
    const existingUser = await User.findById(userId).select('badges username');
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!existingUser.badges.includes(badgeId)) {
      return res.status(400).json({ message: 'User does not have this badge' });
    }

    // Remove badge from user
    const user = await User.findByIdAndUpdate(
      userId,
      { $pull: { badges: badgeId } },
      { new: true }
    ).select('badges username displayName');

    // Create audit log entry
    await BadgeAssignmentLog.create({
      userId: user._id,
      username: user.username,
      badgeId: badgeId,
      badgeLabel: badge?.label || badgeId,
      action: 'revoked',
      performedBy: req.userId,
      performedByUsername: req.user.username,
      isAutomatic: false,
      reason: reason || ''
    });

    res.json({
      message: 'Badge revoked successfully',
      user: { id: user._id, username: user.username, badges: user.badges }
    });
  } catch (error) {
    console.error('Revoke badge error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/badges/admin/process-user/:userId
// @desc    Process automatic badges for a specific user
// @access  Admin
router.post('/admin/process-user/:userId', auth, adminAuth(['admin', 'super_admin']), async (req, res) => {
  try {
    const results = await processUserBadgesById(req.params.userId);

    if (results.error) {
      return res.status(400).json({ message: results.error });
    }

    res.json({
      message: 'User badges processed',
      results
    });
  } catch (error) {
    console.error('Process user badges error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/badges/admin/run-batch
// @desc    Run batch processing for all users (super_admin only)
// @access  Super Admin
router.post('/admin/run-batch', auth, adminAuth(['super_admin']), async (req, res) => {
  try {
    const { dryRun = false } = req.body;

    // Run in background (don't block the response)
    res.json({
      message: 'Batch processing started',
      dryRun,
      note: 'Check server logs for progress'
    });

    // Process after response
    setImmediate(async () => {
      const summary = await runBatchBadgeProcessing({ dryRun });
      console.log('Batch processing complete:', summary);
    });
  } catch (error) {
    console.error('Run batch processing error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/badges/admin/seed
// @desc    Seed default automatic badges (super_admin only)
// @access  Super Admin
router.post('/admin/seed', auth, adminAuth(['super_admin']), async (req, res) => {
  try {
    const results = await seedAutomaticBadges();
    res.json({
      message: 'Automatic badges seeded',
      results
    });
  } catch (error) {
    console.error('Seed badges error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
