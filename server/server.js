import dotenv from "dotenv";
dotenv.config();

// Only log in development
if (process.env.NODE_ENV === 'development') {
  console.log('🔐 JWT_SECRET from env:', process.env.JWT_SECRET ? 'Set' : 'Not set');
}

import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import cookieParser from "cookie-parser";
import compression from "compression";
import sanitizeHtml from "sanitize-html";

// Import routes
import authRoutes from './routes/auth.js';
import refreshRoutes from './routes/refresh.js';
import usersRoutes from './routes/users.js';
// PHASE 1 REFACTOR: Friends system kept for backward compatibility
import friendsRoutes from './routes/friends.js';
import followRoutes from './routes/follow.js';
import postsRoutes from './routes/posts.js';
import feedRoutes from './routes/feed.js'; // PHASE 2: Global and Following feeds
import journalsRoutes from './routes/journals.js'; // PHASE 3: Journaling
import longformRoutes from './routes/longform.js'; // PHASE 3: Longform posts
import tagsRoutes, { initializeTags } from './routes/tags.js'; // PHASE 4: Community tags
import photoEssaysRoutes from './routes/photoEssays.js'; // PHASE 5: Photo essays
import uploadRoutes from './routes/upload.js';
import notificationsRoutes from './routes/notifications.js';
import messagesRoutes from './routes/messages.js';
import groupChatsRoutes from './routes/groupChats.js';
import globalChatRoutes from './routes/globalChat.js';
import pushNotificationsRouter from './routes/pushNotifications.js';
import reportsRoutes from './routes/reports.js';
import blocksRoutes from './routes/blocks.js';
import adminRoutes from './routes/admin.js';
import searchRoutes from './routes/search.js';
import twoFactorRoutes from './routes/twoFactor.js';
import sessionsRoutes, { setSocketIO } from './routes/sessions.js';
import privacyRoutes from './routes/privacy.js';
import bookmarksRoutes from './routes/bookmarks.js';
import passkeyRoutes from './routes/passkey.js';
import eventsRoutes from './routes/events.js';
import loginApprovalRoutes from './routes/loginApproval.js';
import draftsRoutes from './routes/drafts.js';
import recoveryContactsRoutes from './routes/recoveryContacts.js';
import commentsRoutes from './routes/comments.js';
import reactionsRoutes from './routes/reactions.js';
import backupRoutes from './routes/backup.js';
import auditRoutes from './routes/audit.js';
import versionRoutes from './routes/version.js';

// Import middleware
import auth from './middleware/auth.js';
import requireActiveUser from './middleware/requireActiveUser.js';
import { setCsrfToken, enforceCsrf } from './middleware/csrf.js';

// Import rate limiters
import {
  globalLimiter,
  loginLimiter,
  signupLimiter,
  postLimiter,
  messageLimiter,
  commentLimiter,
  friendRequestLimiter,
  passwordResetLimiter,
  uploadLimiter,
  searchLimiter,
  reactionLimiter,
  reportLimiter
} from './middleware/rateLimiter.js';

import connectDB from "./dbConn.js";
import config from "./config/config.js";

connectDB();

// Import models
import Notification from './models/Notification.js';
import User from './models/User.js';
import Message from './models/Message.js';

// Import push notification utility
import { sendPushNotification } from './routes/pushNotifications.js';
import { emitNotificationCreated } from './utils/notificationEmitter.js';

const app = express();
const server = http.createServer(app);

// Allowed origins for CORS
const allowedOrigins = [
  // Production domains (replace with your actual domain)
  'https://prydesocial.com',
  'https://www.prydesocial.com',
  'https://prydeapp.com',
  'https://www.prydeapp.com',
  // Development
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  // Render URLs
  'https://pryde-frontend.onrender.com',
  'https://pryde-1flx.onrender.com',
  // Cloudflare Pages URLs
  'https://pryde-social.pages.dev',
  /\.pages\.dev$/, // Allow all Cloudflare Pages subdomains
  config.frontendURL,
  config.cloudflareURL
].filter(Boolean); // Remove any undefined values

