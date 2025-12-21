import express from 'express';
const router = express.Router();
import Message from '../models/Message.js';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import mongoose from 'mongoose';
import auth from '../middleware/auth.js';
import requireActiveUser from '../middleware/requireActiveUser.js';
import { messageLimiter } from '../middleware/rateLimiter.js';
import { checkMessagingPermission, checkBlocked } from '../middleware/privacy.js';
import { checkMuted, moderateContent } from '../middleware/moderation.js';
import { sanitizeFields } from '../utils/sanitize.js';
import logger from '../utils/logger.js';

// Get conversation with a user
router.get('/:userId', auth, requireActiveUser, checkBlocked, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId;

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, recipient: userId },
        { sender: userId, recipient: currentUserId }
      ]
    })
      .populate('sender', 'username profilePhoto')
      .populate('recipient', 'username profilePhoto')
      .sort({ createdAt: 1 });

    logger.debug('✅ Found messages:', messages.length);

    res.json(messages);
  } catch (error) {
    logger.error('❌ Error fetching messages:', error);
    res.status(500).json({ message: 'Error fetching messages', error: error.message });
  }
});

// Get unread message counts per user
router.get('/unread/counts', auth, requireActiveUser, async (req, res) => {
  try {
    const currentUserId = req.userId;

    logger.debug('📊 Fetching unread counts for user:', currentUserId);

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

    logger.debug('📊 Unread counts aggregation result:', unreadCounts);

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

    logger.debug('📊 After population:', unreadCounts);

    // Filter out messages from deleted users (where _id is null after population)
    const validUnreadCounts = unreadCounts.filter(item => item._id !== null);

    // REMOVED: Aggressive cleanup that was deleting messages immediately after they were saved
    // The cleanup was too aggressive and was deleting valid messages
    // If we need cleanup, it should be done as a separate maintenance task, not on every request

    logger.debug('📊 Valid unread counts (after filtering deleted users):', validUnreadCounts);

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

    logger.debug('✅ Sending unread counts response:', response);
    res.json(response);
  } catch (error) {
    logger.error('❌ Error fetching unread counts:', error);
    res.status(500).json({ message: 'Error fetching unread counts', error: error.message });
  }
});

// Get all conversations
router.get('/', auth, requireActiveUser, async (req, res) => {
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
    // and check for manual unread status and unread count
    const populatedConversations = await Promise.all(
      messages.map(async (conv) => {
        const otherUser = await User.findById(conv._id).select('username profilePhoto displayName');

        // Check if conversation is manually marked as unread
        const conversation = await Conversation.findOne({
          participants: { $all: [currentUserId, conv._id] }
        });

        const isManuallyUnread = conversation?.unreadFor?.some(
          u => u.user.toString() === currentUserId
        );

        // Count unread messages from this user
        const unreadCount = await Message.countDocuments({
          sender: conv._id,
          recipient: currentUserId,
          read: false
        });

        // IMPORTANT: Decrypt the lastMessage content
        // Aggregation returns plain objects, not Mongoose documents,
        // so toJSON() is not called automatically
        if (conv.lastMessage?.content) {
          const { decryptMessage, isEncrypted } = await import('../utils/encryption.js');
          if (isEncrypted(conv.lastMessage.content)) {
            try {
              conv.lastMessage.content = decryptMessage(conv.lastMessage.content);
            } catch (error) {
              logger.error('❌ Error decrypting last message:', error);
              conv.lastMessage.content = '[Encrypted message]';
            }
          }
        }

        return {
          ...conv,
          otherUser,
          manuallyUnread: isManuallyUnread || false,
          unread: unreadCount
        };
      })
    );

    res.json(populatedConversations);
  } catch (error) {
    logger.error('❌ Error fetching conversations:', error);
    res.status(500).json({ message: 'Error fetching conversations', error: error.message });
  }
});

// Send a message
router.post('/', auth, requireActiveUser, messageLimiter, sanitizeFields(['content']), checkMessagingPermission, checkMuted, moderateContent, async (req, res) => {
  try {
    const { recipient, content, attachment, groupChatId, voiceNote } = req.body;

    const messageData = {
      sender: req.userId,
      recipient: groupChatId ? undefined : recipient,
      groupChat: groupChatId || null,
      content,
      attachment: attachment || null
    };

    // Only add voiceNote if it exists and has a URL
    if (voiceNote && voiceNote.url) {
      messageData.voiceNote = voiceNote;
    }

    const message = new Message(messageData);

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
    logger.error('❌ Error sending message:', error);
    res.status(500).json({ message: 'Error sending message', error: error.message });
  }
});

// Edit a message
router.put('/:id', auth, requireActiveUser, async (req, res) => {
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
    logger.error('❌ Error editing message:', error);
    res.status(500).json({ message: 'Error editing message', error: error.message });
  }
});

// Delete a message
router.delete('/:id', auth, requireActiveUser, async (req, res) => {
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
    logger.error('❌ Error deleting message:', error);
    res.status(500).json({ message: 'Error deleting message', error: error.message });
  }
});

// Mark message as read (with read receipts)
router.put('/:id/read', auth, requireActiveUser, async (req, res) => {
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
    logger.error('❌ Error updating message:', error);
    res.status(500).json({ message: 'Error updating message', error: error.message });
  }
});

// Mark message as delivered
router.put('/:id/delivered', auth, requireActiveUser, async (req, res) => {
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
    logger.error('❌ Error updating message:', error);
    res.status(500).json({ message: 'Error updating message', error: error.message });
  }
});

