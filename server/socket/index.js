/**
 * Socket.IO Module
 *
 * Creates and configures the Socket.IO server.
 * Extracted from server.js — behaviour is identical.
 *
 * Added in this module:
 *   - Per-event rate limiting (send_message: 5/s, typing: 10/s, reaction: 10/s)
 *   - Structured logger replacing inline console.log calls
 *
 * Exports:
 *   initializeSocket(server, allowedOrigins, getRedis) → { io, onlineUsers }
 */

import { Server } from 'socket.io';
import sanitizeHtml from 'sanitize-html';
import User from '../models/User.js';
import { emitValidated, wrapIO, wrapSocket } from '../utils/emitValidated.js';
import { socketAuthMiddleware } from './middleware/auth.js';
import { registerMessageEvents } from './events/messages.js';
import { registerGlobalChatEvents } from './events/globalChat.js';
import { registerSocialEvents } from './events/social.js';
import { checkEventRate } from './rateLimiter.js';
import logger from '../utils/logger.js';

/**
 * Initialise the Socket.IO server.
 *
 * @param {import('http').Server} httpServer
 * @param {string[]} allowedOrigins
 * @param {(() => object|null)|object|null} getRedisOrGetter - ioredis client, a getter function returning
 *   the client, or null for in-memory fallback. A getter is preferred so the socket module always
 *   sees the latest client reference even if Redis connected after this function was called.
 * @returns {{ io: import('socket.io').Server, onlineUsers: Map<string,string> }}
 */
