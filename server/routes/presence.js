/**
 * Life-Signal Feature 5: Soft Presence States
 * 
 * Optional, non-performative presence indicators.
 * - No timestamps shown to others
 * - Opt-in visibility
 * - States: listening, low_energy, open, lurking
 */

import express from 'express';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Valid presence states
const VALID_STATES = ['listening', 'low_energy', 'open', 'lurking', null];

// @route   GET /api/presence
// @desc    Get current user's presence settings
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('presenceState presenceVisible');
    
    res.json({
      state: user.presenceState,
      visible: user.presenceVisible
    });
  } catch (error) {
    console.error('Get presence error:', error);
    res.status(500).json({ message: 'Failed to fetch presence' });
  }
});

// @route   PATCH /api/presence
// @desc    Update presence state and/or visibility
// @access  Private
router.patch('/', authenticateToken, async (req, res) => {
  try {
    const { state, visible } = req.body;
    
    const updates = {};
    
    // Validate and set state
    if (state !== undefined) {
      if (!VALID_STATES.includes(state)) {
        return res.status(400).json({ 
          message: 'Invalid presence state',
          validStates: VALID_STATES.filter(s => s !== null)
        });
      }
      updates.presenceState = state;
      updates.presenceUpdatedAt = Date.now();
    }
    
    // Set visibility
    if (visible !== undefined) {
      updates.presenceVisible = Boolean(visible);
    }
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true }
    ).select('presenceState presenceVisible');
    
    res.json({
      state: user.presenceState,
      visible: user.presenceVisible
    });
  } catch (error) {
    console.error('Update presence error:', error);
    res.status(500).json({ message: 'Failed to update presence' });
  }
});

// @route   DELETE /api/presence
// @desc    Clear presence state (set to null)
// @access  Private
router.delete('/', authenticateToken, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      presenceState: null,
      presenceUpdatedAt: Date.now()
    });
    
    res.json({ message: 'Presence cleared', state: null });
  } catch (error) {
    console.error('Clear presence error:', error);
    res.status(500).json({ message: 'Failed to clear presence' });
  }
});

// @route   GET /api/presence/friends
// @desc    Get presence states of friends who have visibility enabled
// @access  Private
router.get('/friends', authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id).select('following');
    
    if (!currentUser.following || currentUser.following.length === 0) {
      return res.json({ friends: [] });
    }
    
    // Get friends with visible presence
    const friendsWithPresence = await User.find({
      _id: { $in: currentUser.following },
      presenceVisible: true,
      presenceState: { $ne: null }
    }).select('username displayName profilePhoto presenceState');
    
    res.json({
      friends: friendsWithPresence.map(f => ({
        id: f._id,
        username: f.username,
        displayName: f.displayName,
        profilePhoto: f.profilePhoto,
        state: f.presenceState
        // Note: No timestamp exposed
      }))
    });
  } catch (error) {
    console.error('Get friends presence error:', error);
    res.status(500).json({ message: 'Failed to fetch friends presence' });
  }
});

export default router;

