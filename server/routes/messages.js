import express from 'express';
const router = express.Router();
import Message from '../models/Message.js';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import Notification from '../models/Notification.js';
import GroupChat from '../models/GroupChat.js';
import mongoose from 'mongoose';
import auth from '../middleware/auth.js';
import requireActiveUser from '../middleware/requireActiveUser.js';
import requireEmailVerification from '../middleware/requireEmailVerification.js';
import { messageLimiter } from '../middleware/rateLimiter.js';
import { checkMessagingPermission, checkBlocked } from '../middleware/privacy.js';
import { checkMuted, moderateContent } from '../middleware/moderation.js';
import { guardSendDM } from '../middleware/systemAccountGuard.js';
import { validateParamId } from '../middleware/validation.js';
import { sanitizeFields } from '../utils/sanitize.js';
import logger from '../utils/logger.js';
import { emitNotificationCreated } from '../utils/notificationEmitter.js';
import { sendPushNotification } from './pushNotifications.js';
import { emitValidated } from '../utils/emitValidated.js';

// ========================================
// IMPORTANT: Define specific routes BEFORE wildcard routes like /:userId
// ========================================

// Get all conversations list (for dropdown and main messages page)
// This route MUST be before /:userId to avoid matching
router.get('/list', auth, requireActiveUser, async (req, res) => {
  try {
    const currentUserId = req.userId;
    const currentUserObjId = new mongoose.Types.ObjectId(currentUserId);

    // Get unique conversation partners with last message and unread count in ONE aggregation
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: currentUserObjId },
            { recipient: currentUserObjId }
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
              { $eq: ['$sender', currentUserObjId] },
              '$recipient',
              '$sender'
            ]
          },
          lastMessage: { $first: '$$ROOT' },
          // Count unread messages (from other user to current user, not read)
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$sender', currentUserObjId] },
                    { $eq: ['$read', false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $sort: { 'lastMessage.createdAt': -1 }
      }
    ]);

    // Get all other user IDs for batch lookup
    const otherUserIds = conversations.map(c => c._id);

    // Batch fetch all users at once
    const [users, conversationDocs] = await Promise.all([
      User.find({ _id: { $in: otherUserIds } }).select('username profilePhoto displayName').lean(),
      Conversation.find({
        participants: { $all: [currentUserId] },
        $or: otherUserIds.map(id => ({ participants: id }))
      }).select('participants unreadFor lastReadMessageId').lean()
    ]);

    // Create lookup maps for O(1) access
    const userMap = new Map(users.map(u => [u._id.toString(), u]));
    const conversationMap = new Map();
    conversationDocs.forEach(c => {
      const otherParticipant = c.participants.find(p => p.toString() !== currentUserId);
      if (otherParticipant) {
        conversationMap.set(otherParticipant.toString(), c);
      }
    });

    // Import encryption utilities once
    const { decryptMessage, isEncrypted } = await import('../utils/encryption.js');

    // Build response using maps (no additional DB queries)
    const populatedConversations = conversations.map(conv => {
      const otherUserId = conv._id.toString();
      const otherUser = userMap.get(otherUserId) || null;
      const conversationDoc = conversationMap.get(otherUserId);

      const isManuallyUnread = conversationDoc?.unreadFor?.some(
        u => u.user.toString() === currentUserId
      ) || false;

      // Get last read message ID for this user (for unread divider)
      const lastReadEntry = conversationDoc?.lastReadMessageId?.find(
        lr => lr.user.toString() === currentUserId
      );
      const lastReadMessageId = lastReadEntry?.messageId?.toString() || null;

      // Decrypt last message if needed (with backward compatibility for JSON strings)
      if (conv.lastMessage?.content) {
        try {
          let contentToDecrypt = conv.lastMessage.content;

          // Handle backward compatibility: if content is a JSON string of encrypted blob, parse it
          if (typeof conv.lastMessage.content === 'string') {
            try {
              contentToDecrypt = JSON.parse(conv.lastMessage.content);
            } catch (parseError) {
              // Not a JSON string, assume it's plain text - leave as is
              // No decryption needed
            }
          }

          // Decrypt if the content appears to be encrypted
          if (contentToDecrypt && isEncrypted(contentToDecrypt)) {
            conv.lastMessage.content = decryptMessage(contentToDecrypt);
          }
        } catch (error) {
          conv.lastMessage.content = '[Encrypted message]';
        }
      }

      return {
        ...conv,
        otherUser,
        manuallyUnread: isManuallyUnread,
        unread: conv.unreadCount,
        lastReadMessageId
      };
    });

    res.json(populatedConversations);
  } catch (error) {
    logger.error('❌ Error fetching conversations list:', error);
    res.status(500).json({ message: 'Error fetching conversations', error: error.message });
  }
});

