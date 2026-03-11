import dotenv from "dotenv";
import logger, { pinoLogger } from "./utils/logger.js";
dotenv.config();

// Sentry must be initialised early, before other app code
import { initSentry, Sentry } from "./utils/sentryInit.js";
initSentry();

// Build: 2025-12-27-v1 (GitHub Action deploy test)
// Only log in development
if (process.env.NODE_ENV === 'development') {
  logger.info('JWT secret environment status', {
    configured: Boolean(process.env.JWT_SECRET)
  });
}

import express from "express";
import cors from "cors";
import http from "http";
import { initRedis } from "./utils/redisInit.js";
import pinoHttp from 'pino-http';
import mongoose from "mongoose";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import cookieParser from "cookie-parser";
import compression from "compression";
import cron from 'node-cron';
import { initializeSocket } from './socket/index.js';


// OpenAPI documentation
import { setupSwagger } from './swagger.js';

// BullMQ job queues
import { initQueues, startWorkers, shutdownQueues } from './queues/index.js';
import { startDailyBackupService } from './scripts/dailyBackup.js';
import { cleanupTempMedia } from './scripts/cleanupTempMedia.js';
import { seedSystemPrompts } from './scripts/seedSystemPrompts.js';
import { startScheduler as startSystemPromptScheduler } from './scripts/systemPromptScheduler.js';
import { startBadgeSweepScheduler } from './scripts/dailyBadgeSweep.js';
import { seedReflectionPrompts } from './scripts/seedReflectionPrompts.js';
import cleanupOldData from './scripts/cleanupOldData.js';
import { seedFoundingMemberBadge } from './scripts/seedFoundingMemberBadge.js';
import { runPermanentDeletionJob } from '../scripts/permanentDeletionJob.js';
import { sendWeeklyDigestsToAllUsers as runWeeklyDigestJob } from './jobs/weeklyDigestJob.js';
import { queueInactivityEmails as runInactivityEmailJob } from './jobs/inactivityEmailJob.js';
import { runMemberSpotlight } from './jobs/memberSpotlightJob.js';
import { runWeeklyTheme } from './jobs/weeklyThemesJob.js';
import { runConversationResurfaceJob } from './jobs/conversationResurfaceJob.js';

// Routes — all mounts are handled by routeRegistry.js
import { mountRoutes } from './routeRegistry.js';
// sessionsRoutes is imported separately because setSocketIO must be called with io
import sessionsRoutes, { setSocketIO } from './routes/sessions.js';

// Import middleware
import auth from './middleware/auth.js';
import requireActiveUser from './middleware/requireActiveUser.js';
const restrictionMiddleware = [auth, requireActiveUser];
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

// Import feed cache for Redis feed caching
import { initFeedCache } from './utils/redisCache.js';
// Import R2 storage
import { initR2 } from './utils/r2Storage.js';

import { connectDB } from './utils/dbManager.js';
import config from "./config/config.js";
const isTest = process.env.NODE_ENV === 'test';
let redisClient = null;
(async () => {
  redisClient = await initRedis(config, logger);
  // Expose Redis client on app for geoService and other utilities
  if (redisClient) app.set('redis', redisClient);
  
  // Initialize feed cache (uses same Redis connection)
  const feedCacheReady = await initFeedCache();
  if (feedCacheReady) {
    logger.info('Feed cache initialized with Redis');
  } else {
    logger.warn('Feed cache initialized with in-memory fallback');
  }
  
  // Initialize R2 storage (Cloudflare R2 for media)
  const r2Ready = await initR2();
  if (r2Ready) {
    logger.info('R2 storage initialized (Cloudflare R2)');
  } else {
    logger.warn('R2 not configured - using GridFS fallback for media storage');
  }

  // Initialize BullMQ job queues (requires Redis)
  if (!isTest) {
    const queuesReady = initQueues();
    if (queuesReady) {
      startWorkers();
      logger.info('BullMQ job queues and workers started');
    } else {
      logger.warn('BullMQ queues disabled (Redis not configured)');
    }
  }
})();

// Connect to DB (skip auto-connect during tests to avoid double connections)
if (!isTest) {
  connectDB(config.mongoURI).then(() => {
    logger.info('Database connection ready for operations');
  }).catch((err) => {
    logger.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });

  // Add connection event listeners
  mongoose.connection.on('disconnected', () => {
    logger.error('MongoDB disconnected unexpectedly');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB error', err);
  });
}

