import express from 'express';
import Message from '../models/Message.js';
import { authMiddleware } from '../utils/authMiddleware.js';

const router = express.Router();

/**
 * GET /conversation/:withUserId
 * Get messages between current user and another user
 * Supports pagination via query params: page, limit
 */
router.get('/conversation/:withUserId', authMiddleware, async (req, res) => {
  try {
    const { withUserId } = req.params;
    const currentUserId = req.user._id;
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Find messages between the two users
    const messages = await Message.find({
      $or: [
        { from: currentUserId, to: withUserId },
        { from: withUserId, to: currentUserId }
      ]
    })
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limit)
    .populate('from', 'display_name avatar_url')
    .populate('to', 'display_name avatar_url');

    res.json({ messages: messages.reverse(), page, limit });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

/**
 * GET /list
 * Get list of conversations (last message with each user)
 */
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // Aggregate to get last message per conversation
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { from: currentUserId },
            { to: currentUserId }
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
              { $eq: ['$from', currentUserId] },
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

    res.json({ conversations });
  } catch (error) {
    console.error('Error fetching conversation list:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * POST /delete-conversation/:withUserId
 * Delete all messages in a conversation with another user
 */
router.post('/delete-conversation/:withUserId', authMiddleware, async (req, res) => {
  try {
    const { withUserId } = req.params;
    const currentUserId = req.user._id;

    const result = await Message.deleteMany({
      $or: [
        { from: currentUserId, to: withUserId },
        { from: withUserId, to: currentUserId }
      ]
    });

    res.json({ 
      success: true, 
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

export default router;
