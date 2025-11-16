import express from 'express';
import { authMiddleware } from '../utils/authMiddleware.js';
import User from '../models/User.js';

const router = express.Router();

/**
 * GET /api/users/me
 * Get current user profile
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    res.json({
      id: req.user._id,
      email: req.user.email,
      display_name: req.user.display_name,
      avatar_url: req.user.avatar_url,
      bio: req.user.bio,
      created_at: req.user.created_at
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /api/users/me
 * Update current user profile
 */
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const { display_name, bio, avatar_url } = req.body;
    
    const updates = {};
    if (display_name) updates.display_name = display_name;
    if (bio !== undefined) updates.bio = bio;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true }
    );

    res.json({
      id: user._id,
      email: user.email,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      bio: user.bio
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/users/directory
 * Get list of all users (for directory/user list)
 */
router.get('/directory', authMiddleware, async (req, res) => {
  try {
    const users = await User.find(
      { banned: false },
      'display_name avatar_url bio created_at'
    ).sort({ created_at: -1 });

    res.json({ users });
  } catch (error) {
    console.error('Get directory error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/users/:userId
 * Get specific user profile
 */
router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(
      req.params.userId,
      'display_name avatar_url bio created_at'
    );

    if (!user || user.banned) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user._id,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      bio: user.bio,
      created_at: user.created_at
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