// Get group chat messages
router.get('/group/:groupId', auth, requireActiveUser, async (req, res) => {
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
router.post('/:id/react', auth, requireActiveUser, async (req, res) => {
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
    logger.error('Add reaction error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/messages/:id/react
// @desc    Remove a reaction from a message
// @access  Private
router.delete('/:id/react', auth, requireActiveUser, async (req, res) => {
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
    logger.error('Remove reaction error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ========================================
// CONVERSATION MANAGEMENT ENDPOINTS
// ========================================

// @route   POST /api/messages/conversations/:userId/archive
// @desc    Archive a conversation with a user
// @access  Private
router.post('/conversations/:userId/archive', auth, requireActiveUser, async (req, res) => {
  try {
    const currentUserId = req.userId;
    const otherUserId = req.params.userId;

    // Find or create conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [currentUserId, otherUserId] },
      groupChat: null
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [currentUserId, otherUserId]
      });
    }

    // Add to archivedBy if not already archived
    if (!conversation.archivedBy.includes(currentUserId)) {
      conversation.archivedBy.push(currentUserId);
      await conversation.save();
    }

    res.json({ message: 'Conversation archived', conversation });
  } catch (error) {
    logger.error('Archive conversation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/messages/conversations/:userId/unarchive
// @desc    Unarchive a conversation with a user
// @access  Private
router.post('/conversations/:userId/unarchive', auth, requireActiveUser, async (req, res) => {
  try {
    const currentUserId = req.userId;
    const otherUserId = req.params.userId;

    const conversation = await Conversation.findOne({
      participants: { $all: [currentUserId, otherUserId] },
      groupChat: null
    });

    if (conversation) {
      conversation.archivedBy = conversation.archivedBy.filter(
        id => id.toString() !== currentUserId
      );
      await conversation.save();
    }

    res.json({ message: 'Conversation unarchived', conversation });
  } catch (error) {
    logger.error('Unarchive conversation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/messages/conversations/:userId/mute
// @desc    Mute notifications for a conversation
// @access  Private
router.post('/conversations/:userId/mute', auth, requireActiveUser, async (req, res) => {
  try {
    const currentUserId = req.userId;
    const otherUserId = req.params.userId;
    const { duration } = req.body; // duration in hours, null for indefinite

    // Find or create conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [currentUserId, otherUserId] },
      groupChat: null
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [currentUserId, otherUserId]
      });
    }

    // Remove existing mute for this user
    conversation.mutedBy = conversation.mutedBy.filter(
      m => m.user.toString() !== currentUserId
    );

    // Add new mute
    const mutedUntil = duration ? new Date(Date.now() + duration * 60 * 60 * 1000) : null;
    conversation.mutedBy.push({
      user: currentUserId,
      mutedUntil
    });

    await conversation.save();

    res.json({ message: 'Conversation muted', conversation, mutedUntil });
  } catch (error) {
    logger.error('Mute conversation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/messages/conversations/:userId/unmute
// @desc    Unmute notifications for a conversation
// @access  Private
router.post('/conversations/:userId/unmute', auth, requireActiveUser, async (req, res) => {
  try {
    const currentUserId = req.userId;
    const otherUserId = req.params.userId;

    const conversation = await Conversation.findOne({
      participants: { $all: [currentUserId, otherUserId] },
      groupChat: null
    });

    if (conversation) {
      conversation.mutedBy = conversation.mutedBy.filter(
        m => m.user.toString() !== currentUserId
      );
      await conversation.save();
    }

    res.json({ message: 'Conversation unmuted', conversation });
  } catch (error) {
    logger.error('Unmute conversation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/messages/conversations/:userId/mark-unread
// @desc    Mark conversation as unread
// @access  Private
router.post('/conversations/:userId/mark-unread', auth, requireActiveUser, async (req, res) => {
  try {
    const currentUserId = req.userId;
    const otherUserId = req.params.userId;

    // Find or create conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [currentUserId, otherUserId] },
      groupChat: null
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [currentUserId, otherUserId]
      });
    }

    // Remove existing unread marker
    conversation.unreadFor = conversation.unreadFor.filter(
      u => u.user.toString() !== currentUserId
    );

    // Add new unread marker
    conversation.unreadFor.push({
      user: currentUserId,
      markedUnreadAt: new Date()
    });

    await conversation.save();

    res.json({ message: 'Conversation marked as unread', conversation });
  } catch (error) {
    logger.error('Mark unread error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/messages/conversations/:userId/mark-unread
// @desc    Remove manual unread status from conversation
// @access  Private
router.delete('/conversations/:userId/mark-unread', auth, requireActiveUser, async (req, res) => {
  try {
    const currentUserId = req.userId;
    const otherUserId = req.params.userId;

    // Find conversation
    const conversation = await Conversation.findOne({
      participants: { $all: [currentUserId, otherUserId] },
      groupChat: null
    });

    if (!conversation) {
      return res.json({ message: 'No conversation found' });
    }

    // Remove unread marker for current user
    conversation.unreadFor = conversation.unreadFor.filter(
      u => u.user.toString() !== currentUserId
    );

    await conversation.save();

    res.json({ message: 'Conversation marked as read', conversation });
  } catch (error) {
    logger.error('Mark read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/messages/conversations/:userId
// @desc    Delete entire conversation with a user
// @access  Private
router.delete('/conversations/:userId', auth, requireActiveUser, async (req, res) => {
  try {
    const currentUserId = req.userId;
    const otherUserId = req.params.userId;

    // Delete all messages between the two users
    await Message.deleteMany({
      $or: [
        { sender: currentUserId, recipient: otherUserId },
        { sender: otherUserId, recipient: currentUserId }
      ]
    });

    // Delete conversation metadata
    await Conversation.deleteOne({
      participants: { $all: [currentUserId, otherUserId] },
      groupChat: null
    });

    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    logger.error('Delete conversation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
