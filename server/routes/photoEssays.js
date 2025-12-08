/**
 * PHASE 5: Photo Essay Routes
 * Rich visual storytelling through photo collections
 */

import express from 'express';
import mongoose from 'mongoose';
import PhotoEssay from '../models/PhotoEssay.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/photo-essays
// @desc    Create a new photo essay
// @access  Private
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, description, photos, visibility, tags } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ message: 'Title is required' });
    }

    if (!photos || photos.length === 0) {
      return res.status(400).json({ message: 'At least one photo is required' });
    }

    const photoEssay = new PhotoEssay({
      user: req.user.id,
      title,
      description: description || '',
      photos,
      visibility: visibility || 'public',
      tags: tags || []
    });

    await photoEssay.save();

    const populatedEssay = await PhotoEssay.findById(photoEssay._id)
      .populate('user', 'username displayName profilePhoto isVerified')
      .populate('tags', 'slug label icon');

    res.status(201).json(populatedEssay);
  } catch (error) {
    console.error('Create photo essay error:', error);
    res.status(500).json({ message: 'Failed to create photo essay' });
  }
});

// @route   GET /api/photo-essays/:id
// @desc    Get a single photo essay
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;

    const essay = await PhotoEssay.findById(id)
      .populate('user', 'username displayName profilePhoto isVerified')
      .populate('tags', 'slug label icon')
      .populate('comments.user', 'username displayName profilePhoto isVerified');

    if (!essay) {
      return res.status(404).json({ message: 'Photo essay not found' });
    }

    // Check visibility permissions
    if (essay.user._id.toString() !== currentUserId) {
      if (essay.visibility === 'private') {
        return res.status(403).json({ message: 'This photo essay is private' });
      }

      if (essay.visibility === 'followers') {
        const currentUser = await User.findById(currentUserId).select('following');
        const isFollowing = currentUser.following.some(id => id.toString() === essay.user._id.toString());
        
        if (!isFollowing) {
          return res.status(403).json({ message: 'You must follow this user to view this photo essay' });
        }
      }
    }

    // Sanitize likes
    const hasLiked = essay.likes.some(like => like.toString() === currentUserId);
    const sanitizedEssay = essay.toObject();
    sanitizedEssay.hasLiked = hasLiked;
    delete sanitizedEssay.likes;

    res.json(sanitizedEssay);
  } catch (error) {
    console.error('Get photo essay error:', error);
    res.status(500).json({ message: 'Failed to fetch photo essay' });
  }
});

// @route   GET /api/photo-essays/user/:userId
// @desc    Get a user's photo essays (respecting visibility)
// @access  Private
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    // Find user by ID or username
    let targetUser;
    if (mongoose.Types.ObjectId.isValid(userId) && userId.length === 24) {
      targetUser = await User.findById(userId).select('_id');
    } else {
      targetUser = await User.findOne({ username: userId }).select('_id');
    }

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetUserId = targetUser._id.toString();

    // Build query based on visibility
    let query = { user: targetUserId };

    if (targetUserId === currentUserId) {
      // User viewing their own essays - show all
      query = { user: targetUserId };
    } else {
      // Check if current user follows the essay owner
      const currentUser = await User.findById(currentUserId).select('following');
      const isFollowing = currentUser.following.some(id => id.toString() === targetUserId);

      if (isFollowing) {
        // Show public and followers-only essays
        query.visibility = { $in: ['public', 'followers'] };
      } else {
        // Show only public essays
        query.visibility = 'public';
      }
    }

    const essays = await PhotoEssay.find(query)
      .sort({ createdAt: -1 })
      .populate('user', 'username displayName profilePhoto isVerified')
      .populate('tags', 'slug label icon')
      .select('-comments'); // Don't include comments in list view

    // Sanitize likes for each essay
    const sanitizedEssays = essays.map(essay => {
      const obj = essay.toObject();
      const hasLiked = obj.likes?.some(like => like.toString() === currentUserId);
      obj.hasLiked = hasLiked;
      delete obj.likes;
      return obj;
    });

    res.json(sanitizedEssays);
  } catch (error) {
    console.error('Get user photo essays error:', error);
    res.status(500).json({ message: 'Failed to fetch photo essays' });
  }
});

export default router;

