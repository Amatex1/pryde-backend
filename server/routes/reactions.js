import express from 'express';
import mongoose from 'mongoose';
import Reaction, { APPROVED_REACTIONS } from '../models/Reaction.js';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import auth, { optionalAuth } from '../middleware/auth.js';
import requireActiveUser from '../middleware/requireActiveUser.js';
import { reactionLimiter } from '../middleware/rateLimiter.js';
import logger from '../utils/logger.js';
import { emitValidated } from '../utils/emitValidated.js';

const router = express.Router();

/**
 * @route   POST /api/reactions
 * @desc    Add or update a reaction (upsert)
 * @access  Private
 * 
 * Body: { targetType: 'post' | 'comment', targetId: string, emoji: string }
 * 
 * Behavior:
 * - If user has no reaction: Add new reaction
 * - If user clicks same emoji: Remove reaction (toggle off)
 * - If user clicks different emoji: Update to new emoji
 */
router.post('/', auth, requireActiveUser, reactionLimiter, async (req, res) => {
  try {
    const { targetType, targetId, emoji } = req.body;
    const userId = req.userId || req.user._id;

    // Validation
    if (!targetType || !targetId || !emoji) {
      return res.status(400).json({ message: 'targetType, targetId, and emoji are required' });
    }

    if (!['post', 'comment'].includes(targetType)) {
      return res.status(400).json({ message: 'targetType must be "post" or "comment"' });
    }

    // Validate emoji against approved list
    if (!APPROVED_REACTIONS.includes(emoji)) {
      return res.status(400).json({ message: 'Invalid emoji. Only approved reactions are allowed.' });
    }

    // Verify target exists
    let target;
    if (targetType === 'post') {
      target = await Post.findById(targetId);
      if (!target) {
        return res.status(404).json({ message: 'Post not found' });
      }
    } else if (targetType === 'comment') {
      target = await Comment.findById(targetId);
      if (!target) {
        return res.status(404).json({ message: 'Comment not found' });
      }
    }

    // Find existing reaction from this user on this target
    const existingReaction = await Reaction.findOne({
      targetType,
      targetId,
      userId
    });

    if (existingReaction) {
      if (existingReaction.emoji === emoji) {
        // Same emoji clicked - remove reaction (toggle off)
        await Reaction.deleteOne({ _id: existingReaction._id });
        
        logger.debug('🗑️ Reaction removed:', { targetType, targetId, userId, emoji });

        // Get updated aggregated reactions
        const reactions = await getAggregatedReactions(targetType, targetId);

        // Emit real-time event (broadcast to all connected users viewing feed)
        if (req.io) {
          emitValidated(req.io, 'reaction_removed', {
            targetType,
            targetId,
            reactions,
            userId
          });
        }

        return res.json({
          action: 'removed',
          reactions
        });
      } else {
        // Different emoji - update reaction
        existingReaction.emoji = emoji;
        existingReaction.createdAt = new Date();
        await existingReaction.save();

        logger.debug('✏️ Reaction updated:', { targetType, targetId, userId, oldEmoji: existingReaction.emoji, newEmoji: emoji });

        // Get updated aggregated reactions
        const reactions = await getAggregatedReactions(targetType, targetId);

        // Emit real-time event (broadcast to all connected users viewing feed)
        if (req.io) {
          emitValidated(req.io, 'reaction_updated', {
            targetType,
            targetId,
            reactions,
            userId,
            emoji
          });
        }

        return res.json({
          action: 'updated',
          emoji,
          reactions
        });
      }
    } else {
      // No existing reaction - create new one
      const newReaction = new Reaction({
        targetType,
        targetId,
        userId,
        emoji
      });

      await newReaction.save();

      logger.debug('✅ Reaction added:', { targetType, targetId, userId, emoji });

      // Get updated aggregated reactions
      const reactions = await getAggregatedReactions(targetType, targetId);

      // Emit real-time event (broadcast to all connected users viewing feed)
      if (req.io) {
        emitValidated(req.io, 'reaction_added', {
          targetType,
          targetId,
          reactions,
          userId,
          emoji
        });
      }

      return res.json({
        action: 'added',
        emoji,
        reactions
      });
    }
  } catch (error) {
    logger.error('Reaction error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   DELETE /api/reactions
 * @desc    Remove a reaction
 * @access  Private
 *
 * Body: { targetType: 'post' | 'comment', targetId: string }
 */
router.delete('/', auth, requireActiveUser, async (req, res) => {
  try {
    const { targetType, targetId } = req.body;
    const userId = req.userId || req.user._id;

    // Validation
    if (!targetType || !targetId) {
      return res.status(400).json({ message: 'targetType and targetId are required' });
    }

    // Delete reaction
    const result = await Reaction.deleteOne({
      targetType,
      targetId,
      userId
    });

    // Idempotent: if reaction doesn't exist, still return success (no-op)
    if (result.deletedCount === 0) {
      logger.debug('noop.reaction.not_found', {
        userId: userId,
        targetType: targetType,
        targetId: targetId,
        endpoint: 'DELETE /reactions'
      });
    } else {
      logger.debug('reaction.deleted', { targetType, targetId, userId });
    }

    // Get updated aggregated reactions
    const reactions = await getAggregatedReactions(targetType, targetId);

    // Emit real-time event (broadcast to all connected users viewing feed)
    if (req.io) {
      emitValidated(req.io, 'reaction_updated', {
        targetType,
        targetId,
        reactions
      });
    }

    res.json({
      action: 'removed',
      reactions
    });
  } catch (error) {
    logger.error('Delete reaction error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/reactions/:targetType/:targetId
 * @desc    Get aggregated reactions for a target
 * @access  Public (with optional auth to get user's reaction)
 *
 * Returns: { emoji: count, ... } and userReaction (if authenticated)
 */
router.get('/:targetType/:targetId', optionalAuth, async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    const userId = req.userId || req.user?._id;

    // Validation
    if (!['post', 'comment'].includes(targetType)) {
      return res.status(400).json({ message: 'targetType must be "post" or "comment"' });
    }

    // Get aggregated reactions
    const reactions = await getAggregatedReactions(targetType, targetId);

    // Get user's reaction if authenticated
    let userReaction = null;
    if (userId) {
      const reaction = await Reaction.findOne({
        targetType,
        targetId,
        userId
      });
      userReaction = reaction ? reaction.emoji : null;
    }

    res.json({
      reactions,
      userReaction
    });
  } catch (error) {
    logger.error('Get reactions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/reactions/:targetType/:targetId/details
 * @desc    Get detailed reactions with user information for a target
 * @access  Public
 *
 * Returns: Array of reaction objects with populated user data
 * [{ emoji: '❤️', user: { _id, username, displayName, profilePhoto }, createdAt }, ...]
 */
router.get('/:targetType/:targetId/details', async (req, res) => {
  try {
    const { targetType, targetId } = req.params;

    // Validation
    if (!['post', 'comment'].includes(targetType)) {
      return res.status(400).json({ message: 'targetType must be "post" or "comment"' });
    }

    // Get reactions with populated user data
    const reactions = await Reaction.find({
      targetType,
      targetId
    })
      .populate('userId', 'username displayName profilePhoto')
      .sort({ createdAt: -1 }); // Most recent first

    // Transform to match expected format
    const detailedReactions = reactions.map(r => ({
      emoji: r.emoji,
      user: r.userId, // Already populated
      createdAt: r.createdAt
    }));

    res.json(detailedReactions);
  } catch (error) {
    logger.error('Get detailed reactions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Helper function to get aggregated reactions
 * Returns: { emoji: count, ... }
 */
async function getAggregatedReactions(targetType, targetId) {
  const reactions = await Reaction.aggregate([
    {
      $match: {
        targetType,
        targetId: new mongoose.Types.ObjectId(targetId)
      }
    },
    {
      $group: {
        _id: '$emoji',
        count: { $sum: 1 }
      }
    }
  ]);

  // Convert to { emoji: count } format
  const result = {};
  reactions.forEach(r => {
    result[r._id] = r.count;
  });

  return result;
}

export default router;

