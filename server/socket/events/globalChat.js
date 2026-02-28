/**
 * Socket event handlers — Global Chat (Lounge)
 *
 * Extracted from server.js — behaviour is identical.
 * Added: per-event rate limiting via socket/rateLimiter.js
 */

import User from '../../models/User.js';
import { emitValidated } from '../../utils/emitValidated.js';
import { notifyMentionsInLounge } from '../../services/mentionNotificationService.js';
import { checkEventRate } from '../rateLimiter.js';
import logger from '../../utils/logger.js';

/**
 * Register global chat socket event handlers on a connected socket.
 *
 * @param {import('socket.io').Socket} socket
 * @param {{ io, onlineUsers, onlineUsersCache, CACHE_TTL, getRedis }} deps
 */
export function registerGlobalChatEvents(socket, { io, onlineUsers, onlineUsersCache, CACHE_TTL, getRedis }) {
  const userId = socket.userId;

  // Join global chat room
  socket.on('global_chat:join', () => {
    socket.join('global_chat');
    const count = io.sockets.adapter.rooms.get('global_chat')?.size || 0;
    emitValidated(io.to('global_chat'), 'global_chat:online_count', { count });
  });

  // Online users list (privileged users only)
  socket.on('global_chat:get_online_users', async () => {
    try {
      if (!socket.userRole) {
        const user = await User.findById(userId).select('role').lean();
        if (!user) { socket.emit('error', { message: 'User not found' }); return; }
        socket.userRole = user.role;
      }

      if (!['super_admin', 'admin', 'moderator'].includes(socket.userRole)) {
        logger.warn(`User ${userId} (${socket.userRole}) attempted to access online users list`);
        socket.emit('error', { message: 'Insufficient permissions' });
        return;
      }

      const globalChatRoom = io.sockets.adapter.rooms.get('global_chat');
      if (!globalChatRoom) {
        emitValidated(socket, 'global_chat:online_users_list', { users: [] });
        return;
      }

      const socketIdsSet = new Set(globalChatRoom);
      const onlineUserIds = [];
      for (const [uid, sid] of onlineUsers.entries()) {
        if (socketIdsSet.has(sid)) onlineUserIds.push(uid);
      }

      const now = Date.now();
      const formattedUsers = [];
      const uncachedUserIds = [];

      for (const uid of onlineUserIds) {
        const cached = onlineUsersCache.get(uid);
        if (cached && (now - cached.timestamp) < CACHE_TTL) {
          formattedUsers.push({ id: uid, username: cached.username, displayName: cached.displayName, avatar: cached.avatar, role: cached.role });
        } else {
          uncachedUserIds.push(uid);
        }
      }

      if (uncachedUserIds.length > 0) {
        const dbUsers = await User.find({ _id: { $in: uncachedUserIds } })
          .select('username displayName profilePhoto avatar role')
          .lean()
          .maxTimeMS(2000);

        for (const u of dbUsers) {
          const userData = { username: u.username, displayName: u.displayName || u.username, avatar: u.profilePhoto || u.avatar, role: u.role, timestamp: now };
          onlineUsersCache.set(u._id.toString(), userData);
          formattedUsers.push({ id: u._id, ...userData });
        }
      }

      emitValidated(socket, 'global_chat:online_users_list', { users: formattedUsers });
    } catch (error) {
      logger.error('Error fetching online users for global chat:', error.message);
      emitValidated(socket, 'error', { message: 'Error fetching online users' });
    }
  });

  // Typing indicator — rate limited
  socket.on('global_chat:typing', async (data) => {
    const allowed = await checkEventRate(userId, 'global_chat:typing', getRedis);
    if (!allowed) return; // silently drop — flooding typing events is low severity

    try {
      const { isTyping } = data;
      emitValidated(socket.to('global_chat'), 'global_chat:user_typing', { userId, isTyping: isTyping || false });
    } catch (error) {
      logger.error('Error handling global chat typing:', error.message);
    }
  });

  // Send global message — rate limited
  socket.on('global_message:send', async (data) => {
    const allowed = await checkEventRate(userId, 'global_message:send', getRedis);
    if (!allowed) {
      socket.emit('error', { message: 'Rate limit exceeded — slow down', code: 'RATE_LIMITED' });
      return;
    }

    const startTime = Date.now();
    try {
      const { text, gifUrl, contentWarning } = data;

      if ((!text || typeof text !== 'string' || text.trim().length === 0) && !gifUrl) {
        socket.emit('error', { message: 'Message text or GIF is required' });
        return;
      }

      const trimmedText = text ? text.trim() : '';
      if (trimmedText.length > 2000) {
        socket.emit('error', { message: 'Message is too long (max 2000 characters)' });
        return;
      }

      const user = await User.findById(userId).select('username displayName profilePhoto avatar isBanned isSuspended');
      if (!user) { socket.emit('error', { message: 'User not found' }); return; }
      if (user.isBanned) { socket.emit('error', { message: 'You are banned and cannot send messages' }); return; }
      if (user.isSuspended) { socket.emit('error', { message: 'Your account is suspended and cannot send messages' }); return; }

      const GlobalMessage = (await import('../../models/GlobalMessage.js')).default;

      const newMessage = new GlobalMessage({
        senderId: userId,
        text: trimmedText || '',
        gifUrl: gifUrl || null,
        contentWarning: contentWarning?.trim() || null
      });

      // Prepare and emit immediately — don't block on DB save
      const messagePayload = {
        _id: newMessage._id,
        text: newMessage.text,
        gifUrl: newMessage.gifUrl,
        contentWarning: newMessage.contentWarning,
        createdAt: newMessage.createdAt,
        sender: {
          id: user._id,
          _id: user._id,
          displayName: user.displayName || user.username,
          username: user.username,
          avatar: user.profilePhoto || user.avatar
        }
      };

      emitValidated(io.to('global_chat'), 'global_message:new', messagePayload);

      // Background save
      newMessage.save().catch(err => logger.error('Global message background save failed:', err.message));

      // Process @mentions (fire-and-forget)
      if (trimmedText) {
        notifyMentionsInLounge({
          content: trimmedText,
          authorId: userId,
          author: { displayName: user.displayName, username: user.username },
          messageId: newMessage._id.toString(),
          io
        }).catch(err => logger.error('[Mention] Lounge notification error:', err.message));
      }

      logger.debug(`[global_message:send] sent by ${user.username} in ${Date.now() - startTime}ms`);
    } catch (error) {
      logger.error('Error sending global message:', error.message);
      socket.emit('error', { message: 'Error sending message' });
    }
  });
}
