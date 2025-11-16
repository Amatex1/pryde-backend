import express from 'express';
import User from '../models/User.js';
import { authMiddleware } from '../utils/authMiddleware.js';

const router = express.Router();

// Get all users (directory)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const users = await User.find({ banned: false })
      .select('display_name avatar_url bio')
      .sort({ display_name: 1 })
      .lean();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('display_name avatar_url bio created_at')
      .lean();
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { display_name, bio, avatar_url } = req.body;
    
    const updateData = {};
    if (display_name) updateData.display_name = display_name;
    if (bio !== undefined) updateData.bio = bio;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;

    const user = await User.findByIdAndUpdate(
      req.userId,
      updateData,
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
