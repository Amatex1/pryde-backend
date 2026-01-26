/**
 * PHASE 3: Journal Routes
 * Personal journaling for reflection and creative expression
 */

import express from 'express';
import mongoose from 'mongoose';
import Journal from '../models/Journal.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import { sanitizeFields } from '../middleware/sanitize.js';

const router = express.Router();

// @route   POST /api/journals
// @desc    Create a new journal entry
// @access  Private
router.post('/', authenticateToken, sanitizeFields(['title', 'body']), async (req, res) => {
  try {
    const { title, body, visibility, mood, tags } = req.body;

    if (!body || body.trim().length === 0) {
      return res.status(400).json({ message: 'Journal body is required' });
    }

    const journal = new Journal({
      user: req.user.id,
      title: title || null,
      body,
      visibility: visibility || 'private',
      mood: mood || null,
      tags: tags || []
    });

    await journal.save();

    const populatedJournal = await Journal.findById(journal._id)
      .populate('user', 'username displayName profilePhoto isVerified');

    res.status(201).json(populatedJournal);
  } catch (error) {
    console.error('Create journal error:', error);
    console.error('Create journal error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({
      message: 'Failed to create journal entry',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/journals/me
// @desc    Get current user's journal entries
// @access  Private
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const journals = await Journal.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .populate('user', 'username displayName profilePhoto isVerified');

    res.json(journals);
  } catch (error) {
    console.error('Get my journals error:', error);
    res.status(500).json({ message: 'Failed to fetch journal entries' });
  }
});

// @route   GET /api/journals/user/:userId
// @desc    Get a user's journal entries (respecting visibility)
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
      // User viewing their own journals - show all
      query = { user: targetUserId };
    } else {
      // Check if current user follows the journal owner
      const currentUser = await User.findById(currentUserId).select('following');
      const isFollowing = currentUser.following.some(id => id.toString() === targetUserId);

      if (isFollowing) {
        // Show public and followers-only journals
        query.visibility = { $in: ['public', 'followers'] };
      } else {
        // Show only public journals
        query.visibility = 'public';
      }
    }

    const journals = await Journal.find(query)
      .sort({ createdAt: -1 })
      .populate('user', 'username displayName profilePhoto isVerified');

    res.json(journals);
  } catch (error) {
    console.error('Get user journals error:', error);
    res.status(500).json({ message: 'Failed to fetch journal entries' });
  }
});

// @route   PATCH /api/journals/:id
// @desc    Update a journal entry
// @access  Private
router.patch('/:id', authenticateToken, sanitizeFields(['title', 'body']), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, body, visibility, mood, tags } = req.body;

    const journal = await Journal.findById(id);

    if (!journal) {
      return res.status(404).json({ message: 'Journal entry not found' });
    }

    // Check ownership
    if (journal.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to edit this journal entry' });
    }

    // Update fields
    if (title !== undefined) journal.title = title;
    if (body !== undefined) journal.body = body;
    if (visibility !== undefined) journal.visibility = visibility;
    if (mood !== undefined) journal.mood = mood;
    if (tags !== undefined) journal.tags = tags;

    await journal.save();

    const updatedJournal = await Journal.findById(id)
      .populate('user', 'username displayName profilePhoto isVerified');

    res.json(updatedJournal);
  } catch (error) {
    console.error('Update journal error:', error);
    res.status(500).json({ message: 'Failed to update journal entry' });
  }
});

// @route   DELETE /api/journals/:id
// @desc    Delete a journal entry
// @access  Private
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const journal = await Journal.findById(id);

    if (!journal) {
      return res.status(404).json({ message: 'Journal entry not found' });
    }

    // Check ownership
    if (journal.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this journal entry' });
    }

    await Journal.findByIdAndDelete(id);

    res.json({ message: 'Journal entry deleted successfully' });
  } catch (error) {
    console.error('Delete journal error:', error);
    res.status(500).json({ message: 'Failed to delete journal entry' });
  }
});

export default router;

