import express from 'express';
const router = express.Router();
import User from '../models/User.js';
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

    // Update privacy settings
    user.privacySettings = {
      ...user.privacySettings,
      ...privacySettings
    };

    await user.save();

    res.json({
      message: 'Privacy settings updated successfully',
      privacySettings: user.privacySettings
    });
  } catch (error) {
    console.error('Update privacy settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/privacy/block/:userId
// @desc    Block a user
// @access  Private
router.post('/block/:userId', auth, async (req, res) => {
  try {
    const userIdToBlock = req.params.userId;
    const currentUserId = req.userId;

    if (userIdToBlock === currentUserId) {
      return res.status(400).json({ message: 'You cannot block yourself' });
    }

    const user = await User.findById(currentUserId);
    const userToBlock = await User.findById(userIdToBlock);

    if (!userToBlock) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already blocked
    if (user.blockedUsers.includes(userIdToBlock)) {
      return res.status(400).json({ message: 'User is already blocked' });
    }

    // Add to blocked users
    user.blockedUsers.push(userIdToBlock);

    // Remove from friends if they are friends
    user.friends = user.friends.filter(friendId => friendId.toString() !== userIdToBlock);
    userToBlock.friends = userToBlock.friends.filter(friendId => friendId.toString() !== currentUserId);

    await user.save();
    await userToBlock.save();

    res.json({
      message: 'User blocked successfully',
      blockedUsers: user.blockedUsers
    });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/privacy/unblock/:userId
// @desc    Unblock a user
// @access  Private
router.post('/unblock/:userId', auth, async (req, res) => {
  try {
    const userIdToUnblock = req.params.userId;
    const currentUserId = req.userId;

    const user = await User.findById(currentUserId);

    if (!user.blockedUsers.includes(userIdToUnblock)) {
      return res.status(400).json({ message: 'User is not blocked' });
    }

    // Remove from blocked users
    user.blockedUsers = user.blockedUsers.filter(
      blockedId => blockedId.toString() !== userIdToUnblock
    );

    await user.save();

    res.json({
      message: 'User unblocked successfully',
      blockedUsers: user.blockedUsers
    });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/privacy/blocked
// @desc    Get list of blocked users
// @access  Private
router.get('/blocked', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate('blockedUsers', 'username displayName profilePhoto');

    res.json({
      blockedUsers: user.blockedUsers
    });
  } catch (error) {
    console.error('Get blocked users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