// Get shared media with a user (messages with attachments)
// 🔥 IMPORTANT: This route MUST be defined BEFORE /:userId to avoid route collision
router.get('/:userId/media', auth, requireActiveUser, validateParamId('userId'), checkBlocked, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId;
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;

    logger.debug('📸 Fetching shared media', { currentUserId, userId, limit, skip });

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, recipient: userId },
        { sender: userId, recipient: currentUserId }
      ],
      attachment: { $ne: null, $exists: true },
      'deletedFor.user': { $ne: currentUserId },
      isDeletedForAll: false
    })
      .populate('sender', 'username profilePhoto')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    logger.debug('📸 Found shared media:', messages.length);

    res.json({
      media: messages.map(msg => ({
        _id: msg._id,
        attachment: msg.attachment,
        sender: msg.sender,
        createdAt: msg.createdAt
      })),
      hasMore: messages.length === limit
    });
  } catch (error) {
    logger.error('❌ Error fetching shared media:', error);
    res.status(500).json({ message: 'Error fetching shared media', error: error.message });
  }
});

// Get conversation with a user
// 🔥 FIX: Added validateParamId to prevent MongoDB errors with invalid IDs
router.get('/:userId', auth, requireActiveUser, validateParamId('userId'), checkBlocked, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId;

    // 📝 DETAILED LOGGING: Request received
    logger.info('📥 [GET /messages/:userId] Fetching conversation', {
      currentUser: currentUserId,
      otherUser: userId,
      timestamp: new Date().toISOString()
    });

    // Allow viewing existing message threads regardless of user status
    // This preserves chat history even if user is deactivated/deleted
    // Exclude messages that are deleted for this user specifically
    const queryStartTime = Date.now();
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, recipient: userId },
        { sender: userId, recipient: currentUserId }
      ],
      // Exclude messages deleted for current user only
      'deletedFor.user': { $ne: currentUserId }
    })
      .populate('sender', 'username profilePhoto')
      .populate('recipient', 'username profilePhoto')
      .sort({ createdAt: 1 });

    const queryDuration = Date.now() - queryStartTime;

    // 📝 DETAILED LOGGING: Query results
    logger.info('📬 [GET /messages/:userId] Messages retrieved', {
      count: messages.length,
      queryDuration: `${queryDuration}ms`,
      firstMessageId: messages[0]?._id,
      lastMessageId: messages[messages.length - 1]?._id
    });

    // Transform messages to show "deleted" state for messages deleted for all
    const transformedMessages = messages.map(msg => {
      const msgObj = msg.toJSON();

      // If deleted for all, hide content but keep the message placeholder
      if (msgObj.isDeletedForAll) {
        return {
          ...msgObj,
          content: '',
          attachment: null,
          isDeleted: true,
          deletedType: 'all'
        };
      }

      return msgObj;
    });

    logger.debug('✅ Found messages:', transformedMessages.length);

    res.json(transformedMessages);
  } catch (error) {
    logger.error('❌ Error fetching messages:', error);
    res.status(500).json({ message: 'Error fetching messages', error: error.message });
  }
});