export function initializeSocket(httpServer, allowedOrigins, getRedisOrGetter = null) {
  // Normalise to a getter so event handlers always receive the current client
  const getRedis = typeof getRedisOrGetter === 'function'
    ? getRedisOrGetter
    : () => getRedisOrGetter;

  // ─── Online presence state ────────────────────────────────────────────────
  /** userId → socketId */
  const onlineUsers = new Map();

  /** userId → { username, displayName, avatar, role, timestamp } */
  const onlineUsersCache = new Map();

  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Periodic cache eviction (every 10 minutes)
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [uid, data] of onlineUsersCache.entries()) {
      if ((now - data.timestamp) > CACHE_TTL) {
        onlineUsersCache.delete(uid);
        cleaned++;
      }
    }
    if (cleaned > 0) logger.debug(`Evicted ${cleaned} stale entries from online users cache`);
  }, 10 * 60 * 1000);

  // ─── Socket.IO server ──────────────────────────────────────────────────────
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 30000,
    pingInterval: 25000,
    connectTimeout: 20000,
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e6,
    allowUpgrades: true,
    allowEIO3: true,
    perMessageDeflate: { threshold: 1024 },
    httpCompression: { threshold: 1024 }
  });

  // Wrap io for DEV-ONLY emit validation
  wrapIO(io);

  // ─── Auth middleware ───────────────────────────────────────────────────────
  io.use(socketAuthMiddleware);

  // ─── Connection handler ────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.userId;

    // Reject connections without a userId (auth middleware should prevent this)
    if (!userId) {
      logger.error('CRITICAL: Socket connection with undefined userId — disconnecting', {
        socketId: socket.id,
        hasToken: !!socket.handshake.auth?.token
      });
      socket.emit('auth_error', { message: 'Authentication failed - no user ID' });
      socket.disconnect(true);
      return;
    }

    logger.debug(`User connected: ${userId} (socket: ${socket.id})`);

    // Socket-level middleware — always pass send_message through
    socket.use((packet, next) => {
      try {
        const eventName = packet?.[0];
        if (eventName === 'send_message') return next();
        next();
      } catch (err) {
        logger.error('Socket middleware error:', err.message);
        next(); // never block events on error
      }
    });

    // Deep diagnostics — only when DEBUG=true
    if (process.env.DEBUG === 'true') {
      socket.onAny((eventName, ...args) => {
        try {
          let preview = '(no args)';
          if (args?.length > 0 && args[0] !== undefined) {
            const first = args[0];
            preview = typeof first === 'function'
              ? '(callback function)'
              : (JSON.stringify(first) || '(empty)').slice(0, 300);
          }
          logger.debug(`[Socket ${socket.id}] event="${eventName}" user=${userId} preview=${preview}`);
        } catch (err) {
          logger.warn(`Failed to log event "${eventName}":`, err.message);
        }
      });

      if (socket.conn) {
        socket.conn.on('packet', (packet) => {
          if (packet?.type === 'message' && packet?.data) {
            const dataStr = typeof packet.data === 'string' ? packet.data : JSON.stringify(packet.data);
            if (dataStr.includes('send_message')) {
              logger.debug(`[Engine.IO PACKET] socket=${socket.id} user=${userId} contains send_message`);
            }
          }
        });
      }
    }

    // ── Presence ─────────────────────────────────────────────────────────────
    onlineUsers.set(userId, socket.id);
    emitValidated(io, 'presence:update', { userId, online: true });
    emitValidated(socket, 'online_users', Array.from(onlineUsers.keys()));

    socket.join(`user_${userId}`);
    emitValidated(socket, 'room:joined', {
      room: `user_${userId}`,
      userId: String(userId),
      socketId: socket.id,
      autoJoined: true
    });

    socket.join('global_chat');
    const globalChatOnlineCount = io.sockets.adapter.rooms.get('global_chat')?.size || 0;
    emitValidated(io.to('global_chat'), 'global_chat:online_count', { count: globalChatOnlineCount });

    // ── Utility events ────────────────────────────────────────────────────────
    socket.on('get_online_users', () => {
      emitValidated(socket, 'online_users', Array.from(onlineUsers.keys()));
    });

    socket.on('join', async (data) => {
      try {
        const roomUserId = typeof data === 'string' ? data : data?.room?.replace('user_', '') || data?.userId;
        if (roomUserId && String(roomUserId) === String(userId)) {
          await socket.join(`user_${roomUserId}`);
          emitValidated(socket, 'room:joined', { room: `user_${roomUserId}`, userId: String(roomUserId), socketId: socket.id });
        } else {
          emitValidated(socket, 'room:error', { message: 'Invalid user ID or room' });
        }
      } catch (error) {
        logger.error('Error joining room:', error.message);
        emitValidated(socket, 'room:error', { message: 'Failed to join room' });
      }
    });

    socket.on('echo', (data, callback) => {
      if (typeof callback === 'function') callback({ echo: data, timestamp: Date.now(), userId });
    });

    socket.on('ping', (dataOrCallback, maybeCallback) => {
      const callback = typeof dataOrCallback === 'function' ? dataOrCallback : maybeCallback;
      const response = { status: 'ok', userId, timestamp: Date.now() };
      if (typeof callback === 'function') {
        try { callback(response); } catch (err) { logger.error('Ping callback error:', err.message); }
      } else {
        emitValidated(socket, 'pong', response);
      }
    });

    socket.on('debug:rooms', (callback) => {
      const info = { rooms: Array.from(socket.rooms), userId, socketId: socket.id, isOnline: onlineUsers.has(userId), onlineUsersCount: onlineUsers.size };
      if (typeof callback === 'function') callback(info);
      else emitValidated(socket, 'debug:rooms:response', info);
    });

    // ── Typing (DM) — rate limited ────────────────────────────────────────────
    const typingTimeouts = new Map();

    socket.on('typing', async (data) => {
      const allowed = await checkEventRate(userId, 'typing', getRedis);
      if (!allowed) return; // silently drop typing floods

      const recipientSocketId = onlineUsers.get(data.recipientId);
      if (recipientSocketId) {
        const existing = typingTimeouts.get(data.recipientId);
        if (existing) { clearTimeout(existing); typingTimeouts.delete(data.recipientId); }

        emitValidated(io.to(recipientSocketId), 'user_typing', { userId, isTyping: data.isTyping });

        if (data.isTyping) {
          const timeout = setTimeout(() => {
            emitValidated(io.to(recipientSocketId), 'user_typing', { userId, isTyping: false });
            typingTimeouts.delete(data.recipientId);
          }, 3000);
          typingTimeouts.set(data.recipientId, timeout);
        }
      }
    });

    // Clear typing timeouts when socket disconnects mid-typing
    socket.on('disconnect', () => {
      typingTimeouts.forEach(t => clearTimeout(t));
      typingTimeouts.clear();
    });

    // ── Domain-specific event registrations ───────────────────────────────────
    const deps = { io, onlineUsers, onlineUsersCache, CACHE_TTL, getRedis };

    registerMessageEvents(socket, deps);
    registerGlobalChatEvents(socket, deps);
    registerSocialEvents(socket, deps);

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      logger.debug(`User disconnected: ${userId}`);

      if (onlineUsers.get(userId) === socket.id) {
        onlineUsers.delete(userId);

        try {
          await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
        } catch (error) {
          logger.error('Error updating lastSeen on disconnect:', error.message);
        }

        emitValidated(io, 'presence:update', { userId, online: false });
      }

      const gcCount = io.sockets.adapter.rooms.get('global_chat')?.size || 0;
      emitValidated(io.to('global_chat'), 'global_chat:online_count', { count: gcCount });
    });
  });

  return { io, onlineUsers };
}
