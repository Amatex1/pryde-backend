/**
 * PHASE 3: Longform Routes
 * Longform creative posts for stories, essays, and articles
 */

import express from 'express';
import mongoose from 'mongoose';
import Longform from '../models/Longform.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/longform
// @desc    Create a new longform post
// @access  Private
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, body, coverImage, visibility, tags } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ message: 'Title is required' });
    }

    if (!body || body.trim().length === 0) {
      return res.status(400).json({ message: 'Body is required' });
    }

    const longform = new Longform({
      user: req.user.id,
      title,
      body,
      coverImage: coverImage || null,
      visibility: visibility || 'followers',
      tags: tags || []
    });

    await longform.save();

    const populatedLongform = await Longform.findById(longform._id)
      .populate('user', 'username displayName profilePhoto isVerified');

    res.status(201).json(populatedLongform);
  } catch (error) {
    console.error('Create longform error:', error);
    res.status(500).json({ message: 'Failed to create longform post' });
  }
});

// @route   GET /api/longform/:id
// @desc    Get a single longform post
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.id;

    const longform = await Longform.findById(id)
      .populate('user', 'username displayName profilePhoto isVerified')
      .populate('comments.user', 'username displayName profilePhoto isVerified');

    if (!longform) {
      return res.status(404).json({ message: 'Longform post not found' });
    }

    // Check visibility permissions
    if (longform.user._id.toString() !== currentUserId) {
      if (longform.visibility === 'private') {
        return res.status(403).json({ message: 'This post is private' });
      }

      if (longform.visibility === 'followers') {
        const currentUser = await User.findById(currentUserId).select('following');
        const isFollowing = currentUser.following.some(id => id.toString() === longform.user._id.toString());
        
        if (!isFollowing) {
          return res.status(403).json({ message: 'You must follow this user to view this post' });
        }
      }
    }

    // Sanitize likes (hide counts, show only hasLiked)
    const hasLiked = longform.likes.some(like => like.toString() === currentUserId);
    const sanitizedLongform = longform.toObject();
    sanitizedLongform.hasLiked = hasLiked;
    delete sanitizedLongform.likes;

    res.json(sanitizedLongform);
  } catch (error) {
    console.error('Get longform error:', error);
    res.status(500).json({ message: 'Failed to fetch longform post' });
  }
});

// @route   GET /api/longform/user/:userId
// @desc    Get a user's longform posts (respecting visibility)
// @access  Private
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    // Find user by ID or username
    let targetUser = null;

    // Check if it's a valid ObjectId (24 hex characters)
    if (mongoose.Types.ObjectId.isValid(userId) && userId.length === 24) {
      try {
        targetUser = await User.findById(userId).select('_id');
      } catch (err) {
        // If findById fails, try username
        console.log('FindById failed, trying username lookup:', err.message);
      }
    }

    // If not found by ID or not a valid ID, try username
    if (!targetUser) {
      try {
        targetUser = await User.findOne({ username: userId }).select('_id');
      } catch (err) {
        console.error('Username lookup failed:', err.message);
      }
    }

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetUserId = targetUser._id.toString();

    // Build query based on visibility
    let query = { user: targetUserId };

    if (targetUserId === currentUserId) {
      // User viewing their own longform posts - show all
      query = { user: targetUserId };
    } else {
      // Check if current user follows the post owner
      const currentUser = await User.findById(currentUserId).select('following');
      const isFollowing = currentUser.following.some(id => id.toString() === targetUserId);

      if (isFollowing) {
        // Show public and followers-only posts
        query.visibility = { $in: ['public', 'followers'] };
      } else {
        // Show only public posts
        query.visibility = 'public';
      }
    }

    const longforms = await Longform.find(query)
      .sort({ createdAt: -1 })
      .populate('user', 'username displayName profilePhoto isVerified')
      .select('-comments'); // Don't include comments in list view

    // Sanitize likes for each post
    const sanitizedLongforms = longforms.map(longform => {
      const obj = longform.toObject();
      const hasLiked = obj.likes?.some(like => like.toString() === currentUserId);
      obj.hasLiked = hasLiked;
      delete obj.likes;
      return obj;
    });

    res.json(sanitizedLongforms);
  } catch (error) {
    console.error('Get user longforms error:', error);
    res.status(500).json({ message: 'Failed to fetch longform posts' });
  }
});

// @route   PATCH /api/longform/:id
// @desc    Update a longform post
// @access  Private
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, body, coverImage, visibility, tags } = req.body;

    const longform = await Longform.findById(id);

    if (!longform) {
      return res.status(404).json({ message: 'Longform post not found' });
    }

    // Check ownership
    if (longform.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to edit this post' });
    }

    // Update fields
    if (title !== undefined) longform.title = title;
    if (body !== undefined) longform.body = body;
    if (coverImage !== undefined) longform.coverImage = coverImage;
    if (visibility !== undefined) longform.visibility = visibility;
    if (tags !== undefined) longform.tags = tags;

    await longform.save();

    const updatedLongform = await Longform.findById(id)
      .populate('user', 'username displayName profilePhoto isVerified');

    res.json(updatedLongform);
  } catch (error) {
    console.error('Update longform error:', error);
    res.status(500).json({ message: 'Failed to update longform post' });
  }
});

// @route   DELETE /api/longform/:id
// @desc    Delete a longform post
// @access  Private
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const longform = await Longform.findById(id);

    if (!longform) {
      return res.status(404).json({ message: 'Longform post not found' });
    }

    // Check ownership
    if (longform.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    await Longform.findByIdAndDelete(id);

    res.json({ message: 'Longform post deleted successfully' });
  } catch (error) {
    console.error('Delete longform error:', error);
    res.status(500).json({ message: 'Failed to delete longform post' });
  }
});

// @route   POST /api/longform/:id/like
// @desc    Like/unlike a longform post
// @access  Private
router.post('/:id/like', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const longform = await Longform.findById(id);

    if (!longform) {
      return res.status(404).json({ message: 'Longform post not found' });
    }

    const likeIndex = longform.likes.indexOf(userId);

    if (likeIndex > -1) {
      // Unlike
      longform.likes.splice(likeIndex, 1);
    } else {
      // Like
      longform.likes.push(userId);
    }

    await longform.save();

    res.json({ message: 'Success', hasLiked: likeIndex === -1 });
  } catch (error) {
    console.error('Like longform error:', error);
    res.status(500).json({ message: 'Failed to like post' });
  }
});

// @route   POST /api/longform/:id/comment
// @desc    Add a comment to a longform post
// @access  Private
router.post('/:id/comment', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const longform = await Longform.findById(id);

    if (!longform) {
      return res.status(404).json({ message: 'Longform post not found' });
    }

    longform.comments.push({
      user: req.user.id,
      text,
      createdAt: new Date()
    });

    await longform.save();

    const updatedLongform = await Longform.findById(id)
      .populate('comments.user', 'username displayName profilePhoto isVerified');

    res.json(updatedLongform.comments);
  } catch (error) {
    console.error('Comment on longform error:', error);
    res.status(500).json({ message: 'Failed to add comment' });
  }
});

export default router;

