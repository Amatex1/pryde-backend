/**
 * Socket event handlers — Direct Messages (send_message)
 *
 * Extracted from server.js — behaviour is identical.
 * Added: per-event rate limiting via socket/rateLimiter.js
 */

import sanitizeHtml from 'sanitize-html';
import Message from '../../models/Message.js';
import User from '../../models/User.js';
import Notification from '../../models/Notification.js';
import { emitValidated } from '../../utils/emitValidated.js';
import { emitNotificationCreated } from '../../utils/notificationEmitter.js';
import { sendPushNotification } from '../../routes/pushNotifications.js';
import { checkEventRate } from '../rateLimiter.js';
import logger from '../../utils/logger.js';

/**
 * Register message-related socket event handlers on a connected socket.
 *
 * @param {import('socket.io').Socket} socket
 * @param {{ io: import('socket.io').Server, onlineUsers: Map, getRedis: any }} deps
 */
export function registerMessageEvents(socket, { io, onlineUsers, getRedis }) {
  const userId = socket.userId;

  /**
   * 💬 SEND MESSAGE (HARDENED)
   * ACK is guaranteed in all code paths.
   */
  socket.on('send_message', async (data, callback) => {
    // Rate limit check
    const allowed = await checkEventRate(userId, 'send_message', getRedis);
    if (!allowed) {
      const rl = { error: 'Rate limit exceeded', code: 'RATE_LIMITED', timestamp: new Date().toISOString() };
      if (typeof callback === 'function') callback(rl);
      return;
    }

    logger.debug(`[send_message] received from user ${userId}`);

    // Ensure callback is always a function so ACK timeout never fires on the client
    if (typeof callback !== 'function') {
      logger.error('[send_message] No callback provided — no-op fallback used');
      callback = () => {};
    }

    const startTime = Date.now();

    const sendError = (message, code) => {
      const errorResponse = { error: message, code, timestamp: new Date().toISOString() };
      if (typeof callback === 'function') callback(errorResponse);
      socket.emit('message:error', errorResponse);
    };

    try {
      if (!data || typeof data !== 'object') {
        sendError('Invalid message data', 'INVALID_DATA');
        return;
      }

      if (!data.recipientId) {
        sendError('Recipient ID is required', 'MISSING_RECIPIENT');
        return;
      }

      const sanitizedContent = data.content
        ? sanitizeHtml(data.content, { allowedTags: [], allowedAttributes: {} }).trim()
        : '';

      if (!sanitizedContent && !data.attachment && !data.voiceNote) {
        sendError('Message must have content, attachment, or voice note', 'EMPTY_MESSAGE');
        return;
      }

      const { createMessageIdempotent } = await import('../../utils/messageDeduplication.js');

      const messageData = {
        sender: userId,
        recipient: data.recipientId,
        content: sanitizedContent || ' ',
        attachment: data.attachment || null
      };

      if (data.voiceNote?.url) {
        messageData.voiceNote = data.voiceNote;
      }

      let result;
      try {
        result = await createMessageIdempotent(messageData, async (d) => {
          const msg = new Message(d);
          await msg.save();
          return msg;
        });
      } catch (saveError) {
        logger.error('[send_message] Message save failed:', saveError.message);
        sendError(`Failed to save message: ${saveError.message}`, 'MESSAGE_SAVE_ERROR');
        return;
      }

      // Duplicate detection — return existing message
      if (result.isDuplicate) {
        const message = await Message.findById(result.messageId).populate([
          { path: 'sender', select: 'username profilePhoto' },
          { path: 'recipient', select: 'username profilePhoto' }
        ]);
        const messageWithTempId = message.toJSON ? message.toJSON() : { ...message };
        if (data._tempId) messageWithTempId._tempId = data._tempId;

        callback({ success: true, duplicate: true, messageId: result.messageId, _tempId: data._tempId });
        emitValidated(io.to(`user_${userId}`), 'message:sent', messageWithTempId);
        return;
      }

      const message = result.message;

      await message.populate([
        { path: 'sender', select: 'username profilePhoto' },
        { path: 'recipient', select: 'username profilePhoto' }
      ]);

      // Emit to recipient's room
      emitValidated(io.to(`user_${data.recipientId}`), 'message:new', message);

      // Emit confirmation to sender
      const messageWithTempId = message.toJSON ? message.toJSON() : { ...message };
      if (data._tempId) messageWithTempId._tempId = data._tempId;

      try {
        callback({ success: true, messageId: message._id.toString(), _tempId: data._tempId });
      } catch (callbackErr) {
        logger.error('[send_message] ACK callback error:', callbackErr.message);
      }

      emitValidated(io.to(`user_${userId}`), 'message:sent', messageWithTempId);

      logger.debug(`[send_message] socket emit done in ${Date.now() - startTime}ms`);

      // Background: notification + push (non-blocking)
      const sender = await User.findById(userId).select('username displayName profilePhoto');
      const senderName = sender.displayName || sender.username;

      const { createNotificationIdempotent } = await import('../../utils/notificationDeduplication.js');
      const notifResult = await createNotificationIdempotent(
        { recipient: data.recipientId, sender: userId, type: 'message', message: 'You have a new message', link: '/messages', metadata: { senderId: userId } },
        async (d) => { const n = new Notification(d); await n.save(); return n; }
      );

      if (!notifResult.isDuplicate) {
        const notification = notifResult.notification;
        notification.sender = sender;
        emitNotificationCreated(io, data.recipientId, notification);
      }

      const messagePreview = sanitizedContent.length > 50
        ? sanitizedContent.substring(0, 50) + '...'
        : (sanitizedContent || (data.attachment ? '📎 Attachment' : '🎤 Voice note'));

      sendPushNotification(data.recipientId, {
        title: `💬 ${senderName}`,
        body: messagePreview,
        data: { type: 'message', senderId: userId, url: `/messages?user=${userId}` },
        tag: `message-${userId}`
      }).catch(err => logger.error('Push notification error:', err.message));

      logger.debug(`[send_message] total handling ${Date.now() - startTime}ms`);

    } catch (error) {
      logger.error('[send_message] unexpected error:', error.message);

      let errorMessage = 'Error sending message';
      let errorCode = 'SEND_MESSAGE_ERROR';

      if (error.name === 'ValidationError') { errorMessage = 'Invalid message data'; errorCode = 'VALIDATION_ERROR'; }
      else if (error.name === 'CastError') { errorMessage = 'Invalid recipient ID'; errorCode = 'INVALID_RECIPIENT_ID'; }
      else if (error.code === 11000) { errorMessage = 'Duplicate message detected'; errorCode = 'DUPLICATE_MESSAGE'; }

      sendError(errorMessage, errorCode);
    }
  });
}
