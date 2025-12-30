/**
 * Safe Mode Routes
 * 
 * User-controlled stability fallback
 * 
 * When Safe Mode is ON:
 * - Disable service worker
 * - Disable sockets
 * - Disable background polling
 * - Disable optimistic UI
 * - Force REST-only, deterministic behavior
 * - Use minimal layouts & animations
 * 
 * Safe Mode persists across sessions
 */

import express from 'express';
import auth from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

// @route   GET /api/safe-mode/status
// @desc    Get current Safe Mode status
// @access  Private
router.get('/status', async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('privacySettings.safeModeEnabled');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      safeModeEnabled: user.privacySettings?.safeModeEnabled || false
    });
  } catch (error) {
    console.error('Get Safe Mode status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/safe-mode/enable
// @desc    Enable Safe Mode
// @access  Private
router.post('/enable', async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // SAFETY: Ensure privacySettings exists for older users
    if (!user.privacySettings) {
      user.privacySettings = {};
    }
    user.privacySettings.safeModeEnabled = true;
    await user.save();
    
    console.log(`✅ [Safe Mode] Enabled for user ${user.username}`);
    
    res.json({
      success: true,
      message: 'Safe Mode enabled',
      safeModeEnabled: true
    });
  } catch (error) {
    console.error('Enable Safe Mode error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/safe-mode/disable
// @desc    Disable Safe Mode
// @access  Private
router.post('/disable', async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // SAFETY: Ensure privacySettings exists for older users
    if (!user.privacySettings) {
      user.privacySettings = {};
    }
    user.privacySettings.safeModeEnabled = false;
    await user.save();
    
    console.log(`✅ [Safe Mode] Disabled for user ${user.username}`);
    
    res.json({
      success: true,
      message: 'Safe Mode disabled',
      safeModeEnabled: false
    });
  } catch (error) {
    console.error('Disable Safe Mode error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/safe-mode/toggle
// @desc    Toggle Safe Mode on/off
// @access  Private
router.put('/toggle', async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // SAFETY: Ensure privacySettings exists for older users
    if (!user.privacySettings) {
      user.privacySettings = {};
    }
    const newState = !user.privacySettings.safeModeEnabled;
    user.privacySettings.safeModeEnabled = newState;
    await user.save();
    
    console.log(`✅ [Safe Mode] Toggled to ${newState} for user ${user.username}`);
    
    res.json({
      success: true,
      message: `Safe Mode ${newState ? 'enabled' : 'disabled'}`,
      safeModeEnabled: newState
    });
  } catch (error) {
    console.error('Toggle Safe Mode error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

