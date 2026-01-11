import dotenv from "dotenv";
dotenv.config();

// Build: 2025-12-27-v1 (GitHub Action deploy test)
// Only log in development
if (process.env.NODE_ENV === 'development') {
  console.log('🔐 JWT_SECRET from env:', process.env.JWT_SECRET ? 'Set' : 'Not set');
}

import express from "express";
import cors from "cors";
import http from "http";
import { initRedis } from "./utils/redisInit.js";
import logger from "./utils/logger.js";
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
import tagsRoutes, { initializeTags } from './routes/tags.js'; // Phase 2B: Tags deprecated - returns 410 Gone
import groupsRoutes from './routes/groups.js'; // Migration Phase: TAGS → GROUPS (Phase 0)
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
import adminPostsRoutes from './routes/adminPosts.js'; // PHASE C: Admin posting as system accounts
import adminEscalationRoutes from './routes/adminEscalation.js'; // Privileged Admin Escalation
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
import devVerifyRoutes from './routes/devVerify.js';
import adminDebugRoutes from './routes/adminDebug.js';
import adminHealthRoutes from './routes/adminHealth.js';
import stabilityControlsRoutes from './routes/stabilityControls.js';
import safeModeRoutes from './routes/safeMode.js';
import sessionInspectorRoutes from './routes/sessionInspector.js';
import bugReportsRoutes from './routes/bugReports.js';
import invitesRoutes from './routes/invites.js'; // Phase 7B: Invite-only growth
import profileSlugRoutes from './routes/profileSlug.js'; // Custom profile URLs
import badgesRoutes from './routes/badges.js'; // Badge system (added 2025-12-28)

// Life-Signal Features (added 2025-12-31)
import promptsRoutes from './routes/prompts.js'; // Feature 1: Reflection Prompts
import collectionsRoutes from './routes/collections.js'; // Feature 2: Personal Collections
import resonanceRoutes from './routes/resonance.js'; // Feature 3: Resonance Signals
import circlesRoutes from './routes/circles.js'; // Feature 4: Small Circles
import presenceRoutes from './routes/presence.js'; // Feature 5: Soft Presence States
import systemPromptsRoutes from './routes/systemPrompts.js'; // Rotating system prompt posts

// Mention notification service
import { notifyMentionsInLounge } from './services/mentionNotificationService.js';

// Import middleware
import auth from './middleware/auth.js';
import requireActiveUser from './middleware/requireActiveUser.js';
import { trackActivity, checkSessionTimeout } from './middleware/sessionTimeout.js';
import { setCsrfToken, enforceCsrf } from './middleware/csrf.js';
import { requestId, requestTimeout, apiSecurityHeaders, safeJsonResponse } from './middleware/hardening.js';

// Import global error handler (Phase 2 - Backend Failure Safety)
import { globalErrorHandler, sendError, HttpStatus } from './utils/errorHandler.js';

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
let redisClient = null;
(async () => { redisClient = await initRedis(config, logger); })();

// Track DB connection state for scheduler guards
let isDBConnected = false;

// Connect to DB and track state (skip auto-connect during tests to avoid double connections)
if (process.env.NODE_ENV !== 'test') {
  connectDB().then(() => {
    isDBConnected = true;
  }).catch((err) => {
    console.error('❌ Failed to connect to MongoDB:', err);
    process.exit(1);
  });
} else {
  // In tests, connection is handled by the test harness to avoid multiple openUri calls.
  if (mongoose.connection.readyState === 1) {
    isDBConnected = true;
  }
}

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
// SECURITY: Explicit allowlist only - no broad regex patterns
const allowedOrigins = [
  // Production domains
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
  'https://pryde-backend.onrender.com',
  'https://pryde-1flx.onrender.com',
  // Cloudflare Pages URLs (explicit only - no regex)
  'https://pryde-social.pages.dev',
  config.frontendURL,
  config.cloudflareURL
].filter(Boolean); // Remove any undefined values

