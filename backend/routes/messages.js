import express from 'express';
import multer from 'multer';
import path from 'path';
import { authMiddleware } from '../utils/authMiddleware.js';
import Message from '../models/Message.js';
import User from '../models/User.js';

const router = express.Router();

// Configure multer for message image uploads
const messageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'backend/uploads/messages');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadMessageImage = multer({
  storage: messageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/**
 * POST /api/messages/upload-image
 * Upload a message image
 */
router.post('/upload-image', authMiddleware, uploadMessageImage.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const imageUrl = `/uploads/messages/${req.file.filename}`;
    res.json({ success: true, imageUrl });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

/**
 * GET /api/messages/conversation/:withUserId
 * Get conversation with a specific user (with optional pagination)
 */
router.get('/conversation/:withUserId', authMiddleware, async (req, res) => {
  try {
    const { withUserId } = req.params;
    const currentUserId = req.user._id;
    
    // Verify other user exists
    const otherUser = await User.findById(withUserId);
    if (!otherUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get messages between the two users
    const messages = await Message.find({
      $or: [
        { from: currentUserId, to: withUserId },
        { from: withUserId, to: currentUserId }
      ]
    })
    .sort({ created_at: 1 })
    .populate('from', 'display_name avatar_url')
    .populate('to', 'display_name avatar_url')
    .limit(100); // Last 100 messages

    res.json({ messages });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/messages/list
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
        $sort: { 'lastMessage.created_at': -1 }
      }
    ]);

    // Populate user details
    const conversationList = await Promise.all(
      conversations.map(async (conv) => {
        const otherUser = await User.findById(conv._id, 'display_name avatar_url');
        return {
          userId: conv._id,
          user: otherUser,
          lastMessage: conv.lastMessage
        };
      })
    );

    res.json({ conversations: conversationList });
  } catch (error) {
    console.error('Get conversations list error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/messages/delete-conversation/:withUserId
 * Delete conversation with a specific user
 */
router.post('/delete-conversation/:withUserId', authMiddleware, async (req, res) => {
  try {
    const { withUserId } = req.params;
    const currentUserId = req.user._id;

    // Delete all messages between the two users
    await Message.deleteMany({
      $or: [
        { from: currentUserId, to: withUserId },
        { from: withUserId, to: currentUserId }
      ]
    });

    res.json({ success: true, message: 'Conversation deleted' });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
