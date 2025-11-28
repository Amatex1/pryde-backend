import express from 'express';
const router = express.Router();
import Message from '../models/Message.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import authMiddleware from '../middleware/auth.js';
import { messageLimiter } from '../middleware/rateLimiter.js';
import { checkMessagingPermission, checkBlocked } from '../middleware/privacy.js';
import { checkMuted, moderateContent } from '../middleware/moderation.js';
import { sanitizeFields } from '../utils/sanitize.js';

// Get conversation with a user
router.get('/:userId', authMiddleware, checkBlocked, async (req, res) => {
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

// Get unread message counts per user
router.get('/unread/counts', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.userId;

    console.log('📊 Fetching unread counts for user:', currentUserId);

    // Get unread messages grouped by sender
    const unreadCounts = await Message.aggregate([
      {
        $match: {
          recipient: new mongoose.Types.ObjectId(currentUserId),
          read: false
        }
      },
      {
        $group: {
          _id: '$sender',
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('📊 Unread counts aggregation result:', unreadCounts);

    // Store original sender IDs before population
    const senderIdsBeforePopulation = unreadCounts.map(item => ({
      originalId: item._id,
      count: item.count
    }));

    // Populate sender details
    await Message.populate(unreadCounts, {
      path: '_id',
      select: 'username profilePhoto displayName'
    });

    console.log('📊 After population:', unreadCounts);

    // Filter out messages from deleted users (where _id is null after population)
    const validUnreadCounts = unreadCounts.filter(item => item._id !== null);

    // Get IDs of deleted users to clean up their messages
    const deletedUserIds = [];
    unreadCounts.forEach((item, index) => {
      if (item._id === null) {
        deletedUserIds.push(senderIdsBeforePopulation[index].originalId);
      }
    });

    // Delete messages from deleted users (cleanup)
    if (deletedUserIds.length > 0) {
      console.log('🗑️ Cleaning up', deletedUserIds.length, 'messages from deleted users...');
      const deleteResult = await Message.deleteMany({
        recipient: new mongoose.Types.ObjectId(currentUserId),
        sender: { $in: deletedUserIds }
      });
      console.log('🗑️ Deleted', deleteResult.deletedCount, 'orphaned messages');
    }

    console.log('📊 Valid unread counts (after filtering deleted users):', validUnreadCounts);

    // Calculate total unread count
    const totalUnread = validUnreadCounts.reduce((sum, item) => sum + item.count, 0);

    const response = {
      totalUnread,
      unreadByUser: validUnreadCounts.map(item => ({
        userId: item._id?._id || item._id,
        username: item._id?.username,
        displayName: item._id?.displayName,
        profilePhoto: item._id?.profilePhoto,
        count: item.count
      }))
    };

    console.log('✅ Sending unread counts response:', response);
    res.json(response);
  } catch (error) {
    console.error('❌ Error fetching unread counts:', error);
    res.status(500).json({ message: 'Error fetching unread counts', error: error.message });
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
router.post('/', authMiddleware, messageLimiter, sanitizeFields(['content']), checkMessagingPermission, checkMuted, moderateContent, async (req, res) => {
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

// Edit a message
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({ message: 'Message content is required' });
    }

    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user is the sender
    if (message.sender.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized to edit this message' });
    }

    message.content = content;
    message.edited = true;
    message.editedAt = new Date();
    await message.save();

    await message.populate('sender', 'username profilePhoto displayName');
    if (message.recipient) {
      await message.populate('recipient', 'username profilePhoto displayName');
    }

    res.json(message);
  } catch (error) {
    console.error('❌ Error editing message:', error);
    res.status(500).json({ message: 'Error editing message', error: error.message });
  }
});

// Delete a message
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user is the sender
    if (message.sender.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }

    await message.deleteOne();

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting message:', error);
    res.status(500).json({ message: 'Error deleting message', error: error.message });
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

// @route   POST /api/messages/:id/react
// @desc    Add a reaction to a message
// @access  Private
router.post('/:id/react', authMiddleware, async (req, res) => {
  try {
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ message: 'Emoji is required' });
    }

    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user already reacted with this emoji
    const existingReaction = message.reactions.find(
      r => r.user.toString() === req.userId && r.emoji === emoji
    );

    if (existingReaction) {
      return res.status(400).json({ message: 'You already reacted with this emoji' });
    }

    // Add reaction
    message.reactions.push({
      user: req.userId,
      emoji,
      createdAt: new Date()
    });

    await message.save();
    await message.populate('reactions.user', 'username displayName profilePhoto');

    res.json(message);
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/messages/:id/react
// @desc    Remove a reaction from a message
// @access  Private
router.delete('/:id/react', authMiddleware, async (req, res) => {
  try {
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ message: 'Emoji is required' });
    }

    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Remove reaction
    message.reactions = message.reactions.filter(
      r => !(r.user.toString() === req.userId && r.emoji === emoji)
    );

    await message.save();
    await message.populate('reactions.user', 'username displayName profilePhoto');

    res.json(message);
  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
