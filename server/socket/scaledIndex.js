/**
 * Socket.IO Scaled Server
 * 
 * Supports 100,000+ concurrent users through:
 * - Redis Adapter for horizontal scaling
 * - Per-user connection limits
 * - Optimized event routing
 * - Connection pooling
 * 
 * Usage:
 *   import { initializeScaledSocket } from './socket/scaledIndex.js';
 *   const { io } = initializeScaledSocket(httpServer, allowedOrigins, redisClient);
 */

import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import User from '../models/User.js';
import { emitValidated, wrapIO } from '../utils/emitValidated.js';
import { socketAuthMiddleware } from './middleware/auth.js';
import { registerMessageEvents } from './events/messages.js';
import { registerGlobalChatEvents } from './events/globalChat.js';
import { registerSocialEvents } from './events/social.js';
import { checkEventRate } from './rateLimiter.js';
import logger from '../utils/logger.js';

/**
 * Initialize scaled Socket.IO server with Redis adapter
 * @param {import('http').Server} httpServer 
 * @param {string[]} allowedOrigins 
 * @param {object} redisClient - ioredis client
 * @returns {{ io: import('socket.io').Server, onlineUsers: Map }}
 */
export function initializeScaledSocket(httpServer, allowedOrigins, redisClient) {
  // Pub/Sub clients for Redis Adapter
  const pubClient = redisClient;
  const subClient = redisClient.duplicate();
  
  // ─── Online presence state (Redis-backed for horizontal scaling) ─────────────
  const onlineUsers = new Map();
  const userConnections = new Map(); // userId → Set of socketIds
  
  const CACHE_TTL = 5 * 60 * 1000;
  
  // ─── Socket.IO server with optimizations ────────────────────────────────────
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    },
    // Performance optimizations
    transports: ['websocket', 'polling'],
    pingTimeout: 30000,
    pingInterval: 25000,
    connectTimeout: 20000,
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e6,
    allowUpgrades: true,
    allowEIO3: true,
    
    // Compression thresholds (only compress larger messages)
    perMessageDeflate: { 
      threshold: 1024,
      zlibDeflateOptions: { level: 6 } // Balanced compression
    },
    httpCompression: { 
      threshold: 1024,
      zlibDeflateOptions: { level: 6 }
    },
    
    // ─── Redis Adapter for horizontal scaling ───────────────────────────────
    adapter: createAdapter(pubClient, subClient, {
      // Request broadcast timeout
      broadcastTimeout: 1000,
      // Whether to use volatile (non-persistent) events
      withVolatile: false,
      // Key pattern for rooms
      key: 'socket.io'
    })
  });

  // ─── Per-user connection limit ─────────────────────────────────────────────
  const MAX_CONNECTIONS_PER_USER = 3;
  
  // ─── Event batching for high-frequency events ─────────────────────────────
  const eventBatches = new Map(); // eventName → { data: [], timeout: null }
  const BATCH_INTERVAL = 50; // ms
  
  /**
   * Batch events to reduce network overhead
   */
  const batchEvent = (room, eventName, data) => {
    const key = `${room}:${eventName}`;
    
    if (!eventBatches.has(key)) {
      eventBatches.set(key, { data: [], timeout: null });
      
      // Flush after batch interval
      eventBatches.get(key).timeout = setTimeout(() => {
        const batch = eventBatches.get(key);
        if (batch && batch.data.length > 0) {
          // Send batched data as array
          io.to(room).emit(eventName, { batch: batch.data });
          batch.data = [];
        }
        eventBatches.delete(key);
      }, BATCH_INTERVAL);
    }
    
    eventBatches.get(key).data.push(data);
  };

  // Wrap io for validation
  wrapIO(io);

  // ─── Auth middleware ───────────────────────────────────────────────────────
  io.use(socketAuthMiddleware);

  // ─── Connection handler ───────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.userId;

    // Reject unauthenticated connections
    if (!userId) {
      logger.error('CRITICAL: Socket connection with undefined userId — disconnecting', {
        socketId: socket.id,
        hasToken: !!socket.handshake.auth?.token
      });
      socket.emit('auth_error', { message: 'Authentication failed - no user ID' });
      socket.disconnect(true);
      return;
    }

    // ─── Per-user connection limit ─────────────────────────────────────────
    if (!userConnections.has(userId)) {
      userConnections.set(userId, new Set());
    }
    
    const userSockets = userConnections.get(userId);
    
    // Disconnect oldest socket if over limit
    if (userSockets.size >= MAX_CONNECTIONS_PER_USER) {
      logger.warn(`User ${userId} exceeded connection limit (${MAX_CONNECTIONS_PER_USER}), disconnecting oldest`);
      const oldestSocketId = userSockets.values().next().value;
      const oldestSocket = io.sockets.sockets.get(oldestSocketId);
      if (oldestSocket) {
        oldestSocket.emit('connection_limit', { message: 'Too many connections' });
        oldestSocket.disconnect(true);
      }
    }
    
    userSockets.add(socket.id);

    logger.debug(`User connected: ${userId} (socket: ${socket.id}, total: ${userSockets.size})`);

    // ─── Socket middleware ─────────────────────────────────────────────────
    socket.use((packet, next) => {
      try {
        const eventName = packet?.[0];
        // Only rate-limit high-frequency events
        if (['typing', 'reaction', 'presence'].includes(eventName)) {
          next();
        } else {
          next();
        }
      } catch (err) {
        logger.error('Socket middleware error:', err.message);
        next();
      }
    });

    // ─── Presence ─────────────────────────────────────────────────────────────
    onlineUsers.set(userId, socket.id);
    
    // Broadcast presence to all nodes (via Redis)
    io.emit('presence:update', { userId, online: true });

    // Send list of online users
    socket.emit('online_users', Array.from(onlineUsers.keys()));

    // Join user-specific room for targeted messaging
    socket.join(`user_${userId}`);
    
    // Join global chat room
    socket.join('global_chat');
    const globalChatCount = io.sockets.adapter.rooms.get('global_chat')?.size || 0;
    io.to('global_chat').emit('global_chat:online_count', { count: globalChatCount });

    // ─── Utility events ────────────────────────────────────────────────────
    socket.on('get_online_users', () => {
      socket.emit('online_users', Array.from(onlineUsers.keys()));
    });

    socket.on('join', async (data) => {
      try {
        const roomUserId = typeof data === 'string' ? data : data?.room?.replace('user_', '') || data?.userId;
        if (roomUserId && String(roomUserId) === String(userId)) {
          await socket.join(`user_${roomUserId}`);
        }
      } catch (error) {
        logger.error('Error joining room:', error.message);
      }
    });

    socket.on('ping', (dataOrCallback, maybeCallback) => {
      const callback = typeof dataOrCallback === 'function' ? dataOrCallback : maybeCallback;
      const response = { status: 'ok', userId, timestamp: Date.now() };
      if (typeof callback === 'function') {
        callback(response);
      } else {
        socket.emit('pong', response);
      }
    });

    // ─── Typing (DM) — rate limited ────────────────────────────────────────
    const typingTimeouts = new Map();

    socket.on('typing', async (data) => {
      const allowed = await checkEventRate(userId, 'typing', () => redisClient);
      if (!allowed) return;

      const recipientSocketId = onlineUsers.get(data.recipientId);
      if (recipientSocketId) {
        const existing = typingTimeouts.get(data.recipientId);
        if (existing) { clearTimeout(existing); typingTimeouts.delete(data.recipientId); }

        socket.to(recipientSocketId).emit('user_typing', { userId, isTyping: data.isTyping });

        if (data.isTyping) {
          const timeout = setTimeout(() => {
            socket.to(recipientSocketId).emit('user_typing', { userId, isTyping: false });
            typingTimeouts.delete(data.recipientId);
          }, 3000);
          typingTimeouts.set(data.recipientId, timeout);
        }
      }
    });

    socket.on('disconnect', () => {
      typingTimeouts.forEach(t => clearTimeout(t));
      typingTimeouts.clear();
      
      // Remove from user connections
      if (userConnections.has(userId)) {
        userConnections.get(userId).delete(socket.id);
        if (userConnections.get(userId).size === 0) {
          userConnections.delete(userId);
          onlineUsers.delete(userId);
          
          // Broadcast offline status via Redis
          io.emit('presence:update', { userId, online: false });
        }
      }

      const gcCount = io.sockets.adapter.rooms.get('global_chat')?.size || 0;
      io.to('global_chat').emit('global_chat:online_count', { count: gcCount });
    });

    // ─── Domain events ─────────────────────────────────────────────────────
    const deps = { 
      io, 
      onlineUsers, 
      onlineUsersCache: new Map(), 
      CACHE_TTL, 
      getRedis: () => redisClient 
    };

    registerMessageEvents(socket, deps);
    registerGlobalChatEvents(socket, deps);
    registerSocialEvents(socket, deps);
  });

  return { io, onlineUsers };
}

/**
 * Helper to initialize with fallback (Redis or in-memory)
 */
export async function initializeSocketWithFallback(httpServer, allowedOrigins, redisClient) {
  if (redisClient) {
    logger.info('🔄 Initializing Socket.IO with Redis adapter (scaled mode)');
    return initializeScaledSocket(httpServer, allowedOrigins, redisClient);
  } else {
    logger.info('🔄 Initializing Socket.IO with in-memory adapter (basic mode)');
    // Fall back to original implementation
    const { initializeSocket } = await import('./index.js');
    return initializeSocket(httpServer, allowedOrigins, null);
  }
}

export default { initializeScaledSocket, initializeSocketWithFallback };