// ✅ Explicit CORS preflight for message counters
router.options('/unread/counts', (req, res) => {
  res.sendStatus(204);
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

// Get all conversations (OPTIMIZED - batch queries instead of N+1)
router.get('/', auth, requireActiveUser, async (req, res) => {
  try {
    const currentUserId = req.userId;
    const currentUserObjId = new mongoose.Types.ObjectId(currentUserId);

    // Get unique conversation partners with last message and unread count in ONE aggregation
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: currentUserObjId },
            { recipient: currentUserObjId }
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
              { $eq: ['$sender', currentUserObjId] },
              '$recipient',
              '$sender'
            ]
          },
          lastMessage: { $first: '$$ROOT' },
          // Count unread messages (from other user to current user, not read)
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$sender', currentUserObjId] },
                    { $eq: ['$read', false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $sort: { 'lastMessage.createdAt': -1 }
      }
    ]);

    // Get all other user IDs for batch lookup
    const otherUserIds = conversations.map(c => c._id);

    // Batch fetch all users at once
    const [users, conversationDocs] = await Promise.all([
      User.find({ _id: { $in: otherUserIds } }).select('username profilePhoto displayName').lean(),
      Conversation.find({
        participants: { $all: [currentUserId] },
        $or: otherUserIds.map(id => ({ participants: id }))
      }).select('participants unreadFor lastReadMessageId').lean()
    ]);

    // Create lookup maps for O(1) access
    const userMap = new Map(users.map(u => [u._id.toString(), u]));
    const conversationMap = new Map();
    conversationDocs.forEach(c => {
      const otherParticipant = c.participants.find(p => p.toString() !== currentUserId);
      if (otherParticipant) {
        conversationMap.set(otherParticipant.toString(), c);
      }
    });

    // Import encryption utilities once
    const { decryptMessage, isEncrypted } = await import('../utils/encryption.js');

    // Build response using maps (no additional DB queries)
    const populatedConversations = conversations.map(conv => {
      const otherUserId = conv._id.toString();
      const otherUser = userMap.get(otherUserId) || null;
      const conversationDoc = conversationMap.get(otherUserId);

      const isManuallyUnread = conversationDoc?.unreadFor?.some(
        u => u.user.toString() === currentUserId
      ) || false;

      // Get last read message ID for this user (for unread divider)
      const lastReadEntry = conversationDoc?.lastReadMessageId?.find(
        lr => lr.user.toString() === currentUserId
      );
      const lastReadMessageId = lastReadEntry?.messageId?.toString() || null;

      // Decrypt last message if needed (with backward compatibility for JSON strings)
      if (conv.lastMessage?.content) {
        try {
          let contentToDecrypt = conv.lastMessage.content;

          // Handle backward compatibility: if content is a JSON string of encrypted blob, parse it
          if (typeof conv.lastMessage.content === 'string') {
            try {
              contentToDecrypt = JSON.parse(conv.lastMessage.content);
            } catch (parseError) {
              // Not a JSON string, assume it's plain text - leave as is
              // No decryption needed
            }
          }

          // Decrypt if the content appears to be encrypted
          if (contentToDecrypt && isEncrypted(contentToDecrypt)) {
            conv.lastMessage.content = decryptMessage(contentToDecrypt);
          }
        } catch (error) {
          conv.lastMessage.content = '[Encrypted message]';
        }
      }

      return {
        ...conv,
        otherUser,
        manuallyUnread: isManuallyUnread,
        unread: conv.unreadCount,
        lastReadMessageId
      };
    });

    res.json(populatedConversations);
  } catch (error) {
    logger.error('❌ Error fetching conversations:', error);
    res.status(500).json({ message: 'Error fetching conversations', error: error.message });
  }
});

