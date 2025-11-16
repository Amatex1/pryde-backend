import express from 'express';
import Message from '../models/Message.js';
import { authMiddleware } from '../utils/authMiddleware.js';

const router = express.Router();

/**
 * GET /api/messages/conversation/:userId
 * Get conversation between current user and another user
 * Supports pagination
 */
router.get('/conversation/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Get messages between two users (in both directions)
    const messages = await Message.find({
      $or: [
        { from: req.userId, to: userId },
        { from: userId, to: req.userId }
      ]
    })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('from', 'display_name avatar_url')
      .populate('to', 'display_name avatar_url')
      .lean();

    // Reverse to get chronological order
    messages.reverse();

    res.json({
      success: true,
      messages,
      page,
      hasMore: messages.length === limit
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/messages/list
 * Get list of conversations (latest message with each user)
 */
router.get('/list', authMiddleware, async (req, res) => {
  try {
    // Aggregate to get last message with each user
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { from: req.userId },
            { to: req.userId }
          ]
        }
      },
      {
        $sort: { created_at: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$from', req.userId] },
              '$to',
              '$from'
            ]
          },
          lastMessage: { $first: '$$ROOT' }
        }
      },
      {
        $replaceRoot: { newRoot: '$lastMessage' }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'from',
          foreignField: '_id',
          as: 'fromUser'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'to',
          foreignField: '_id',
          as: 'toUser'
        }
      },
      {
        $unwind: '$fromUser'
      },
      {
        $unwind: '$toUser'
      },
      {
        $sort: { created_at: -1 }
      }
    ]);

    res.json({
      success: true,
      conversations
    });
  } catch (error) {
    console.error('Get conversations list error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * DELETE /api/messages/delete-conversation/:userId
 * Delete entire conversation with a user
 */
router.delete('/delete-conversation/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    // Delete all messages between two users
    const result = await Message.deleteMany({
      $or: [
        { from: req.userId, to: userId },
        { from: userId, to: req.userId }
      ]
    });

    res.json({
      success: true,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