// Socket.IO setup with CORS
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Set Socket.IO instance for session routes
setSocketIO(io);

// Middleware - Enhanced CORS configuration
const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      callback(null, true);
      return;
    }

    // Check if origin is in allowed list (string match)
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
      return;
    }

    // Check if origin matches any regex patterns
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-XSRF-TOKEN'],
  exposedHeaders: ['Authorization', 'X-CSRF-Token'], // Expose CSRF token for cross-origin requests
  optionsSuccessStatus: 200
};

// Trust proxy - required for Render and rate limiting
app.set('trust proxy', 1);

// HTTPS enforcement in production
if (config.nodeEnv === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}

// Security middleware - Helmet for security headers
// ⚠️ CSP DISABLED IN HELMET - Using custom CSP override below to fix Workbox warnings
app.use(helmet({
  contentSecurityPolicy: false, // ❌ DISABLED - Custom CSP override below
  // ORIGINAL CSP CONFIG (COMMENTED OUT):
  // contentSecurityPolicy: {
  //   directives: {
  //     defaultSrc: ["'self'"],
  //     // Note: 'unsafe-inline' is a security risk but may be needed for React apps
  //     // Consider using nonces or hashes in production for better security
  //     scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // unsafe-eval needed for React DevTools
  //     styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  //     imgSrc: ["'self'", "data:", "https:", "blob:"],
  //     connectSrc: ["'self'", ...allowedOrigins.filter(o => typeof o === 'string')],
  //     fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
  //     objectSrc: ["'none'"],
  //     mediaSrc: ["'self'", "blob:"],
  //     frameSrc: ["'none'"],
  //     baseUri: ["'self'"],
  //     formAction: ["'self'"],
  //     frameAncestors: ["'none'"], // Prevent clickjacking
  //     upgradeInsecureRequests: config.nodeEnv === 'production' ? [] : null, // Force HTTPS in production
  //   },
  // },
  crossOriginEmbedderPolicy: false, // Allow embedding for uploads
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resources
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true, // Prevent MIME type sniffing
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }, // Privacy-friendly referrer policy
  xssFilter: true, // Enable XSS filter
}));

// MongoDB injection protection
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    if (config.nodeEnv === 'development') {
      console.warn(`⚠️ Sanitized key: ${key}`);
    }
  },
}));

// XSS protection is handled by:
// 1. express-mongo-sanitize (above) - prevents NoSQL injection
// 2. helmet (above) - sets security headers including Content-Security-Policy
// 3. express-validator in routes - validates and sanitizes input fields
// Note: xss-clean is deprecated, so we use the combination above instead

app.use(cors(corsOptions));
app.use(cookieParser()); // Parse cookies for CSRF tokens

// Compression middleware - compress all responses
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6 // Compression level (0-9, 6 is default and good balance)
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply global rate limiter to all requests
app.use(globalLimiter);

// CSRF Protection - Set token on all requests
// This generates and sends CSRF token in cookie for client to use
app.use(setCsrfToken);

// CSRF Protection - Verify token on state-changing requests (POST, PUT, PATCH, DELETE)
// This provides defense-in-depth even with JWT authentication
app.use(enforceCsrf);