// Initialize server startup (async to wait for DB connection)
const initializeServer = async () => {
  // Wait for database connection before starting server (prevents race condition)
  if (!isTest) {
    logger.info('Waiting for database connection');
    let lastReadyState = null;

    // Wait for mongoose connection to be fully ready (readyState === 1)
    while (mongoose.connection.readyState !== 1) {
      if (mongoose.connection.readyState !== lastReadyState) {
        lastReadyState = mongoose.connection.readyState;
        logger.info('Database connection not ready yet', {
          readyState: mongoose.connection.readyState,
          waitingFor: 1
        });
      }
      await new Promise(resolve => setTimeout(resolve, 500)); // Check every 500ms
    }

    logger.info('Database connected and ready for operations, starting server');
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
    logger.warn('CORS blocked origin', { origin });
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
// STRUCTURED REQUEST LOGGING (Pino HTTP)
// ============================================================================
app.use(pinoHttp({
  logger: pinoLogger,
  // Skip health checks to reduce log noise
  autoLogging: { ignore: (req) => req.url === '/api/health' },
  customProps: (req) => ({ requestId: req.headers['x-request-id'] }),
}));

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
const cspScriptSrc = isProd
  ? ["'self'", 'blob:']
  : ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'blob:'];
const cspScriptSrcElem = isProd
  ? ["'self'", 'blob:']
  : ["'self'", "'unsafe-inline'", 'blob:'];

// Build dynamic CSP connect-src based on configured API domain
const getConnectSrc = () => {
  const sources = [
    "'self'",
    "blob:", // Allow blob URLs for file uploads
    // Backend API endpoints - always include all known backend domains
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
  ];

  // Add custom API domain if configured (e.g., api.prydeapp.com)
  if (config.apiDomain) {
    const cleanDomain = config.apiDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    sources.push(`https://${cleanDomain}`);
    sources.push(`wss://${cleanDomain}`);
    sources.push(`ws://${cleanDomain}`);
  }

  return sources;
};

app.use(helmet({
  contentSecurityPolicy: {
    reportOnly: !isProd, // Enforce in production, report-only in dev
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: cspScriptSrc,
      scriptSrcElem: cspScriptSrcElem,
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https://media.tenor.com", "https://*.tenor.com"],
      connectSrc: getConnectSrc(),
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
      logger.debug('Mongo sanitize adjusted request key', {
        key,
        path: req?.path,
        method: req?.method
      });
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
    logger.warn('Database not ready - rejecting request', {
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

// Mount all routes via route registry
mountRoutes(app, { restrictionMiddleware, requireDatabaseReady });

// API documentation (Swagger UI — dev only unless ENABLE_SWAGGER_DOCS=true)
setupSwagger(app);

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

// Catch all non-API routes after route registration.
app.use((req, res) => {
  logger.warn(`404 Not Found: ${req.method} ${req.path}`);
  sendError(res, HttpStatus.NOT_FOUND, 'Route not found', {
    path: req.path,
    method: req.method
  });
});

// Sentry Express error handler — must run before the app's final error middleware.
if (process.env.SENTRY_DSN && process.env.NODE_ENV === 'production') {
  Sentry.setupExpressErrorHandler(app);
}

// Global Error Handler - Must be LAST error middleware
// Catches all uncaught errors and returns safe responses (no stack traces)
app.use(globalErrorHandler);

// ============================================================================
// End Error Handling
// ============================================================================

// Start server (skip on Vercel and in tests)
const PORT = config.port;
const isVercel = process.env.VERCEL === '1';
const shouldStartHttpServer = !isTest && !isVercel;

if (shouldStartHttpServer) {
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
      try {
        startDailyBackupService();
        logger.info('Daily backup system started (3:00 AM UTC, 30-day retention)');
      } catch (err) {
        logger.error('Failed to start backup system', err);
      }
    } else {
      logger.info('Automatic backups disabled (set ENABLE_AUTO_BACKUP=true to enable)');
      logger.info('Manual backups available via npm run backup');
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
      logger.info('[Cleanup] Disabled in test environment');
    } else {
      try {
        // Run cleanup on startup (after 5 minutes to allow server to stabilize)
        // The cleanup function will check DB readiness before running
        setTimeout(() => {
          cleanupTempMedia()
            .then(result => {
              if (!result.skipped) {
                logger.info('Initial temp media cleanup complete', result);
              }
            })
            .catch(err => logger.error('Temp media cleanup failed', err));
        }, 5 * 60 * 1000); // 5 minutes after startup

        // Run cleanup every hour
        // The cleanup function will check DB readiness before running
        setInterval(() => {
          cleanupTempMedia()
            .then(result => {
              if (!result.skipped && result.deleted > 0) {
                logger.info('Hourly temp media cleanup complete', result);
              }
            })
            .catch(err => logger.error('Temp media cleanup failed', err));
        }, 60 * 60 * 1000); // Every hour

        logger.info('Temp media cleanup scheduled (hourly, cleans uploads older than 60 min)');
      } catch (err) {
        logger.error('Failed to start temp media cleanup', err);
      }
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
      logger.info('[SystemPrompts] Disabled in test environment');
    } else {
      // Seed system account and prompts (idempotent)
      seedSystemPrompts()
        .then(result => {
          logger.info('[SystemPrompts] System setup complete', result);
        })
        .catch(err => logger.error('[SystemPrompts] Seed failed', err));

      try {
        startSystemPromptScheduler();
        logger.info('[SystemPrompts] Scheduler started (posts daily at 10:00 AM UTC)');
      } catch (err) {
        logger.error('[SystemPrompts] Failed to start scheduler', err);
      }

      // ========================================
      // BADGE SWEEP SCHEDULER (Daily)
      // ========================================
      // 🔧 BADGE CHURN FIX: Runs daily to revoke badges with grace period
      // Prevents badge flapping for active_this_month and similar badges
      try {
        startBadgeSweepScheduler();
        logger.info('[BadgeSweep] Scheduler started (runs daily at 04:00 UTC)');
      } catch (err) {
        logger.error('[BadgeSweep] Failed to start scheduler', err);
      }

      // ========================================
      // REFLECTION PROMPTS (Private per-user)
      // ========================================
      // Seeds private reflection prompts shown to users
      // Different from System Prompts (which are public feed posts)
      seedReflectionPrompts()
        .then(result => {
          logger.info('[ReflectionPrompts] Seed complete', result);
        })
        .catch(err => logger.error('[ReflectionPrompts] Seed failed', err));

      // ========================================
      // DAILY DATA CLEANUP (Account Deletion, Notifications, etc.)
      // ========================================
      // Runs daily cleanup of old data including permanent account deletion
      // This ensures deleted accounts are permanently removed after 30 days
      // Schedule daily cleanup at 02:00 UTC
      cron.schedule('0 2 * * *', async () => {
        logger.info('[Cleanup] Running daily data cleanup');
        try {
          await cleanupOldData();
          logger.info('[Cleanup] Daily cleanup completed successfully');
        } catch (err) {
          logger.error('[Cleanup] Daily cleanup failed', err);
        }
      });
      logger.info('[Cleanup] Daily cleanup job scheduled (runs at 02:00 UTC)');

      // ========================================
      // PERMANENT ACCOUNT DELETION JOB
      // Runs daily at 03:30 UTC — purges accounts whose 30-day recovery window has expired
      // ========================================
      cron.schedule('30 3 * * *', async () => {
        logger.info('[PermanentDeletion] 🕐 Running permanent account deletion job...');
        try {
          const result = await runPermanentDeletionJob();
          logger.info(`[PermanentDeletion] ✅ Complete: ${result.deleted} accounts permanently deleted`);
        } catch (err) {
          logger.error('[PermanentDeletion] ❌ Job failed:', err);
        }
      });
      logger.info('[PermanentDeletion] 🕐 Scheduled (runs daily at 03:30 UTC)');

      // ========================================
      // FOUNDING MEMBER BADGE
      // ========================================
      // Assigns badge to first 100 members (idempotent)
      // Excludes system accounts, test accounts, and Pryde bots
      seedFoundingMemberBadge()
        .then(result => {
          if (result.assigned > 0) {
            logger.info(`[FoundingMember] Assigned badge to ${result.assigned} new founding members`);
          } else {
            logger.info('[FoundingMember] All founding members already have badge');
          }
        })
        .catch(err => logger.error('[FoundingMember] Seed failed', err));

      // ========================================
      // WEEKLY DIGEST EMAIL JOB
      // ========================================
      // Sends weekly digest emails to users every Sunday at 10:00 AM UTC
      cron.schedule('0 10 * * 0', async () => {
        logger.info('[WeeklyDigest] 🕐 Starting weekly digest job...');
        try {
          const result = await runWeeklyDigestJob();
          logger.info(`[WeeklyDigest] ✅ Complete: ${result.sent} emails sent`);
        } catch (err) {
          logger.error('[WeeklyDigest] ❌ Job failed:', err);
        }
      });
      logger.info('[WeeklyDigest] 🕐 Scheduled (runs every Sunday at 10:00 AM UTC)');

      // ========================================
      // INACTIVITY EMAIL JOB ("Pryde misses you")
      // ========================================
      // Sends "Pryde misses you" emails to users after 14 days of inactivity
      cron.schedule('0 9 * * *', async () => {
        logger.info('[InactivityEmail] 🕐 Starting inactivity email job...');
        try {
          const result = await runInactivityEmailJob();
          logger.info(`[InactivityEmail] ✅ Complete: ${(result.sent ?? result.queued) ?? 0} emails queued`);
        } catch (err) {
          logger.error('[InactivityEmail] ❌ Job failed:', err);
        }
      });
      logger.info('[InactivityEmail] 🕐 Scheduled (runs daily at 09:00 UTC)');

      // ========================================
      // MEMBER SPOTLIGHT JOB
      // ========================================
      // Features a community member weekly
      cron.schedule('0 11 * * 1', async () => {
        logger.info('[MemberSpotlight] 🕐 Starting member spotlight job...');
        try {
          const result = await runMemberSpotlight();
          if (result) {
            logger.info(`[MemberSpotlight] ✅ New spotlight: ${result.user?.username}`);
          } else {
            logger.info('[MemberSpotlight] ⏭️ No eligible member for spotlight');
          }
        } catch (err) {
          logger.error('[MemberSpotlight] ❌ Job failed:', err);
        }
      });
      logger.info('[MemberSpotlight] 🕐 Scheduled (runs every Monday at 11:00 UTC)');

      // ========================================
      // WEEKLY THEMES JOB
      // ========================================
      // Posts weekly themed discussion prompts
      cron.schedule('0 10 * * 1', async () => {
        logger.info('[WeeklyThemes] 🕐 Starting weekly themes job...');
        try {
          const result = await runWeeklyTheme();
          logger.info(`[WeeklyThemes] ✅ Complete: ${result.success ? result.theme?.title : 'already posted this week'}`);
        } catch (err) {
          logger.error('[WeeklyThemes] ❌ Job failed:', err);
        }
      });
      logger.info('[WeeklyThemes] 🕐 Scheduled (runs every Monday at 10:00 UTC)');

      // ========================================
      // CONVERSATION RESURFACE JOB
      // ========================================
      // Finds and resurfacing old conversations that are getting attention
      cron.schedule('*/30 * * * *', async () => {
        // Run every 30 minutes
        logger.info('[ConversationResurface] 🕐 Checking for resurfacing conversations...');
        try {
          const result = await runConversationResurfaceJob();
          if (result.resurfaced?.length > 0) {
            logger.info(`[ConversationResurface] ✅ ${result.resurfaced.length} conversations marked for resurfacing`);
          }
        } catch (err) {
          logger.error('[ConversationResurface] ❌ Job failed:', err);
        }
      });
      logger.info('[ConversationResurface] 🕐 Scheduled (runs every 30 minutes)');
    }
    });
  }).catch((err) => {
    logger.error('Failed to initialize server', err);
    process.exit(1);
  });
} else if (isTest) {
  logger.info('Running in test mode - skipping server.listen() and scheduled tasks');
} else {
  logger.info('Running on Vercel serverless - skipping server.listen()');
  logger.info('Socket.IO and scheduled tasks disabled on serverless');
}

// Catch unhandled promise rejections so they don't silently crash a worker
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason);
});

// Graceful shutdown — close queues before exiting
async function gracefulShutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);
  await shutdownQueues().catch(() => {});
  process.exit(0);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Export app for testing and Vercel
export { app, server };
export default app;
