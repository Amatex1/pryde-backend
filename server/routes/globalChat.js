import express from 'express';
const router = express.Router();
import GlobalMessage from '../models/GlobalMessage.js';
import User from '../models/User.js';
import authMiddleware from '../middleware/auth.js';
import adminAuth from '../middleware/adminAuth.js';
import { messageLimiter } from '../middleware/rateLimiter.js';
import { moderateContent } from '../middleware/moderation.js';

// GET /api/global-chat/online-count - Get current online count (fast REST endpoint)
router.get('/online-count', authMiddleware, async (req, res) => {
  try {
    const io = req.app.get('io');
    if (!io) {
      return res.json({ count: 0 });
    }

    // Get the global_chat room size
    const globalChatRoom = io.sockets.adapter.rooms.get('global_chat');
    const count = globalChatRoom?.size || 0;

    res.json({ count });
  } catch (error) {
    console.error('❌ Error fetching online count:', error);
    res.json({ count: 0 }); // Return 0 on error, don't fail
  }
});

// GET /api/global-chat/messages - Fetch paginated global chat history
router.get('/messages', authMiddleware, async (req, res) => {
  try {
    const { before, limit = 50, includeDeleted = false } = req.query;
    const currentUserId = req.userId;

    // Get user to check if admin/mod
    const user = await User.findById(currentUserId);
    const isAdmin = user && ['moderator', 'admin', 'super_admin'].includes(user.role);

    // Parse limit (max 100)
    const parsedLimit = Math.min(parseInt(limit) || 50, 100);

    // Build query
    let query = {
      // Exclude messages deleted for current user (self-delete)
      'deletedFor.user': { $ne: currentUserId }
    };

    // Filter deleted messages unless admin requested them
    if (!includeDeleted || !isAdmin) {
      query.isDeleted = false;
    }

    // Pagination: get messages before a certain date/ID
    if (before) {
      // Try to parse as date first, then as ObjectId
      const beforeDate = new Date(before);
      if (!isNaN(beforeDate.getTime())) {
        query.createdAt = { $lt: beforeDate };
      }
    }

    // Fetch messages
    const messages = await GlobalMessage.find(query)
      .sort({ createdAt: -1 }) // Newest first for pagination
      .limit(parsedLimit)
      .populate('senderId', '_id username displayName profilePhoto avatar')
      .populate('deletedBy', '_id username displayName')
      .lean();

    // Transform sender data to match frontend expectations
    const transformedMessages = messages.map(msg => ({
      _id: msg._id,
      text: msg.text,
      gifUrl: msg.gifUrl, // 🔥 FIX: Include gifUrl in response
      contentWarning: msg.contentWarning,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
      isDeleted: msg.isDeleted,
      deletedAt: msg.deletedAt,
      sender: {
        id: msg.senderId?._id,
        _id: msg.senderId?._id,
        displayName: msg.senderId?.displayName || msg.senderId?.username,
        username: msg.senderId?.username,
        avatar: msg.senderId?.profilePhoto || msg.senderId?.avatar
      },
      deletedBy: msg.deletedBy ? {
        id: msg.deletedBy._id,
        displayName: msg.deletedBy.displayName || msg.deletedBy.username
      } : null
    }));

    res.json({
      messages: transformedMessages.reverse(), // Reverse to oldest-first for display
      hasMore: messages.length === parsedLimit
    });

  } catch (error) {
    console.error('❌ Error fetching global messages:', error);
    res.status(500).json({ message: 'Error fetching messages', error: error.message });
  }
});