// ====================================
// CSP OVERRIDE MIDDLEWARE
// ====================================
// 🔧 FIX: Workbox Service Worker CSP warnings
// MUST be AFTER helmet, cors, auth, csrf, etc.
// MUST be BEFORE routes
//
// PROBLEM:
// - Workbox generates blob: URLs for service worker scripts
// - Default CSP blocks blob: in script-src
// - Causes "script-src 'none'" warnings in console
// - Cached CSP headers can break auth after deployment
//
// SOLUTION:
// - Remove any cached CSP headers
// - Set CSP-Report-Only (non-blocking, logs violations)
// - Allow blob: for script-src and worker-src
// - Maintain strict security for other directives
//
// SECURITY:
// ✅ Report-Only mode (doesn't block, only reports)
// ✅ Strict default-src 'self'
// ✅ blob: only for scripts and workers (required for Workbox)
// ✅ No 'unsafe-inline' or 'unsafe-eval' in script-src
// ✅ frame-ancestors 'none' (prevent clickjacking)
// ✅ object-src 'none' (prevent Flash/plugin exploits)
//
app.use((req, res, next) => {
  // Remove any existing CSP headers (prevents cached header conflicts)
  res.removeHeader("Content-Security-Policy");
  res.removeHeader("Content-Security-Policy-Report-Only");

  // Set CSP-Report-Only (non-blocking, logs violations)
  res.setHeader(
    "Content-Security-Policy-Report-Only",
    [
      "default-src 'self'",
      "script-src 'self' blob:",
      "script-src-elem 'self' blob:",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self' https://pryde-social.onrender.com wss:",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'"
    ].join("; ")
  );

  next();
});

// Store online users
const onlineUsers = new Map(); // userId -> socketId

// Middleware to make socket.io available in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes with specific rate limiters
app.use('/api/auth', authRoutes);
app.use('/api/refresh', refreshRoutes);
app.use('/api/users', usersRoutes);
// PHASE 1 REFACTOR: Friends routes kept for backward compatibility
app.use('/api/friends', friendsRoutes);
app.use('/api/follow', followRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/feed', feedRoutes); // PHASE 2: Global and Following feeds
app.use('/api/journals', journalsRoutes); // PHASE 3: Journaling
app.use('/api/longform', longformRoutes); // PHASE 3: Longform posts
app.use('/api/tags', tagsRoutes); // PHASE 4: Community tags
app.use('/api/photo-essays', photoEssaysRoutes); // PHASE 5: Photo essays
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/groupchats', groupChatsRoutes);
app.use('/api/global-chat', globalChatRoutes);
app.use('/api/push', pushNotificationsRouter);
app.use('/api/reports', reportsRoutes);
app.use('/api/blocks', blocksRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/2fa', twoFactorRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/privacy', privacyRoutes);
app.use('/api/bookmarks', bookmarksRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/login-approval', loginApprovalRoutes);
app.use('/api/drafts', draftsRoutes);
app.use('/api/recovery-contacts', recoveryContactsRoutes);
app.use('/api', commentsRoutes); // Comment routes (handles /api/posts/:postId/comments and /api/comments/:commentId)
app.use('/api/reactions', reactionsRoutes); // Universal reaction system
app.use('/api/backup', backupRoutes); // Backup download routes
app.use('/api/audit', auditRoutes); // Admin audit routes
app.use('/api/version', versionRoutes); // Version endpoint for update detection

// Debug: Log the passkey router before registering
console.log('🔍 Passkey router type:', typeof passkeyRoutes);
console.log('🔍 Passkey router stack length:', passkeyRoutes?.stack?.length);

app.use('/api/passkey', passkeyRoutes);

// Log passkey routes registration
console.log('✅ Passkey routes registered at /api/passkey');
console.log('   Available routes:');
console.log('   - GET  /api/passkey/test');
console.log('   - POST /api/passkey/register-start');
console.log('   - POST /api/passkey/register-finish');
console.log('   - POST /api/passkey/login-start');
console.log('   - POST /api/passkey/login-finish');
console.log('   - GET  /api/passkey/list');
console.log('   - DELETE /api/passkey/:credentialId');

// Debug: List all registered routes
console.log('\n🔍 All registered /api routes:');
app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    console.log(`   ${Object.keys(middleware.route.methods)} ${middleware.route.path}`);
  } else if (middleware.name === 'router') {
    console.log(`   Router: ${middleware.regexp}`);
  }
});

// Serve static files from the React app (dist folder)
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, '../dist')));

