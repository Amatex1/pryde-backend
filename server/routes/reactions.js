import express from 'express';
import mongoose from 'mongoose';
import Reaction, { APPROVED_REACTIONS } from '../models/Reaction.js';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import auth from '../middleware/auth.js';
import reactionLimiter from '../middleware/rateLimiter.js';
import logger from '../utils/logger.js';

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
router.post('/', auth, reactionLimiter, async (req, res) => {
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

        // Emit real-time event
        if (req.io) {
          req.io.emit('reaction_removed', {
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

        // Emit real-time event
        if (req.io) {
          req.io.emit('reaction_added', {
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

      // Emit real-time event
      if (req.io) {
        req.io.emit('reaction_added', {
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
router.delete('/', auth, async (req, res) => {
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

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Reaction not found' });
    }

    logger.debug('🗑️ Reaction deleted:', { targetType, targetId, userId });

    // Get updated aggregated reactions
    const reactions = await getAggregatedReactions(targetType, targetId);

    // Emit real-time event
    if (req.io) {
      req.io.emit('reaction_updated', {
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
 * @access  Public
 *
 * Returns: { emoji: count, ... } and userReaction (if authenticated)
 */
router.get('/:targetType/:targetId', async (req, res) => {
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

