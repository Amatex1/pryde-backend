import express from 'express';
const router = express.Router();
import Message from '../models/Message.js';
import mongoose from 'mongoose';
import authMiddleware from '../middleware/auth.js';

// Get conversation with a user
router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId;

    console.log('📥 Fetching messages between:', {
      currentUserId,
      otherUserId: userId
    });

    const messages = await Message.find({
      $or: [
        {
          sender: new mongoose.Types.ObjectId(currentUserId),
          recipient: new mongoose.Types.ObjectId(userId)
        },
        {
          sender: new mongoose.Types.ObjectId(userId),
          recipient: new mongoose.Types.ObjectId(currentUserId)
        }
      ]
    })
      .populate('sender', 'username profilePhoto')
      .populate('recipient', 'username profilePhoto')
      .sort({ createdAt: 1 });

    console.log('✅ Found messages:', messages.length);

    res.json(messages);
  } catch (error) {
    console.error('❌ Error fetching messages:', error);
    res.status(500).json({ message: 'Error fetching messages', error: error.message });
  }
});

// Get all conversations
router.get('/', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.userId;

    // Get unique conversation partners
    const messages = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: new mongoose.Types.ObjectId(currentUserId) },
            { recipient: new mongoose.Types.ObjectId(currentUserId) }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', new mongoose.Types.ObjectId(currentUserId)] },
              '$recipient',
              '$sender'
            ]
          },
          lastMessage: { $first: '$$ROOT' }
        }
      }
    ]);

    // Populate user details
    await Message.populate(messages, {
      path: 'lastMessage.sender lastMessage.recipient',
      select: 'username profilePhoto displayName'
    });

    // Also populate the _id field which contains the other user's ID
    const User = require('../models/User');
    const populatedConversations = await Promise.all(
      messages.map(async (conv) => {
        const otherUser = await User.findById(conv._id).select('username profilePhoto displayName');
        return {
          ...conv,
          otherUser
        };
      })
    );

    res.json(populatedConversations);
  } catch (error) {
    console.error('❌ Error fetching conversations:', error);
    res.status(500).json({ message: 'Error fetching conversations', error: error.message });
  }
});

// Send a message
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { recipient, content, attachment, groupChatId } = req.body;

    const message = new Message({
      sender: req.userId,
      recipient: groupChatId ? undefined : recipient,
      groupChat: groupChatId || null,
      content,
      attachment: attachment || null
    });

    await message.save();
    await message.populate('sender', 'username profilePhoto');
    if (!groupChatId) {
      await message.populate('recipient', 'username profilePhoto');
    }

    // Update group chat's last message if it's a group message
    if (groupChatId) {
      const GroupChat = require('../models/GroupChat');
      await GroupChat.findByIdAndUpdate(groupChatId, {
        lastMessage: message._id,
        updatedAt: Date.now()
      });
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('❌ Error sending message:', error);
    res.status(500).json({ message: 'Error sending message', error: error.message });
  }
});

// Mark message as read (with read receipts)
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // For direct messages
    if (message.recipient && message.recipient.toString() === req.userId) {
      message.read = true;
      await message.save();
    }

    // For group messages - add to readBy array
    if (message.groupChat) {
      const alreadyRead = message.readBy.some(r => r.user.toString() === req.userId);
      if (!alreadyRead) {
        message.readBy.push({
          user: req.userId,
          readAt: new Date()
        });
        await message.save();
      }
    }

    res.json(message);
  } catch (error) {
    console.error('❌ Error updating message:', error);
    res.status(500).json({ message: 'Error updating message', error: error.message });
  }
});

// Mark message as delivered
router.put('/:id/delivered', authMiddleware, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // For group messages - add to deliveredTo array
    if (message.groupChat) {
      const alreadyDelivered = message.deliveredTo.some(d => d.user.toString() === req.userId);
      if (!alreadyDelivered) {
        message.deliveredTo.push({
          user: req.userId,
          deliveredAt: new Date()
        });
        await message.save();
      }
    }

    res.json(message);
  } catch (error) {
    console.error('❌ Error updating message:', error);
    res.status(500).json({ message: 'Error updating message', error: error.message });
  }
});

// Get group chat messages
router.get('/group/:groupId', authMiddleware, async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const messages = await Message.find({ groupChat: groupId })
      .populate('sender', 'username profilePhoto')
      .populate('readBy.user', 'username')
      .populate('deliveredTo.user', 'username')
      .sort({ createdAt: 1 });
    
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching group messages', error: error.message });
  }
});

export default router;