// Health check and status endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Pryde Social API is running', timestamp: new Date().toISOString() });
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    service: 'Pryde Social API',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Version endpoint for update detection
app.get('/api/version', (req, res) => {
  res.json({
    version: process.env.APP_VERSION || '1.0.0',
    buildTime: process.env.BUILD_TIME || new Date().toISOString()
  });
});

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  // Try to get token from auth object first, then from Authorization header
  const token = socket.handshake.auth?.token ||
                socket.handshake.headers?.authorization?.split(' ')[1];

  if (config.nodeEnv === 'development') {
    console.log('🔌 Socket.IO authentication attempt');
    console.log('🔑 Token received:', token ? 'Yes' : 'No');
    console.log('🔑 Token source:', socket.handshake.auth?.token ? 'auth.token' :
                socket.handshake.headers?.authorization ? 'Authorization header' : 'none');
  }

  if (!token) {
    if (config.nodeEnv === 'development') {
      console.log('❌ No token provided');
    }
    return next(new Error('Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (config.nodeEnv === 'development') {
      console.log('✅ Token verified successfully');
    }

    // Check if session still exists and user is active (session logout validation)
    if (decoded.sessionId) {
      const user = await User.findById(decoded.userId).select('activeSessions isActive isDeleted');

      if (!user) {
        if (config.nodeEnv === 'development') {
          console.log('❌ User not found');
        }
        return next(new Error('User not found'));
      }

      // CRITICAL: Block deleted users from socket connection
      if (user.isDeleted) {
        if (config.nodeEnv === 'development') {
          console.log('❌ Account has been deleted');
        }
        return next(new Error('Account deleted'));
      }

      // CRITICAL: Block deactivated users from socket connection
      if (!user.isActive) {
        if (config.nodeEnv === 'development') {
          console.log('❌ Account is deactivated');
        }
        return next(new Error('Account deactivated'));
      }

      const sessionExists = user.activeSessions.some(
        s => s.sessionId === decoded.sessionId
      );

      if (!sessionExists) {
        if (config.nodeEnv === 'development') {
          console.log('❌ Session has been logged out');
        }
        return next(new Error('Session has been logged out'));
      }
    }

    socket.userId = decoded.userId;
    socket.sessionId = decoded.sessionId;
    next();
  } catch (error) {
    if (config.nodeEnv === 'development') {
      console.log('❌ Token verification failed:', error.message);
    }
    next(new Error('Authentication error'));
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  const userId = socket.userId;
  console.log(`User connected: ${userId}`);
  
  // Store user's socket connection
  onlineUsers.set(userId, socket.id);

  // Emit online status to all users (dual events for compatibility)
  io.emit('user_online', { userId });
  io.emit('presence:update', { userId, online: true });

  // Send list of online users to the newly connected user
  socket.emit('online_users', Array.from(onlineUsers.keys()));
  
  // Join user to their personal room for targeted notifications
  socket.join(`user_${userId}`);

  // Join user to global chat room
  socket.join('global_chat');

  // Emit updated online count to global chat
  const globalChatOnlineCount = io.sockets.adapter.rooms.get('global_chat')?.size || 0;
  io.to('global_chat').emit('global_chat:online_count', { count: globalChatOnlineCount });

  // Handle request for online users list (for mobile/slow connections)
  socket.on('get_online_users', () => {
    console.log(`📡 User ${userId} requested online users list`);
    socket.emit('online_users', Array.from(onlineUsers.keys()));
  });

  // Handle typing indicator
  socket.on('typing', (data) => {
    const recipientSocketId = onlineUsers.get(data.recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('user_typing', {
        userId: userId,
        isTyping: data.isTyping
      });
    }
  });
  
  // Handle real-time message
  socket.on('send_message', async (data) => {
    try {
      // SECURITY: Sanitize message content to prevent XSS
      const sanitizedContent = data.content ? sanitizeHtml(data.content, {
        allowedTags: [],
        allowedAttributes: {}
      }).trim() : '';

      const messageData = {
        sender: userId,
        recipient: data.recipientId,
        content: sanitizedContent,
        attachment: data.attachment || null
      };

      // Only add voiceNote if it exists and has a URL
      if (data.voiceNote && data.voiceNote.url) {
        messageData.voiceNote = data.voiceNote;
      }

      const message = new Message(messageData);

      await message.save();

      await message.populate('sender', 'username profilePhoto');
      await message.populate('recipient', 'username profilePhoto');

      // Send to recipient if online
      const recipientSocketId = onlineUsers.get(data.recipientId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('new_message', message);
      }

      // Send back to sender as confirmation
      socket.emit('message_sent', message);

      // Create notification for recipient
      const notification = new Notification({
        recipient: data.recipientId,
        sender: userId,
        type: 'message',
        message: `You have a new message`,
        link: `/messages`
      });
      await notification.save();
      await notification.populate('sender', 'username displayName profilePhoto');

      // ✅ Emit real-time notification using centralized emitter
      emitNotificationCreated(io, data.recipientId, notification);

      // Send push notification
      const sender = await User.findById(userId).select('username displayName');
      const senderName = sender.displayName || sender.username;
      const messagePreview = data.content.length > 50
        ? data.content.substring(0, 50) + '...'
        : data.content;

      sendPushNotification(data.recipientId, {
        title: `💬 ${senderName}`,
        body: messagePreview,
        data: {
          type: 'message',
          senderId: userId,
          url: `/messages?user=${userId}`
        },
        tag: `message-${userId}`
      }).catch(err => console.error('Push notification error:', err));
    } catch (error) {
      console.error('❌ Error saving message:', error);
      socket.emit('error', { message: 'Error sending message' });
    }
  });
  
  // Handle friend request notification
  socket.on('friend_request_sent', async (data) => {
    const recipientSocketId = onlineUsers.get(data.recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('friend_request_received', {
        senderId: userId,
        senderUsername: data.senderUsername,
        senderPhoto: data.senderPhoto
      });
    }
  });
  
  // Handle friend request accepted
  socket.on('friend_request_accepted', async (data) => {
    const requesterSocketId = onlineUsers.get(data.requesterId);
    if (requesterSocketId) {
      io.to(requesterSocketId).emit('friend_request_accepted', {
        accepterId: userId,
        accepterUsername: data.accepterUsername,
        accepterPhoto: data.accepterPhoto
      });
    }
  });

  // ========================================
  // GLOBAL CHAT (LOUNGE) HANDLERS
  // ========================================

  // Handle user joining global chat
  socket.on('global_chat:join', () => {
    console.log(`📡 User ${userId} joined global chat`);
    socket.join('global_chat');

    // Send updated online count
    const globalChatOnlineCount = io.sockets.adapter.rooms.get('global_chat')?.size || 0;
    io.to('global_chat').emit('global_chat:online_count', { count: globalChatOnlineCount });
  });

  // Handle request for online users list (privileged users only)
  socket.on('global_chat:get_online_users', async () => {
    try {
      // Get current user to check role
      const user = await User.findById(userId).select('role');

      if (!user) {
        socket.emit('error', { message: 'User not found' });
        return;
      }

      // Only allow super_admin, admin, and moderator to see online users list
      if (!['super_admin', 'admin', 'moderator'].includes(user.role)) {
        socket.emit('error', { message: 'Insufficient permissions' });
        return;
      }

      // Get all online user IDs from the global_chat room
      const globalChatRoom = io.sockets.adapter.rooms.get('global_chat');
      if (!globalChatRoom) {
        socket.emit('global_chat:online_users_list', { users: [] });
        return;
      }

      // Get socket IDs from the room
      const socketIds = Array.from(globalChatRoom);

      // Map socket IDs to user IDs
      const onlineUserIds = [];
      for (const [uid, sid] of onlineUsers.entries()) {
        if (socketIds.includes(sid)) {
          onlineUserIds.push(uid);
        }
      }

      // Fetch user details for online users
      const onlineUsersDetails = await User.find({
        _id: { $in: onlineUserIds }
      }).select('username displayName profilePhoto avatar role');

      // Format response
      const formattedUsers = onlineUsersDetails.map(u => ({
        id: u._id,
        username: u.username,
        displayName: u.displayName || u.username,
        avatar: u.profilePhoto || u.avatar,
        role: u.role
      }));

      socket.emit('global_chat:online_users_list', { users: formattedUsers });
      console.log(`📡 Sent online users list to ${user.role} ${userId}`);

    } catch (error) {
      console.error('❌ Error fetching online users:', error);
      socket.emit('error', { message: 'Error fetching online users' });
    }
  });

  // Handle global message send
  socket.on('global_message:send', async (data) => {
    try {
      const { text, gifUrl, contentWarning } = data;

      // Validate that either text or gifUrl is provided
      if ((!text || typeof text !== 'string' || text.trim().length === 0) && !gifUrl) {
        socket.emit('error', { message: 'Message text or GIF is required' });
        return;
      }

      const trimmedText = text ? text.trim() : '';

      if (trimmedText.length > 2000) {
        socket.emit('error', { message: 'Message is too long (max 2000 characters)' });
        return;
      }

      // Get user to check if banned/suspended
      const user = await User.findById(userId).select('username displayName profilePhoto avatar isBanned isSuspended');

      if (!user) {
        socket.emit('error', { message: 'User not found' });
        return;
      }

      if (user.isBanned) {
        socket.emit('error', { message: 'You are banned and cannot send messages' });
        return;
      }

      if (user.isSuspended) {
        socket.emit('error', { message: 'Your account is suspended and cannot send messages' });
        return;
      }

      // Import GlobalMessage model
      const GlobalMessage = (await import('./models/GlobalMessage.js')).default;

      // Create new global message
      const newMessage = new GlobalMessage({
        senderId: userId,
        text: trimmedText || '',
        gifUrl: gifUrl || null,
        contentWarning: contentWarning?.trim() || null
      });

      await newMessage.save();

      // Prepare message payload for broadcast
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

      // Broadcast to all users in global_chat room
      io.to('global_chat').emit('global_message:new', messagePayload);

      console.log(`✅ Global message sent by ${user.username}`);

    } catch (error) {
      console.error('❌ Error sending global message:', error);
      socket.emit('error', { message: 'Error sending message' });
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${userId}`);

    // Only remove from onlineUsers if this is the user's current socket
    if (onlineUsers.get(userId) === socket.id) {
      onlineUsers.delete(userId);

      // Update lastSeen timestamp
      try {
        await User.findByIdAndUpdate(userId, {
          lastSeen: new Date()
        });
      } catch (error) {
        console.error('Error updating lastSeen:', error);
      }

      // Emit offline status to all users (dual events for compatibility)
      io.emit('user_offline', { userId });
      io.emit('presence:update', { userId, online: false });
    }

    // Emit updated global chat online count
    const globalChatOnlineCount = io.sockets.adapter.rooms.get('global_chat')?.size || 0;
    io.to('global_chat').emit('global_chat:online_count', { count: globalChatOnlineCount });
  });
});

// Make io accessible in routes
app.set('io', io);
app.set('onlineUsers', onlineUsers);

// Catch-all route - serve React app for all non-API routes
// This MUST be after all API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
const PORT = config.port;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Base URL: ${config.baseURL}`);
  console.log('Socket.IO server ready for real-time connections');

  // Daily backup system is DISABLED by default
  // To enable daily backups, set ENABLE_AUTO_BACKUP=true in your .env file
  // Backups run once per day at 3:00 AM UTC and keep 30 days of history
  // Or run manual backups with: npm run backup
  if (process.env.ENABLE_AUTO_BACKUP === 'true') {
    import('./scripts/dailyBackup.js')
      .then(() => console.log('✅ Daily backup system started (3:00 AM UTC, 30-day retention)'))
      .catch(err => console.error('❌ Failed to start backup system:', err));
  } else {
    console.log('ℹ️  Automatic backups disabled (set ENABLE_AUTO_BACKUP=true to enable)');
    console.log('ℹ️  For manual backups: npm run backup');
  }
});

// Export app for testing
export default app;
