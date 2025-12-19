import express from 'express';
const router = express.Router();
import User from '../models/User.js';
import Block from '../models/Block.js';
import auth from '../middleware/auth.js';

// @route   GET /api/privacy
// @desc    Get current user's privacy settings
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('privacySettings blockedUsers');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      privacySettings: user.privacySettings,
      blockedUsers: user.blockedUsers
    });
  } catch (error) {
    console.error('Get privacy settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/privacy
// @desc    Update privacy settings
// @access  Private
router.put('/', auth, async (req, res) => {
  try {
    const { privacySettings } = req.body;

    if (!privacySettings) {
      return res.status(400).json({ message: 'Privacy settings are required' });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Initialize privacySettings if it doesn't exist
    if (!user.privacySettings) {
      user.privacySettings = {};
    }

    // Update privacy settings - convert to plain object first to avoid Mongoose issues
    const currentSettings = user.privacySettings.toObject ? user.privacySettings.toObject() : user.privacySettings;
    user.privacySettings = {
      ...currentSettings,
      ...privacySettings
    };

    // Mark the nested object as modified so Mongoose saves it
    user.markModified('privacySettings');

    await user.save();

    res.json({
      message: 'Privacy settings updated successfully',
      privacySettings: user.privacySettings
    });
  } catch (error) {
    console.error('Update privacy settings error:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/privacy/block/:userId
// @desc    Block a user (MIGRATED TO BLOCK MODEL)
// @access  Private
router.post('/block/:userId', auth, async (req, res) => {
  try {
    const userIdToBlock = req.params.userId;
    const currentUserId = req.userId;

    if (userIdToBlock === currentUserId) {
      return res.status(400).json({ message: 'You cannot block yourself' });
    }

    const userToBlock = await User.findById(userIdToBlock);

    if (!userToBlock) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already blocked using Block model
    const existingBlock = await Block.findOne({
      blocker: currentUserId,
      blocked: userIdToBlock
    });

    if (existingBlock) {
      return res.status(400).json({ message: 'User is already blocked' });
    }

    // Create block in Block collection
    const block = new Block({
      blocker: currentUserId,
      blocked: userIdToBlock,
      reason: 'Blocked via privacy settings'
    });

    await block.save();

    // Get all blocks for response (for backward compatibility)
    const allBlocks = await Block.find({ blocker: currentUserId })
      .populate('blocked', 'username displayName profilePhoto')
      .lean();

    const blockedUsers = allBlocks.map(b => b.blocked);

    res.json({
      message: 'User blocked successfully',
      blockedUsers
    });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/privacy/unblock/:userId
// @desc    Unblock a user (MIGRATED TO BLOCK MODEL)
// @access  Private
router.post('/unblock/:userId', auth, async (req, res) => {
  try {
    const userIdToUnblock = req.params.userId;
    const currentUserId = req.userId;

    // Remove block from Block collection
    const block = await Block.findOneAndDelete({
      blocker: currentUserId,
      blocked: userIdToUnblock
    });

    if (!block) {
      return res.status(404).json({ message: 'User is not blocked' });
    }

    // Get remaining blocks for response (for backward compatibility)
    const allBlocks = await Block.find({ blocker: currentUserId })
      .populate('blocked', 'username displayName profilePhoto')
      .lean();

    const blockedUsers = allBlocks.map(b => b.blocked);

    res.json({
      message: 'User unblocked successfully',
      blockedUsers
    });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/privacy/blocked
// @desc    Get list of blocked users (MIGRATED TO BLOCK MODEL)
// @access  Private
router.get('/blocked', auth, async (req, res) => {
  try {
    // Get blocks from Block collection
    const blocks = await Block.find({ blocker: req.userId })
      .populate('blocked', 'username displayName profilePhoto')
      .lean();

    const blockedUsers = blocks.map(block => block.blocked);

    res.json({
      blockedUsers
    });
  } catch (error) {
    console.error('Get blocked users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

