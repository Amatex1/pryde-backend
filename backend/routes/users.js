import express from 'express';
import User from '../models/User.js';
import { authMiddleware } from '../utils/authMiddleware.js';

const router = express.Router();

/**
 * GET /
 * Get all users (for directory)
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const users = await User.find({ banned: false })
      .select('display_name avatar_url bio created_at')
      .sort({ created_at: -1 });

    res.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /:userId
 * Get user profile by ID
 */
router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('display_name avatar_url bio created_at');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * PUT /profile
 * Update current user's profile
 */
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { display_name, bio, avatar_url } = req.body;
    
    const updates = {};
    if (display_name !== undefined) updates.display_name = display_name;
    if (bio !== undefined) updates.bio = bio;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true }
    ).select('display_name avatar_url bio');

    res.json({ success: true, user });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
