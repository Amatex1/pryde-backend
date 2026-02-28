import dotenv from "dotenv";
dotenv.config();

// Sentry must be initialised early, before other app code
import { initSentry, Sentry } from "./utils/sentryInit.js";
initSentry();

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
import mongoose from "mongoose";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import cookieParser from "cookie-parser";
import compression from "compression";
import schedule from "node-schedule";
import { initializeSocket } from './socket/index.js';

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
import adminModerationV2Routes from './routes/adminModerationV2.js'; // PRYDE_MODERATION_ADMIN_V2
import restrictionMiddleware from './middleware/restrictionMiddleware.js'; // GOVERNANCE V1
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
import testNotificationsRoutes from './routes/testNotifications.js'; // Test notification endpoint

// Import middleware
import auth from './middleware/auth.js';
import requireActiveUser from './middleware/requireActiveUser.js';
// DISABLED 2026-01-17: In-memory session timeout was causing logout on server restart
// import { trackActivity, checkSessionTimeout } from './middleware/sessionTimeout.js';
import { setCsrfToken, enforceCsrf } from './middleware/csrf.js';
import { requestId, requestTimeout, apiSecurityHeaders, safeJsonResponse } from './middleware/hardening.js';
import { detectAttacks } from './middleware/attackDetection.js';

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

import { connectDB } from './utils/dbManager.js';
import config from "./config/config.js";
let redisClient = null;
(async () => { redisClient = await initRedis(config, logger); })();

// Connect to DB (skip auto-connect during tests to avoid double connections)
if (process.env.NODE_ENV !== 'test') {
  connectDB(config.mongoURI).then(() => {
    console.log('✅ Database connection ready for operations');
  }).catch((err) => {
    console.error('❌ Failed to connect to MongoDB:', err);
    process.exit(1);
  });

  // Add connection event listeners
  mongoose.connection.on('disconnected', () => {
    console.error('🚨 MongoDB disconnected unexpectedly!');
  });

  mongoose.connection.on('error', (err) => {
    console.error('🚨 MongoDB error:', err);
  });
}

// Initialize server startup (async to wait for DB connection)
const initializeServer = async () => {
  // Wait for database connection before starting server (prevents race condition)
  if (process.env.NODE_ENV !== 'test') {
    console.log('⏳ Waiting for database connection...');

    // Wait for mongoose connection to be fully ready (readyState === 1)
    while (mongoose.connection.readyState !== 1) {
      console.log(`⏳ DB connection state: ${mongoose.connection.readyState} (waiting for 1)`);
      await new Promise(resolve => setTimeout(resolve, 500)); // Check every 500ms
    }

    console.log('✅ Database connected and ready for operations, starting server...');
  }
};

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
  'https://api.prydeapp.com',
  // Vercel deployment URLs
  'https://pryde-frontend.vercel.app',
  'https://pryde-frontend-2m8ympy3-mats-projects-d8392976.vercel.app',
  'https://pryde-frontend-j9j6871wz-mats-projects-d8392976.vercel.app',
  'https://pryde-frontend-git-main-mats-projects-d8392976.vercel.app',
  // Development
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:9000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  // Render URLs
  'https://pryde-frontend.onrender.com',
  'https://pryde-backend.onrender.com',
  'https://pryde-1flx.onrender.com',
  config.frontendURL
].filter(Boolean); // Remove any undefined values

// Initialise Socket.IO (auth middleware, event handlers, per-event rate limiting)
// redisClient is passed as a getter so the socket module always sees the live reference
// even though Redis connects asynchronously after this line runs.
const { io, onlineUsers: socketOnlineUsers } = initializeSocket(server, allowedOrigins, () => redisClient);
const onlineUsers = socketOnlineUsers; // expose for route middleware below

// Set Socket.IO instance for session routes
setSocketIO(io);

// Make io and onlineUsers accessible in route handlers via req.app.get(...)
app.set('io', io);
app.set('onlineUsers', onlineUsers);

