/**
 * Badge Routes
 *
 * Public: Get available badges
 * Admin: Assign/revoke badges, manage badge definitions
 */

import express from 'express';
import auth from '../middleware/auth.js';
import adminAuth from '../middleware/adminAuth.js';
import Badge from '../models/Badge.js';
import User from '../models/User.js';

const router = express.Router();

// ============================================================
// PUBLIC ROUTES
// ============================================================

// @route   GET /api/badges
// @desc    Get all active badges
// @access  Public
router.get('/', async (req, res) => {
  try {
    const badges = await Badge.find({ isActive: true })
      .sort({ priority: 1, label: 1 })
      .lean();
    res.json(badges);
  } catch (error) {
    console.error('Get badges error:', error);
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

// @route   GET /api/badges/user/:userId
// @desc    Get badges for a specific user (with full badge details)
// @access  Public
router.get('/user/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('badges').lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get full badge details for user's badges
    const badges = await Badge.find({
      id: { $in: user.badges || [] },
      isActive: true
    }).sort({ priority: 1 }).lean();

    res.json(badges);
  } catch (error) {
    console.error('Get user badges error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================================
// ADMIN ROUTES
// ============================================================

// @route   POST /api/badges
// @desc    Create a new badge (admin only)
// @access  Admin
router.post('/', auth, adminAuth(['admin', 'super_admin']), async (req, res) => {
  try {
    const { id, label, type, icon, tooltip, priority, color } = req.body;

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
      priority: priority || 100,
      color: color || 'default'
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
    const { label, type, icon, tooltip, priority, color, isActive } = req.body;

    const badge = await Badge.findOne({ id: req.params.id });
    if (!badge) {
      return res.status(404).json({ message: 'Badge not found' });
    }

    // Update fields if provided
    if (label) badge.label = label;
    if (type) badge.type = type;
    if (icon) badge.icon = icon;
    if (tooltip) badge.tooltip = tooltip;
    if (priority !== undefined) badge.priority = priority;
    if (color) badge.color = color;
    if (isActive !== undefined) badge.isActive = isActive;

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
router.post('/assign', auth, adminAuth(['admin', 'super_admin']), async (req, res) => {
  try {
    const { userId, badgeId } = req.body;

    if (!userId || !badgeId) {
      return res.status(400).json({ message: 'Missing userId or badgeId' });
    }

    // Verify badge exists
    const badge = await Badge.findOne({ id: badgeId, isActive: true });
    if (!badge) {
      return res.status(404).json({ message: 'Badge not found or inactive' });
    }

    // Add badge to user (using $addToSet to prevent duplicates)
    const user = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { badges: badgeId } },
      { new: true }
    ).select('badges username displayName');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

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
    const { userId, badgeId } = req.body;

    if (!userId || !badgeId) {
      return res.status(400).json({ message: 'Missing userId or badgeId' });
    }

    // Remove badge from user
    const user = await User.findByIdAndUpdate(
      userId,
      { $pull: { badges: badgeId } },
      { new: true }
    ).select('badges username displayName');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Badge revoked successfully',
      user: { id: user._id, username: user.username, badges: user.badges }
    });
  } catch (error) {
    console.error('Revoke badge error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