// OPTIMIZATION: In-memory cache for online user details
const onlineUsersCache = new Map(); // userId -> { username, displayName, avatar, role, timestamp }
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Socket.IO setup with CORS and enhanced stability
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  // OPTIMIZED: Faster ping/pong for better real-time performance
  pingTimeout: 20000, // 20 seconds - faster detection of dead connections
  pingInterval: 10000, // 10 seconds - more frequent pings for better responsiveness
  upgradeTimeout: 10000, // 10 seconds - faster upgrade to WebSocket
  maxHttpBufferSize: 1e6, // 1MB - max message size
  transports: ['websocket', 'polling'], // Prefer WebSocket, fallback to polling
  allowUpgrades: true, // Allow transport upgrades
  perMessageDeflate: {
    threshold: 1024 // Only compress messages larger than 1KB
  },
  // OPTIMIZATION: Connection state recovery for better reliability
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true, // Skip auth middleware on recovery
  },
  httpCompression: {
    threshold: 1024 // Only compress HTTP responses larger than 1KB
  },
  // Connection state recovery (experimental but helpful)
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true // Skip auth middleware on recovery
  }
});

// Set Socket.IO instance for session routes
setSocketIO(io);

// Middleware - Enhanced CORS configuration
// SECURITY: Strict allowlist - no regex patterns for security
const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      callback(null, true);
      return;
    }

    // Check if origin is in allowed list (exact string match only)
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-XSRF-TOKEN',
    'x-auth-token',
    'X-CSRF-Token',
    'X-Frontend-Version',  // Version pinning for auto-refresh detection
    'X-Session-Id',        // Session tracking
    'X-Mutation-Id',       // Mutation tracking for consistency
    'X-Request-Id',        // Request tracing
    'Cache-Control'        // Allow cache-control header
  ],
  exposedHeaders: ['Authorization', 'X-CSRF-Token', 'X-Mutation-Id', 'X-Request-Id'], // Expose headers for cross-origin requests
  optionsSuccessStatus: 200
};

// Trust proxy - required for Render and rate limiting
app.set('trust proxy', 1);