// Send a message (requires email verification)
// System accounts cannot send DMs (all roles blocked)
router.post('/', auth, requireActiveUser, requireEmailVerification, messageLimiter, guardSendDM, sanitizeFields(['content']), checkMessagingPermission, checkMuted, moderateContent, async (req, res) => {
  try {
    // REMOVED 2025-12-26: voiceNote no longer accepted (Phase 5)
    const { recipient, content, attachment, groupChatId } = req.body;

    // 📝 DETAILED LOGGING: Request received
    logger.info('📤 [POST /messages] New message request', {
      sender: req.userId,
      recipient: recipient || 'N/A',
      groupChatId: groupChatId || 'N/A',
      hasContent: !!content,
      hasAttachment: !!attachment,
      contentLength: content?.length || 0,
      timestamp: new Date().toISOString()
    });

    // Validate recipient availability (only for direct messages, not group chats)
    if (!groupChatId && recipient) {
      logger.debug('🔍 [POST /messages] Validating recipient availability', { recipient });
      const recipientUser = await User.findById(recipient);

      if (!recipientUser) {
        logger.warn('⚠️ [POST /messages] Recipient not found', { recipient });
        return res.status(403).json({ message: 'This user is unavailable.' });
      }

      // Check if recipient is active
      if (recipientUser.isActive === false) {
        logger.warn('⚠️ [POST /messages] Recipient is inactive', { recipient });
        return res.status(403).json({ message: 'This user is unavailable.' });
      }

      // Check if recipient is deleted
      if (recipientUser.isDeleted === true) {
        logger.warn('⚠️ [POST /messages] Recipient is deleted', { recipient });
        return res.status(403).json({ message: 'This user is unavailable.' });
      }

      // Check if recipient has blocked the sender
      if (recipientUser.blockedUsers && recipientUser.blockedUsers.some(blockedId => blockedId.toString() === req.userId)) {
        logger.warn('⚠️ [POST /messages] Sender is blocked by recipient', { sender: req.userId, recipient });
        return res.status(403).json({ message: 'This user is unavailable.' });
      }

      logger.debug('✅ [POST /messages] Recipient validation passed');
    }

    const messageData = {
      sender: req.userId,
      recipient: groupChatId ? undefined : recipient,
      groupChat: groupChatId || null,
      content,
      attachment: attachment || null
      // REMOVED 2025-12-26: voiceNote deleted (Phase 5)
    };

    logger.debug('💾 [POST /messages] Creating message document', {
      sender: messageData.sender,
      recipient: messageData.recipient,
      groupChat: messageData.groupChat,
      hasContent: !!messageData.content,
      hasAttachment: !!messageData.attachment
    });

    const message = new Message(messageData);

    logger.debug('💾 [POST /messages] Saving message to database...');
    const saveStartTime = Date.now();
    await message.save();
    const saveDuration = Date.now() - saveStartTime;

    logger.info('✅ [POST /messages] Message saved to database', {
      messageId: message._id,
      createdAt: message.createdAt,
      saveDuration: `${saveDuration}ms`
    });

    await message.populate('sender', 'username profilePhoto');
    if (!groupChatId) {
      await message.populate('recipient', 'username profilePhoto');
    }
    logger.debug('✅ [POST /messages] Message populated with user data');

    // Update group chat's last message if it's a group message
    if (groupChatId) {
      await GroupChat.findByIdAndUpdate(groupChatId, {
        lastMessage: message._id,
        updatedAt: Date.now()
      });
    }

    // 🔥 CRITICAL FIX: Emit socket events for real-time delivery
    // This ensures messages work even if sent via REST API instead of socket
    if (req.io && !groupChatId) {
      logger.debug('🔌 [POST /messages] Emitting socket events', {
        recipientRoom: `user_${recipient}`,
        senderRoom: `user_${req.userId}`
      });

      // Send to recipient if online
      emitValidated(req.io.to(`user_${recipient}`), 'message:new', message);
      logger.debug('✅ [POST /messages] Emitted message:new to recipient');

      // Send back to sender as confirmation
      emitValidated(req.io.to(`user_${req.userId}`), 'message:sent', message);
      logger.debug('✅ [POST /messages] Emitted message:sent to sender');

      logger.info('✅ [POST /messages] Socket events emitted successfully');
    } else if (!req.io) {
      logger.warn('⚠️ [POST /messages] Socket.IO not available, skipping real-time events');
    }

    // 🔔 Create notification for new DM (only for direct messages, not group chats)
    if (!groupChatId && recipient) {
      try {
        const notification = new Notification({
          recipient: recipient,
          sender: req.userId,
          type: 'message',
          message: 'sent you a message'
        });
        await notification.save();
        await notification.populate('sender', 'username displayName profilePhoto');

        // ✅ Emit real-time notification
        emitNotificationCreated(req.io, recipient.toString(), notification);

        // Send push notification
        const sender = await User.findById(req.userId).select('username displayName');
        const senderName = sender.displayName || sender.username;

        sendPushNotification(recipient, {
          title: `💬 New Message`,
          body: `${senderName}: ${content ? content.substring(0, 50) : 'Sent an attachment'}`,
          data: {
            type: 'message',
            userId: req.userId.toString(),
            url: `/messages/${sender.username}`
          },
          tag: `message-${req.userId}`
        }).catch(err => logger.error('Push notification error:', err));
      } catch (notificationError) {
        // Don't fail the request if notification creation fails
        logger.error('Failed to create message notification:', notificationError);
      }
    }

    logger.info('✅ [POST /messages] Message sent successfully', {
      messageId: message._id,
      sender: req.userId,
      recipient: recipient || groupChatId,
      type: groupChatId ? 'group' : 'direct'
    });

    res.status(201).json(message);
  } catch (error) {
    logger.error('❌ [POST /messages] Error sending message', {
      error: error.message,
      stack: error.stack,
      sender: req.userId,
      recipient: req.body.recipient,
      groupChatId: req.body.groupChatId
    });
    res.status(500).json({ message: 'Error sending message', error: error.message });
  }
});

