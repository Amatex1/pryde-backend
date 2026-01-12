import rateLimit from 'express-rate-limit';
import logger from '../utils/logger.js';
import config from '../config/config.js';

// Note: NODE_ENV-aware behavior
// - In normal operation (development/production), all limiters are fully
//   enforced and must NOT be weakened.
// - In test environment (NODE_ENV === 'test'), we selectively bypass
//   signup rate limiting so auth/signup tests can exercise validation
//   paths (e.g. under-18 rejection) deterministically without hitting
//   429 Too Many Requests from rapid, same-IP signups.
const isTestEnv = process.env.NODE_ENV === 'test';

// Optional Redis support for distributed rate limiting
let redisClient = null;
let RedisStore = null;

// Only initialize Redis if configuration is available
const initializeRedis = async () => {
  try {
    if (config.redis && config.redis.host && config.redis.port) {
      const Redis = (await import('ioredis')).default;
      RedisStore = (await import('rate-limit-redis')).default;

      const redisOptions = {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        enableOfflineQueue: false,
        lazyConnect: true
      };

      // Add TLS support if configured (required for Upstash and other cloud Redis providers)
      if (config.redis.tls) {
        redisOptions.tls = config.redis.tls;
      }

      redisClient = new Redis(redisOptions);
      // Test connection
      await redisClient.connect();
      logger.info('✅ Redis connected for rate limiting');
      // Handle Redis errors gracefully
      redisClient.on('error', (err) => {
        logger.error('Redis error:', err);
      });
    } else {
      logger.warn('Redis not configured - using in-memory rate limiting (not recommended for production)');
    }
  } catch (error) {
    logger.error('Failed to initialize Redis, falling back to in-memory rate limiting:', error);
    redisClient = null;
  }
};

// Initialize Redis and wait for it to be ready
// Using top-level await (ES modules support this)
await initializeRedis();

// Advanced rate limiting configuration
// Updated for express-rate-limit v7 compatibility
const createAdvancedLimiter = (options) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes default
    max = 100, // 100 requests per window default
    message = 'Too many requests, please try again later.',
    skipFailedRequests = false,
    standardHeaders = true,
    legacyHeaders = false,
  } = options;

  // Custom handler that logs rate limit hits (replaces deprecated onLimitReached)
  const customHandler = (req, res, _next, opts) => {
    // Log rate limit reached (moved from deprecated onLimitReached)
    logger.warn('Rate limit reached', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      prefix: options.prefix || 'default'
    });
    res.status(429).json({
      error: 'Too Many Requests',
      message: opts.message,
      retryAfter: Math.ceil(opts.windowMs / 1000 / 60) // minutes
    });
  };

  const limiterConfig = {
    windowMs,
    max,
    message,
    skipFailedRequests,
    standardHeaders,
    legacyHeaders,
    handler: customHandler,
    // Dynamic scaling based on user role and environment
    skip: (req) => {
      // Skip rate limiting in test environment
      if (process.env.NODE_ENV === 'test') {
        return true;
      }
      // Exempt admin and system users from rate limiting
      const userRole = req.user?.role;
      const exemptRoles = ['admin', 'super_admin', 'system'];
      return exemptRoles.includes(userRole);
    },
    // Disable validation warnings for keyGenerator (we're handling it correctly)
    validate: {
      xForwardedForHeader: false,
      default: true
    }
  };

  // Use Redis store if available, otherwise use default in-memory store
  if (redisClient && RedisStore) {
    limiterConfig.store = new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix: `rate_limit:${options.prefix || 'default'}:`,
    });
  } else {
    // In-memory store warning (only log once per limiter type)
    if (!createAdvancedLimiter._warnedPrefixes) {
      createAdvancedLimiter._warnedPrefixes = new Set();
    }
    const prefix = options.prefix || 'default';
    if (!createAdvancedLimiter._warnedPrefixes.has(prefix)) {
      logger.warn(`Using in-memory rate limiting for ${prefix} - not suitable for multi-instance deployments`);
      createAdvancedLimiter._warnedPrefixes.add(prefix);
    }
  }

  return rateLimit(limiterConfig);
};

// Specialized rate limiters for different endpoints
export const globalLimiter = createAdvancedLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // 2000 requests per 15 minutes (increased for testing)
  prefix: 'global'
});

export const loginLimiter = createAdvancedLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per 15 minutes
  prefix: 'login',
  message: 'Too many login attempts, please try again later.'
});

// Signup limiter: special-case for tests
// -------------------------------------------------------------
// In test environment we completely bypass signup rate limiting so that
// validation logic (age checks, duplicate emails, etc.) can be exercised
// with many rapid requests from the same IP without flakiness.
//
// IMPORTANT:
// - This behavior is ONLY enabled when NODE_ENV === 'test'.
// - Development and production behavior are unchanged and still use the
//   strict signup rate limit below.

export const signupLimiter = isTestEnv
  ? (req, _res, next) => next()
  : createAdvancedLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 signup attempts per hour
    prefix: 'signup',
    message: 'Too many signup attempts, please try again later.'
  });

export const postLimiter = createAdvancedLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 posts per 15 minutes
  prefix: 'post'
});

export const messageLimiter = createAdvancedLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 messages per 15 minutes
  prefix: 'message'
});

export const commentLimiter = createAdvancedLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 comments per 15 minutes
  prefix: 'comment'
});

export const friendRequestLimiter = createAdvancedLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 friend requests per hour
  prefix: 'friend_request'
});

export const passwordResetLimiter = createAdvancedLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 password reset attempts per hour
  prefix: 'password_reset',
  message: 'Too many password reset attempts, please try again later.'
});

export const uploadLimiter = createAdvancedLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  prefix: 'upload'
});

export const searchLimiter = createAdvancedLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 searches per 15 minutes
  prefix: 'search'
});

export const reactionLimiter = createAdvancedLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 reactions per 15 minutes
  prefix: 'reaction'
});

export const reportLimiter = createAdvancedLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 reports per hour
  prefix: 'report',
  message: 'Too many reports submitted, please try again later.'
});

// Cleanup Redis connection on process exit
process.on('SIGINT', async () => {
  try {
    if (redisClient) {
      await redisClient.quit();
      logger.info('Redis client disconnected');
    }
  } catch (error) {
    logger.error('Error closing Redis connection:', error);
  }
});

export default {
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
};