// ============================================================================
// HARDENING MIDDLEWARE (Phase 2 - Backend Failure Safety)
// Must be early in the chain for request tracing
// ============================================================================
app.use(requestId);           // Add unique request ID to every request
app.use(requestTimeout(30000)); // 30 second timeout for all requests
app.use(apiSecurityHeaders);  // Add security headers for API responses
app.use(safeJsonResponse);    // Ensure safe JSON responses (no stack traces)

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
// CSP is ENFORCED in production, report-only in development
const isProd = config.nodeEnv === 'production';
app.use(helmet({
  contentSecurityPolicy: {
    reportOnly: !isProd, // Enforce in production, report-only in dev
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:"], // unsafe-* needed for React, blob: for Workbox
      scriptSrcElem: ["'self'", "'unsafe-inline'", "blob:"], // For Workbox service worker
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https://media.tenor.com", "https://*.tenor.com"],
      connectSrc: [
        "'self'",
        "https://pryde-backend.onrender.com",
        "wss://pryde-backend.onrender.com",
        "https://prydeapp.com",
        "https://tenor.googleapis.com",
        "https://media.tenor.com",
        "https://*.tenor.com"
      ],
      fontSrc: ["'self'", "data:"],
      mediaSrc: ["'self'", "blob:", "https://media.tenor.com", "https://*.tenor.com"],
      workerSrc: ["'self'", "blob:"], // For Workbox service worker
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
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

// Store online users
const onlineUsers = new Map(); // userId -> socketId

// Middleware to make socket.io available in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Session timeout middleware - tracks activity and enforces 30-minute idle timeout
// Applied globally to all routes (will only affect authenticated requests)
app.use(checkSessionTimeout);
app.use(trackActivity);

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
app.use('/api/tags', tagsRoutes); // Phase 2B: Tags deprecated - returns 410 Gone
app.use('/api/groups', groupsRoutes); // Migration Phase: TAGS → GROUPS (Phase 0 - Foundation)
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
app.use('/api/admin/posts', adminPostsRoutes); // PHASE C: Admin posting as system accounts
app.use('/api/admin/escalate', adminEscalationRoutes); // Privileged Admin Escalation
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
app.use('/api/dev', devVerifyRoutes); // Dev-only verification endpoints
app.use('/api/admin/debug', adminDebugRoutes); // Admin-only PWA debug tools
app.use('/api/admin/health', adminHealthRoutes); // Admin-only health & incident dashboard
app.use('/api/safe-mode', safeModeRoutes); // User-controlled Safe Mode
app.use('/api/session-inspector', sessionInspectorRoutes); // Session state inspector
app.use('/api/stability', stabilityControlsRoutes); // User-visible stability controls
app.use('/api/bug-reports', bugReportsRoutes); // Bug reporting with state snapshots
app.use('/api/invites', invitesRoutes); // Phase 7B: Invite-only growth
app.use('/api/profile-slug', profileSlugRoutes); // Custom profile URLs
app.use('/api/badges', badgesRoutes); // Badge system (added 2025-12-28)

// Life-Signal Features (added 2025-12-31)
app.use('/api/prompts', promptsRoutes); // Feature 1: Reflection Prompts
app.use('/api/collections', collectionsRoutes); // Feature 2: Personal Collections
app.use('/api/resonance', resonanceRoutes); // Feature 3: Resonance Signals
app.use('/api/circles', circlesRoutes); // Feature 4: Small Circles
app.use('/api/presence', presenceRoutes); // Feature 5: Soft Presence States
app.use('/api/system-prompts', systemPromptsRoutes); // Rotating system prompt posts (admin)

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

// Health check and status endpoints
app.get('/api/health', async (req, res) => {
  let redisStatus = 'unknown';
  try {
    if (typeof redisClient?.ping === 'function') {
      const ping = await redisClient.ping();
      redisStatus = ping || 'OK';
    }
  } catch (err) {
    redisStatus = 'error';
  }
  res.json({ status: 'ok', message: 'Pryde Social API is running', redis: redisStatus, timestamp: new Date().toISOString() });
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

// ============================================================================
// PHASE 2 - Backend Failure Safety: Global Error Handling
// ============================================================================

// 404 Handler - Catch all unmatched routes
app.use('/api/*', (req, res) => {
  sendError(res, HttpStatus.NOT_FOUND, `API endpoint not found: ${req.method} ${req.originalUrl}`);
});

// Global Error Handler - Must be LAST middleware
// Catches all uncaught errors and returns safe responses (no stack traces)
app.use(globalErrorHandler);

// ============================================================================
// End Error Handling
// ============================================================================

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
    const startTime = Date.now();
    try {
      // SECURITY: Sanitize message content to prevent XSS
      const sanitizedContent = data.content ? sanitizeHtml(data.content, {
        allowedTags: [],
        allowedAttributes: {}
      }).trim() : '';

      // Validate that either content or attachment is provided
      if (!sanitizedContent && !data.attachment && !data.voiceNote) {
        socket.emit('error', { message: 'Message must have content, attachment, or voice note' });
        return;
      }

      const messageData = {
        sender: userId,
        recipient: data.recipientId,
        content: sanitizedContent || ' ', // Use space if empty to satisfy required field
        attachment: data.attachment || null
      };

      // Only add voiceNote if it exists and has a URL
      if (data.voiceNote && data.voiceNote.url) {
        messageData.voiceNote = data.voiceNote;
      }

      const message = new Message(messageData);

      // ⏱️ PERFORMANCE: Save and populate in parallel where possible
      const saveStart = Date.now();
      await message.save();
      console.log(`⏱️ Message save took ${Date.now() - saveStart}ms`);

      // ⏱️ PERFORMANCE: Combine populate calls into one
      const populateStart = Date.now();
      await message.populate([
        { path: 'sender', select: 'username profilePhoto' },
        { path: 'recipient', select: 'username profilePhoto' }
      ]);
      console.log(`⏱️ Message populate took ${Date.now() - populateStart}ms`);

      // ⏱️ PERFORMANCE: Send socket events IMMEDIATELY (don't wait for DB operations)
      const emitStart = Date.now();

      // Send to recipient if online
      // UNIFIED: Using 'message:new' for all message events (Phase R unification)
      const recipientSocketId = onlineUsers.get(data.recipientId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('message:new', message);
      }

      // Also emit to recipient's user room for cross-device sync
      io.to(`user_${data.recipientId}`).emit('message:new', message);

      // Send back to sender as confirmation
      // UNIFIED: Using 'message:sent' for consistency
      socket.emit('message:sent', message);
      // Also emit to sender's user room for cross-device sync
      io.to(`user_${userId}`).emit('message:sent', message);
      console.log(`⏱️ Socket emit took ${Date.now() - emitStart}ms`);

      // ⏱️ PERFORMANCE: Run notification and push notification in background (don't block)
      const notificationStart = Date.now();

      // Get sender info for notifications
      const sender = await User.findById(userId).select('username displayName profilePhoto');
      const senderName = sender.displayName || sender.username;

      // Create and save notification
      const notification = new Notification({
        recipient: data.recipientId,
        sender: userId,
        type: 'message',
        message: `You have a new message`,
        link: `/messages`
      });

      // Save notification and manually set sender to avoid another populate query
      await notification.save();
      notification.sender = sender; // Manually set sender to avoid populate

      console.log(`⏱️ Notification creation took ${Date.now() - notificationStart}ms`);

      // ✅ Emit real-time notification using centralized emitter
      emitNotificationCreated(io, data.recipientId, notification);

      // Send push notification (fire and forget - don't await)
      const messagePreview = sanitizedContent.length > 50
        ? sanitizedContent.substring(0, 50) + '...'
        : (sanitizedContent || (data.attachment ? '📎 Attachment' : '🎤 Voice note'));

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

      console.log(`✅ Total message handling took ${Date.now() - startTime}ms`);
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
    const startTime = Date.now();
    try {
      console.log(`📡 User ${userId} requested online users list`);

      // OPTIMIZATION: Cache user role in socket object to avoid DB query
      if (!socket.userRole) {
        const user = await User.findById(userId).select('role').lean();
        if (!user) {
          console.error(`❌ User ${userId} not found in database`);
          socket.emit('error', { message: 'User not found' });
          return;
        }
        socket.userRole = user.role; // Cache for future requests
      }

      // Only allow super_admin, admin, and moderator to see online users list
      if (!['super_admin', 'admin', 'moderator'].includes(socket.userRole)) {
        console.warn(`⚠️ User ${userId} (${socket.userRole}) attempted to access online users list`);
        socket.emit('error', { message: 'Insufficient permissions' });
        return;
      }

      // Get all online user IDs from the global_chat room
      const globalChatRoom = io.sockets.adapter.rooms.get('global_chat');
      if (!globalChatRoom) {
        socket.emit('global_chat:online_users_list', { users: [] });
        return;
      }

      // Map socket IDs to user IDs - O(n) instead of O(n*m)
      const socketIdsSet = new Set(globalChatRoom);
      const onlineUserIds = [];
      for (const [uid, sid] of onlineUsers.entries()) {
        if (socketIdsSet.has(sid)) {
          onlineUserIds.push(uid);
        }
      }

      // OPTIMIZATION: Use cache to avoid DB queries
      const now = Date.now();
      const formattedUsers = [];
      const uncachedUserIds = [];

      // Check cache first
      for (const uid of onlineUserIds) {
        const cached = onlineUsersCache.get(uid);
        if (cached && (now - cached.timestamp) < CACHE_TTL) {
          // Use cached data
          formattedUsers.push({
            id: uid,
            username: cached.username,
            displayName: cached.displayName,
            avatar: cached.avatar,
            role: cached.role
          });
        } else {
          // Need to fetch from DB
          uncachedUserIds.push(uid);
        }
      }

      // Fetch uncached users from database
      if (uncachedUserIds.length > 0) {
        const dbQueryStart = Date.now();
        const onlineUsersDetails = await User.find({
          _id: { $in: uncachedUserIds }
        })
        .select('username displayName profilePhoto avatar role')
        .lean()
        .maxTimeMS(2000); // Timeout after 2 seconds
        console.log(`⏱️ Database query took ${Date.now() - dbQueryStart}ms for ${onlineUsersDetails.length} users`);

        // Add to cache and formatted list
        for (const u of onlineUsersDetails) {
          const userData = {
            username: u.username,
            displayName: u.displayName || u.username,
            avatar: u.profilePhoto || u.avatar,
            role: u.role,
            timestamp: now
          };

          // Update cache
          onlineUsersCache.set(u._id.toString(), userData);

          // Add to response
          formattedUsers.push({
            id: u._id,
            username: userData.username,
            displayName: userData.displayName,
            avatar: userData.avatar,
            role: userData.role
          });
        }
      }

      console.log(`📊 Cache stats: ${formattedUsers.length - uncachedUserIds.length} cached, ${uncachedUserIds.length} from DB`);

      socket.emit('global_chat:online_users_list', { users: formattedUsers });
      console.log(`✅ Sent online users list (${formattedUsers.length} users) - Total: ${Date.now() - startTime}ms`);

    } catch (error) {
      console.error('❌ Error fetching online users:', error);
      socket.emit('error', { message: 'Error fetching online users' });
    }
  });

  // Handle global chat typing indicator
  socket.on('global_chat:typing', (data) => {
    try {
      const { isTyping } = data;

      // Broadcast typing status to all users in global_chat room (except sender)
      socket.to('global_chat').emit('global_chat:user_typing', {
        userId,
        isTyping: isTyping || false
      });

      console.log(`📡 User ${userId} is ${isTyping ? 'typing' : 'stopped typing'} in global chat`);
    } catch (error) {
      console.error('❌ Error handling global chat typing:', error);
    }
  });

  // Handle global message send (OPTIMIZED with performance logging)
  socket.on('global_message:send', async (data) => {
    const startTime = Date.now();
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
      const userCheckStart = Date.now();
      const user = await User.findById(userId).select('username displayName profilePhoto avatar isBanned isSuspended');
      console.log(`⏱️ User check took ${Date.now() - userCheckStart}ms`);

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
      const importStart = Date.now();
      const GlobalMessage = (await import('./models/GlobalMessage.js')).default;
      console.log(`⏱️ Model import took ${Date.now() - importStart}ms`);

      // Create new global message
      const saveStart = Date.now();
      const newMessage = new GlobalMessage({
        senderId: userId,
        text: trimmedText || '',
        gifUrl: gifUrl || null,
        contentWarning: contentWarning?.trim() || null
      });

      await newMessage.save();
      console.log(`⏱️ Message save took ${Date.now() - saveStart}ms`);

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
      const broadcastStart = Date.now();
      io.to('global_chat').emit('global_message:new', messagePayload);
      console.log(`⏱️ Broadcast took ${Date.now() - broadcastStart}ms`);

      // Process @mention notifications (fire-and-forget, don't block response)
      if (trimmedText) {
        notifyMentionsInLounge({
          content: trimmedText,
          authorId: userId,
          author: { displayName: user.displayName, username: user.username },
          messageId: newMessage._id.toString()
        }).catch(err => console.error('[Mention] Lounge notification error:', err));
      }

      console.log(`✅ Global message sent by ${user.username} - Total: ${Date.now() - startTime}ms`);

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

// OPTIMIZATION: Periodic cache cleanup (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [userId, data] of onlineUsersCache.entries()) {
    if ((now - data.timestamp) > CACHE_TTL) {
      onlineUsersCache.delete(userId);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} stale entries from online users cache`);
  }
}, 10 * 60 * 1000); // Every 10 minutes

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
const PORT = process.env.NODE_ENV === 'test' ? 0 : config.port;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Base URL: ${config.baseURL}`);
  logger.info('Socket.IO server ready for real-time connections');

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

  // ========================================
  // TEMP MEDIA CLEANUP SCHEDULER
  // ========================================
  // Runs every hour to clean up orphaned uploads
  // This prevents storage leaks from abandoned media uploads
  //
  // GUARDS:
  // - Disabled in test environment (prevents flakiness)
  // - Cleanup function itself checks DB readiness (fail-safe)
  // - Never crashes the process (best-effort operation)
  //
  if (process.env.NODE_ENV === 'test') {
    console.log('[Cleanup] Disabled in test environment');
  } else {
    import('./scripts/cleanupTempMedia.js')
      .then(({ cleanupTempMedia }) => {
        // Run cleanup on startup (after 5 minutes to allow server to stabilize)
        // The cleanup function will check DB readiness before running
        setTimeout(() => {
          cleanupTempMedia()
            .then(result => {
              if (!result.skipped) {
                console.log('🧹 Initial temp media cleanup:', result);
              }
            })
            .catch(err => console.error('❌ Temp media cleanup failed:', err));
        }, 5 * 60 * 1000); // 5 minutes after startup

        // Run cleanup every hour
        // The cleanup function will check DB readiness before running
        setInterval(() => {
          cleanupTempMedia()
            .then(result => {
              if (!result.skipped && result.deleted > 0) {
                console.log('🧹 Hourly temp media cleanup:', result);
              }
            })
            .catch(err => console.error('❌ Temp media cleanup failed:', err));
        }, 60 * 60 * 1000); // Every hour

        console.log('🧹 Temp media cleanup scheduled (hourly, cleans uploads older than 60 min)');
      })
      .catch(err => console.error('❌ Failed to start temp media cleanup:', err));
  }

  // ========================================
  // SYSTEM PROMPT SCHEDULER
  // ========================================
  // Posts one rotating prompt per day from pryde_prompts account
  // Creates a gentle "heartbeat" for the platform
  //
  // GUARDS:
  // - Disabled in test environment
  // - Seeds system account and prompts on first run
  // - Idempotent (safe to restart)
  //
  if (process.env.NODE_ENV === 'test') {
    console.log('[SystemPrompts] Disabled in test environment');
  } else {
    import('./scripts/seedSystemPrompts.js')
      .then(({ seedSystemPrompts }) => {
        // Seed system account and prompts (idempotent)
        seedSystemPrompts()
          .then(result => {
            console.log('[SystemPrompts] ✅ System setup complete:', result);
          })
          .catch(err => console.error('[SystemPrompts] ❌ Seed failed:', err));
      })
      .catch(err => console.error('[SystemPrompts] ❌ Failed to import seed script:', err));

    import('./scripts/systemPromptScheduler.js')
      .then(({ startScheduler }) => {
        startScheduler();
        console.log('[SystemPrompts] 🕐 Scheduler started (posts daily at 10:00 AM UTC)');
      })
      .catch(err => console.error('[SystemPrompts] ❌ Failed to start scheduler:', err));

    // ========================================
    // REFLECTION PROMPTS (Private per-user)
    // ========================================
    // Seeds private reflection prompts shown to users
    // Different from System Prompts (which are public feed posts)
    import('./scripts/seedReflectionPrompts.js')
      .then(({ seedReflectionPrompts }) => {
        seedReflectionPrompts()
          .then(result => {
            console.log('[ReflectionPrompts] ✅ Seed complete:', result);
          })
          .catch(err => console.error('[ReflectionPrompts] ❌ Seed failed:', err));
      })
      .catch(err => console.error('[ReflectionPrompts] ❌ Failed to import seed script:', err));

    // ========================================
    // FOUNDING MEMBER BADGE
    // ========================================
    // Assigns badge to first 100 members (idempotent)
    // Excludes system accounts, test accounts, and Pryde bots
    import('./scripts/seedFoundingMemberBadge.js')
      .then(({ seedFoundingMemberBadge }) => {
        seedFoundingMemberBadge()
          .then(result => {
            if (result.assigned > 0) {
              console.log(`[FoundingMember] 🌟 Assigned badge to ${result.assigned} new founding members`);
            } else {
              console.log('[FoundingMember] ✅ All founding members already have badge');
            }
          })
          .catch(err => console.error('[FoundingMember] ❌ Seed failed:', err));
      })
      .catch(err => console.error('[FoundingMember] ❌ Failed to import seed script:', err));
  }
});

// Export app for testing
export default app;