// Edit a message
// 🔥 CRITICAL: validateParamId blocks temp_* optimistic IDs and validates ObjectId format
router.put('/:id', auth, requireActiveUser, validateParamId('id'), async (req, res) => {
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
// Supports two modes: deleteForAll (sender only) or deleteForSelf (anyone in conversation)
// 🔥 CRITICAL: validateParamId blocks temp_* optimistic IDs and validates ObjectId format
router.delete('/:id', auth, requireActiveUser, validateParamId('id'), async (req, res) => {
  try {
    const { deleteForAll } = req.query;
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const isSender = message.sender.toString() === req.userId;
    const isRecipient = message.recipient && message.recipient.toString() === req.userId;
    const isInConversation = isSender || isRecipient;

    // Check if user is part of this conversation
    if (!isInConversation) {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }

    // Delete for all (only sender can do this)
    if (deleteForAll === 'true') {
      if (!isSender) {
        return res.status(403).json({ message: 'Only the sender can delete for everyone' });
      }

      message.isDeletedForAll = true;
      message.deletedForAll = {
        by: req.userId,
        at: new Date()
      };
      await message.save();

      // Emit socket event to notify all participants
      const io = req.app.get('io');
      if (io) {
        // Notify both sender and recipient
        io.to(`user_${message.sender.toString()}`).emit('message:deleted', {
          messageId: message._id,
          deleteForAll: true
        });
        if (message.recipient) {
          io.to(`user_${message.recipient.toString()}`).emit('message:deleted', {
            messageId: message._id,
            deleteForAll: true
          });
        }
      }

      return res.json({
        message: 'Message deleted for everyone',
        messageId: message._id,
        deleteForAll: true
      });
    }

    // Delete for self only
    const alreadyDeleted = message.deletedFor.some(
      d => d.user.toString() === req.userId
    );

    if (!alreadyDeleted) {
      message.deletedFor.push({
        user: req.userId,
        deletedAt: new Date()
      });
      await message.save();
    }

    // Emit socket event only to this user
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${req.userId}`).emit('message:deleted', {
        messageId: message._id,
        deleteForAll: false,
        deletedForUser: req.userId
      });
    }

    res.json({
      message: 'Message deleted for you',
      messageId: message._id,
      deleteForAll: false
    });
  } catch (error) {
    logger.error('❌ Error deleting message:', error);
    res.status(500).json({ message: 'Error deleting message', error: error.message });
  }
});

// Mark message as read (with read receipts)
// 🔥 CRITICAL: validateParamId blocks temp_* optimistic IDs and validates ObjectId format
router.put('/:id/read', auth, requireActiveUser, validateParamId('id'), async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // For direct messages
    if (message.recipient && message.recipient.toString() === req.userId) {
      message.read = true;
      await message.save();

      // PHASE R: Emit socket event for cross-device sync
      const io = req.app.get('io');
      if (io) {
        // Notify the reader (for cross-device sync)
        io.to(`user_${req.userId}`).emit('message:read', {
          messageId: message._id,
          conversationWith: message.sender.toString()
        });
        // Notify the sender (for read receipts)
        io.to(`user_${message.sender.toString()}`).emit('message:read', {
          messageId: message._id,
          readBy: req.userId
        });
      }
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

        // PHASE R: Emit socket event for group message read
        const io = req.app.get('io');
        if (io) {
          io.to(`user_${req.userId}`).emit('message:read', {
            messageId: message._id,
            groupChatId: message.groupChat.toString()
          });
        }
      }
    }

    res.json(message);
  } catch (error) {
    logger.error('❌ Error updating message:', error);
    res.status(500).json({ message: 'Error updating message', error: error.message });
  }
});

// Mark message as delivered
// 🔥 CRITICAL: validateParamId blocks temp_* optimistic IDs and validates ObjectId format
router.put('/:id/delivered', auth, requireActiveUser, validateParamId('id'), async (req, res) => {
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
// 🔥 CRITICAL: validateParamId blocks temp_* optimistic IDs and validates ObjectId format
router.post('/:id/react', auth, requireActiveUser, validateParamId('id'), async (req, res) => {
  try {
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ message: 'Emoji is required' });
    }

    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user already reacted with this emoji - make idempotent
    const existingReaction = message.reactions.find(
      r => r.user.toString() === req.userId && r.emoji === emoji
    );

    // Idempotent: if already reacted with this emoji, return success (no-op)
    if (existingReaction) {
      logger.debug('noop.message_reaction.already_exists', {
        userId: req.userId,
        targetId: req.params.id,
        emoji: emoji,
        endpoint: 'POST /messages/:id/react'
      });
      await message.populate('reactions.user', 'username displayName profilePhoto');
      return res.json(message);
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
// 🔥 CRITICAL: validateParamId blocks temp_* optimistic IDs and validates ObjectId format
router.delete('/:id/react', auth, requireActiveUser, validateParamId('id'), async (req, res) => {
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
// 🔥 FIX: Added validateParamId to prevent MongoDB errors with invalid IDs
router.post('/conversations/:userId/archive', auth, requireActiveUser, validateParamId('userId'), async (req, res) => {
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
router.post('/conversations/:userId/unarchive', auth, requireActiveUser, validateParamId('userId'), async (req, res) => {
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
router.post('/conversations/:userId/mute', auth, requireActiveUser, validateParamId('userId'), async (req, res) => {
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
router.post('/conversations/:userId/unmute', auth, requireActiveUser, validateParamId('userId'), async (req, res) => {
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
router.post('/conversations/:userId/mark-unread', auth, requireActiveUser, validateParamId('userId'), async (req, res) => {
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
router.delete('/conversations/:userId/mark-unread', auth, requireActiveUser, validateParamId('userId'), async (req, res) => {
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

    // PHASE R: Emit socket event for cross-device sync
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${currentUserId}`).emit('message:read', {
        conversationWith: otherUserId
      });
    }

    res.json({ message: 'Conversation marked as read', conversation });
  } catch (error) {
    logger.error('Mark read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/messages/conversations/:userId/last-read
// @desc    Update last read message ID for unread divider
// @access  Private
router.put('/conversations/:userId/last-read', auth, requireActiveUser, validateParamId('userId'), async (req, res) => {
  try {
    const currentUserId = req.userId;
    const otherUserId = req.params.userId;
    const { messageId } = req.body;

    if (!messageId) {
      return res.status(400).json({ message: 'messageId is required' });
    }

    // Validate messageId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ message: 'Invalid messageId format' });
    }

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

    // Remove existing lastReadMessageId for this user
    conversation.lastReadMessageId = conversation.lastReadMessageId.filter(
      lr => lr.user.toString() !== currentUserId
    );

    // Add new lastReadMessageId
    conversation.lastReadMessageId.push({
      user: currentUserId,
      messageId: messageId,
      updatedAt: new Date()
    });

    await conversation.save();

    logger.debug('✅ Updated lastReadMessageId', {
      currentUserId,
      otherUserId,
      messageId
    });

    res.json({ message: 'Last read message updated', lastReadMessageId: messageId });
  } catch (error) {
    logger.error('Update last read message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/messages/conversations/:userId
// @desc    Delete entire conversation with a user
// @access  Private
router.delete('/conversations/:userId', auth, requireActiveUser, validateParamId('userId'), async (req, res) => {
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
