import express from 'express';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { authMiddleware } from '../utils/authMiddleware.js';

const router = express.Router();

// Get conversation with a specific user (paginated)
router.get('/conversation/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    // Get messages between two users
    const messages = await Message.find({
      $or: [
        { from: req.userId, to: userId },
        { from: userId, to: req.userId }
      ]
    })
      .populate('from', 'display_name avatar_url')
      .populate('to', 'display_name avatar_url')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Reverse to get chronological order
    messages.reverse();

    res.json({
      messages,
      page: parseInt(page),
      hasMore: messages.length === parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Get list of conversations (aggregated)
router.get('/list', authMiddleware, async (req, res) => {
  try {
    // Aggregate to get the last message for each unique conversation
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
        $sort: { 'lastMessage.created_at': -1 }
      }
    ]);

    // Populate user details
    const populatedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const otherUser = await User.findById(conv._id)
          .select('display_name avatar_url')
          .lean();
        
        return {
          user: otherUser,
          lastMessage: {
            content: conv.lastMessage.content,
            image_url: conv.lastMessage.image_url,
            created_at: conv.lastMessage.created_at,
            isRead: conv.lastMessage.read_by?.includes(req.userId)
          }
        };
      })
    );

    res.json(populatedConversations.filter(c => c.user !== null));
  } catch (error) {
    console.error('Error fetching conversation list:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Delete conversation
router.delete('/conversation/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    await Message.deleteMany({
      $or: [
        { from: req.userId, to: userId },
        { from: userId, to: req.userId }
      ]
    });

    res.json({ message: 'Conversation deleted' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

export default router;