// Middleware - Enhanced CORS configuration
// SECURITY: Strict allowlist with limited pattern matching for Vercel preview URLs
const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      callback(null, true);
      return;
    }

    // Check if origin is in allowed list (exact string match)
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    // Allow Vercel preview URLs (pryde-frontend-*.vercel.app)
    // SECURITY: Strict pattern - only allows pryde-frontend subdomains on vercel.app
    if (origin.match(/^https:\/\/pryde-frontend-[a-z0-9-]+\.vercel\.app$/)) {
      callback(null, true);
      return;
    }

    // Block all other origins
    console.log(`CORS blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
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
        "blob:", // Allow blob URLs for file uploads
        // Backend API endpoints
        "https://pryde-backend.onrender.com",
        "wss://pryde-backend.onrender.com",
        "ws://pryde-backend.onrender.com",
        "https://api.prydeapp.com",
        "wss://api.prydeapp.com",
        // Frontend domains
        "https://prydeapp.com",
        "https://www.prydeapp.com",
        "https://prydesocial.com",
        "https://www.prydesocial.com",
        // External APIs
        "https://tenor.googleapis.com",
        "https://media.tenor.com",
        "https://*.tenor.com",
        "https://hcaptcha.com",
        "https://*.hcaptcha.com",
        // Development
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:9000",
        "ws://localhost:9000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:9000",
        // Vercel preview URLs
        "https://pryde-frontend-*.vercel.app"
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

// Handle preflight requests explicitly for all routes
app.options('*', cors(corsOptions));

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

// 🔒 SECURITY: Attack detection middleware - logs suspicious patterns
app.use(detectAttacks);

// CSRF Protection - Set token on all requests
// This generates and sends CSRF token in cookie for client to use
app.use(setCsrfToken);

// CSRF Protection - Verify token on state-changing requests (POST, PUT, PATCH, DELETE)
// This provides defense-in-depth even with JWT authentication
app.use(enforceCsrf);

// Middleware to make socket.io available in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Database readiness middleware - ensures DB is connected before processing requests
// This prevents "Client must be connected before running operations" errors
const requireDatabaseReady = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    console.error('❌ Database not ready - rejecting request:', {
      path: req.path,
      method: req.method,
      readyState: mongoose.connection.readyState
    });
    return res.status(503).json({
      message: 'Service temporarily unavailable - database connection initializing',
      error: 'DATABASE_NOT_READY'
    });
  }
  next();
};

// Session timeout middleware - DISABLED
// 🔥 REMOVED 2026-01-17: The in-memory sessionActivity Map was causing users to be
// logged out whenever the server restarts (Render free tier restarts daily).
// JWT-based refresh tokens (30-day expiry) already handle session persistence properly.
// The 30-minute idle timeout was redundant and harmful for user experience.
//
// To re-enable with proper persistence, store session activity in MongoDB or Redis.
// app.use(checkSessionTimeout);
// app.use(trackActivity);

// Routes with specific rate limiters
app.use('/api/auth', requireDatabaseReady, authRoutes);
app.use('/api/refresh', refreshRoutes);
app.use('/api/users', restrictionMiddleware, usersRoutes); // GOVERNANCE V1
// PHASE 1 REFACTOR: Friends routes kept for backward compatibility
app.use('/api/friends', friendsRoutes);
app.use('/api/follow', followRoutes);
app.use('/api/posts', restrictionMiddleware, postsRoutes); // GOVERNANCE V1
app.use('/api/feed', feedRoutes); // PHASE 2: Global and Following feeds
app.use('/api/journals', journalsRoutes); // PHASE 3: Journaling
app.use('/api/longform', longformRoutes); // PHASE 3: Longform posts
app.use('/api/tags', tagsRoutes); // Phase 2B: Tags deprecated - returns 410 Gone
app.use('/api/groups', groupsRoutes); // Migration Phase: TAGS → GROUPS (Phase 0 - Foundation)
app.use('/api/photo-essays', photoEssaysRoutes); // PHASE 5: Photo essays
app.use('/api/upload', restrictionMiddleware, uploadRoutes); // GOVERNANCE V1 (profile-photo, cover-photo)
app.use('/api/notifications', notificationsRoutes);
app.use('/api/test-notifications', testNotificationsRoutes);
app.use('/api/messages', restrictionMiddleware, messagesRoutes); // GOVERNANCE V1
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
app.use('/api', restrictionMiddleware, commentsRoutes); // Comment routes + GOVERNANCE V1
app.use('/api/reactions', restrictionMiddleware, reactionsRoutes); // Universal reaction system + GOVERNANCE V1
app.use('/api/backup', backupRoutes); // Backup download routes
app.use('/api/audit', auditRoutes); // Admin audit routes
app.use('/api/version', versionRoutes); // Version endpoint for update detection
// PART 13: Dev routes only available in development — never in production
if (process.env.NODE_ENV === 'development') {
  app.use('/api/dev', devVerifyRoutes);
}
app.use('/api/admin/debug', adminDebugRoutes); // Admin-only PWA debug tools
app.use('/api/admin/health', adminHealthRoutes); // Admin-only health & incident dashboard
app.use('/api/admin/moderation-v2', adminModerationV2Routes); // PRYDE_MODERATION_ADMIN_V2
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

// Cookie debug endpoint (public - for testing cookie clearing)
app.get('/api/debug/cookies', (req, res) => {
  const cookies = req.cookies || {};
  const hasRefreshToken = !!cookies.refreshToken;
  const refreshTokenPrefix = hasRefreshToken ? cookies.refreshToken.substring(0, 20) + '...' : null;

  res.json({
    message: 'Cookie debug info',
    timestamp: new Date().toISOString(),
    cookies: {
      hasRefreshToken,
      refreshTokenPrefix,
      allCookieNames: Object.keys(cookies),
      cookieCount: Object.keys(cookies).length
    },
    headers: {
      origin: req.headers.origin,
      referer: req.headers.referer,
      cookie: req.headers.cookie ? 'present' : 'absent'
    }
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


// Sentry Express error handler — must be before 404 and other error handlers
if (process.env.SENTRY_DSN && process.env.NODE_ENV === 'production') {
  Sentry.setupExpressErrorHandler(app);
}

// 404 handler - must be BEFORE error handler
app.use((req, res, next) => {
  // Log 404s for debugging (helps identify missing routes)
  logger.warn(`404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json({
    message: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Error handling middleware - must be LAST
app.use((err, req, res, next) => {
  // Log error with context
  logger.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    hasUser: !!req.user,
    hasToken: !!req.headers.authorization,
    hasCookies: !!req.headers.cookie
  });

  // Don't expose internal errors in production
  const message = config.nodeEnv === 'production'
    ? 'Internal server error'
    : err.message || 'Something went wrong!';

  res.status(err.status || 500).json({
    message,
    ...(config.nodeEnv === 'development' && { stack: err.stack })
  });
});

// Start server (skip on Vercel - serverless functions don't need listen())
const PORT = process.env.NODE_ENV === 'test' ? 0 : config.port;
const isVercel = process.env.VERCEL === '1';

if (!isVercel) {
  // Initialize server and wait for database connection
  initializeServer().then(() => {
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Base URL: ${config.baseURL}`);
      logger.info('Socket.IO server ready for real-time connections');

      // Production hardening verification logs
      if (redisClient) {
        logger.info('✅ Redis rate limiting active');
      } else {
        logger.info('⚠️ In-memory rate limiting (Redis not configured)');
      }
      logger.info('✅ Security headers enabled');

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
      // BADGE SWEEP SCHEDULER (Daily)
      // ========================================
      // 🔧 BADGE CHURN FIX: Runs daily to revoke badges with grace period
      // Prevents badge flapping for active_this_month and similar badges
      import('./scripts/dailyBadgeSweep.js')
        .then(({ startBadgeSweepScheduler }) => {
          startBadgeSweepScheduler();
          console.log('[BadgeSweep] 🕐 Scheduler started (runs daily at 04:00 UTC)');
        })
        .catch(err => console.error('[BadgeSweep] ❌ Failed to start scheduler:', err));

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
      // DAILY DATA CLEANUP (Account Deletion, Notifications, etc.)
      // ========================================
      // Runs daily cleanup of old data including permanent account deletion
      // This ensures deleted accounts are permanently removed after 30 days
      import('./scripts/cleanupOldData.js')
        .then(() => {
          // Schedule daily cleanup at 02:00 UTC
          const cleanupJob = schedule.scheduleJob('0 2 * * *', async () => {
            console.log('[Cleanup] 🕐 Running daily data cleanup...');
            try {
              // Import and run the cleanup script
              const cleanupModule = await import('./scripts/cleanupOldData.js');
              await cleanupModule.default();
              console.log('[Cleanup] ✅ Daily cleanup completed successfully');
            } catch (err) {
              console.error('[Cleanup] ❌ Daily cleanup failed:', err);
            }
          });
          console.log('[Cleanup] 🕐 Daily cleanup job scheduled (runs at 02:00 UTC)');
        })
        .catch(err => console.error('[Cleanup] ❌ Failed to schedule daily cleanup:', err));

      // ========================================
      // PERMANENT ACCOUNT DELETION JOB
      // Runs daily at 03:30 UTC — purges accounts whose 30-day recovery window has expired
      // ========================================
      import('./scripts/permanentDeletionJob.js')
        .then(({ runPermanentDeletionJob }) => {
          schedule.scheduleJob('30 3 * * *', async () => {
            logger.info('[PermanentDeletion] 🕐 Running permanent account deletion job...');
            try {
              const result = await runPermanentDeletionJob();
              logger.info(`[PermanentDeletion] ✅ Complete: ${result.deleted} accounts permanently deleted`);
            } catch (err) {
              logger.error('[PermanentDeletion] ❌ Job failed:', err);
            }
          });
          logger.info('[PermanentDeletion] 🕐 Scheduled (runs daily at 03:30 UTC)');
        })
        .catch(err => logger.error('[PermanentDeletion] ❌ Failed to schedule job:', err));

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
              }            })
            .catch(err => console.error('[FoundingMember] ❌ Seed failed:', err));
        })
        .catch(err => console.error('[FoundingMember] ❌ Failed to import seed script:', err));
    }
    });
  }).catch((err) => {
    console.error('❌ Failed to initialize server:', err);
    process.exit(1);
  });
} else {
  logger.info('Running on Vercel serverless - skipping server.listen()');
  logger.info('Socket.IO and scheduled tasks disabled on serverless');
}

// Catch unhandled promise rejections so they don't silently crash a worker
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason);
});

// Export app for testing and Vercel
export default app;