// POST /api/global-chat/messages - Create a new global message
router.post('/messages', authMiddleware, messageLimiter, async (req, res) => {
  try {
    const { text, gifUrl, contentWarning } = req.body;
    const currentUserId = req.userId;

    // Validate that either text or gifUrl is provided
    if ((!text || typeof text !== 'string' || text.trim().length === 0) && !gifUrl) {
      return res.status(400).json({ message: 'Message text or GIF is required' });
    }

    const trimmedText = text ? text.trim() : '';

    if (trimmedText.length > 2000) {
      return res.status(400).json({ message: 'Message is too long (max 2000 characters)' });
    }

    // Get user to check if banned/suspended
    const user = await User.findById(currentUserId).select('username displayName profilePhoto avatar isBanned isSuspended');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isBanned) {
      return res.status(403).json({ message: 'You are banned and cannot send messages' });
    }

    if (user.isSuspended) {
      return res.status(403).json({ message: 'Your account is suspended and cannot send messages' });
    }

    // Moderate content (check for toxicity, spam, etc.) - only if text is provided
    if (trimmedText) {
      const moderationResult = await moderateContent(trimmedText);
      if (moderationResult.blocked) {
        return res.status(400).json({
          message: 'Message contains inappropriate content',
          reason: moderationResult.reason
        });
      }
    }

    // Create new global message
    const newMessage = new GlobalMessage({
      senderId: currentUserId,
      text: trimmedText || '',
      gifUrl: gifUrl || null,
      contentWarning: contentWarning?.trim() || null
    });

    await newMessage.save();

    // Populate sender info for response
    await newMessage.populate('senderId', '_id username displayName profilePhoto avatar');

    // Transform for response
    const responseMessage = {
      _id: newMessage._id,
      text: newMessage.text,
      gifUrl: newMessage.gifUrl,
      contentWarning: newMessage.contentWarning,
      createdAt: newMessage.createdAt,
      sender: {
        id: newMessage.senderId._id,
        _id: newMessage.senderId._id,
        displayName: newMessage.senderId.displayName || newMessage.senderId.username,
        username: newMessage.senderId.username,
        avatar: newMessage.senderId.profilePhoto || newMessage.senderId.avatar
      }
    };

    res.status(201).json(responseMessage);

  } catch (error) {
    console.error('❌ Error creating global message:', error);
    
    // Handle rate limit errors
    if (error.message && error.message.includes('rate limit')) {
      return res.status(429).json({ 
        message: "You're sending messages a bit too fast. Please slow down a little." 
      });
    }

    res.status(500).json({ message: 'Error creating message', error: error.message });
  }
});

// DELETE /api/global-chat/messages/:id - Delete a message
// Supports two modes via query param: deleteForAll=true (sender or admin) or delete for self only
router.delete('/messages/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { deleteForAll } = req.query;
    const currentUserId = req.userId;

    // Find the message
    const message = await GlobalMessage.findById(id);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Get user to check if admin/mod
    const user = await User.findById(currentUserId);
    const isAdmin = user && ['moderator', 'admin', 'super_admin'].includes(user.role);
    const isSender = message.senderId.toString() === currentUserId;

    // Delete for all (sender or admin can do this)
    if (deleteForAll === 'true') {
      if (!isSender && !isAdmin) {
        return res.status(403).json({ message: 'Only the sender or admins can delete for everyone' });
      }

      if (message.isDeleted) {
        return res.status(400).json({ message: 'Message is already deleted' });
      }

      // Soft delete the message for all
      message.isDeleted = true;
      message.deletedBy = currentUserId;
      message.deletedAt = new Date();

      await message.save();

      // Emit Socket.IO event to notify all clients
      const io = req.app.get('io');
      if (io) {
        io.to('global_chat').emit('global_message:deleted', {
          messageId: id,
          deleteForAll: true
        });
      }

      return res.json({
        message: 'Message deleted for everyone',
        messageId: id,
        deleteForAll: true
      });
    }

    // Delete for self only
    const alreadyDeleted = message.deletedFor.some(
      d => d.user.toString() === currentUserId
    );

    if (!alreadyDeleted) {
      message.deletedFor.push({
        user: currentUserId,
        deletedAt: new Date()
      });
      await message.save();
    }

    res.json({
      message: 'Message deleted for you',
      messageId: id,
      deleteForAll: false
    });

  } catch (error) {
    console.error('❌ Error deleting global message:', error);
    res.status(500).json({ message: 'Error deleting message', error: error.message });
  }
});

export default router;

