import express from "express";
import Message from "../models/Message.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// Get conversation messages (paginated)
router.get('/conversation/:userId', auth, async (req, res) => {
  try {
    const otherUserId = req.params.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    const messages = await Message.find({
      $or: [
        { from: req.userId, to: otherUserId },
        { from: otherUserId, to: req.userId }
      ]
    })
      .populate('from', 'display_name avatar_url')
      .populate('to', 'display_name avatar_url')
      .sort({ created_at: 1 })
      .skip(skip)
      .limit(limit);
    
    res.json(messages);
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get conversation list (recent chats)
router.get('/list', auth, async (req, res) => {
  try {
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
    
    res.json(conversations);
  } catch (error) {
    console.error('Get conversation list error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete conversation
router.delete('/conversation/:userId', auth, async (req, res) => {
  try {
    const otherUserId = req.params.userId;
    
    await Message.deleteMany({
      $or: [
        { from: req.userId, to: otherUserId },
        { from: otherUserId, to: req.userId }
      ]
    });
    
    res.json({ success: true, message: 'Conversation deleted' });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
