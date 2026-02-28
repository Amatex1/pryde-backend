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
// Supports both REDIS_URL (Render/Upstash connection string) and REDIS_HOST/REDIS_PORT (explicit)
const initializeRedis = async () => {
  try {
    const redisUrl = process.env.REDIS_URL;
    // Only treat REDIS_URL as usable if it's an actual connection string
    // Render may set REDIS_URL to a service ID (e.g. "red-abc123") rather than a real URL
    const isValidRedisUrl = redisUrl && /^rediss?:\/\//i.test(redisUrl);
    const hasHostPort = config.redis && config.redis.host && config.redis.port;

    if (!isValidRedisUrl && !hasHostPort) {
      logger.warn('Redis not configured - using in-memory rate limiting (not recommended for production)');
      return;
    }

    const Redis = (await import('ioredis')).default;
    RedisStore = (await import('rate-limit-redis')).default;

    if (isValidRedisUrl) {
      redisClient = new Redis(redisUrl, { enableOfflineQueue: false, lazyConnect: true });
    } else {
      const redisOptions = {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        enableOfflineQueue: false,
        lazyConnect: true
      };
      if (config.redis.tls) redisOptions.tls = config.redis.tls;
      redisClient = new Redis(redisOptions);
    }

    await redisClient.connect();
    console.log('✅ Redis connected for rate limiting');
    logger.info('✅ Redis connected for rate limiting');
    redisClient.on('error', (err) => {
      logger.error('Redis error:', err);
    });
  } catch (error) {
    logger.error('Failed to initialize Redis, falling back to in-memory rate limiting:', error);
    redisClient = null;
  }
};

// Initialize Redis and wait for it to be ready
// Using top-level await (ES modules support this)
await initializeRedis();

// PART 7: In production, Redis is required for distributed rate limiting.
// In-memory fallback is NOT safe for multi-instance deployments.
if (process.env.NODE_ENV === 'production' && !redisClient) {
  console.error('FATAL: Redis is required in production for distributed rate limiting. Set REDIS_URL and ensure Redis is reachable. Exiting.');
  process.exit(1);
}

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

  // PART 9: Admins get 5× threshold instead of full exemption
  const adminRoles = ['admin', 'super_admin', 'system'];
  const adminMax = (req) => {
    if (adminRoles.includes(req.user?.role)) return max * 5;
    return max;
  };

  const limiterConfig = {
    windowMs,
    max: adminMax,
    message,
    skipFailedRequests,
    standardHeaders,
    legacyHeaders,
    handler: customHandler,
    // Skip only in test environment — admins are subject to limits (at 5× threshold above)
    skip: (req) => process.env.NODE_ENV === 'test',
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
  max: 800, // 800 requests per 15 minutes
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

// Event creation/update limiter
export const eventLimiter = createAdvancedLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 event creations per hour
  prefix: 'event',
  message: 'Too many event submissions, please try again later.'
});

// Generic write limiter for miscellaneous POST/PUT/DELETE operations
export const writeLimiter = createAdvancedLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // 60 write operations per 15 minutes
  prefix: 'write'
});

// PART 5: Missing rate limiters
export const resendVerificationLimiter = createAdvancedLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 resend attempts per hour
  prefix: 'resend_verification',
  message: 'Too many verification email requests, please try again later.'
});

export const checkUsernameLimiter = createAdvancedLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 username checks per 15 minutes
  prefix: 'check_username',
  message: 'Too many username checks, please slow down.'
});

export const refreshLimiter = createAdvancedLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 refresh attempts per 15 minutes
  prefix: 'refresh',
  message: 'Too many token refresh attempts, please try again later.'
});

export const resetPasswordConfirmLimiter = createAdvancedLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 password reset confirmations per hour
  prefix: 'reset_password_confirm',
  message: 'Too many password reset attempts, please try again later.'
});

export const commentWriteLimiter = createAdvancedLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20, // 20 comment writes per 10 minutes
  prefix: 'comment_write',
  message: 'You are commenting too quickly, please slow down.'
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
  reportLimiter,
  eventLimiter,
  writeLimiter,
  resendVerificationLimiter,
  checkUsernameLimiter,
  refreshLimiter,
  resetPasswordConfirmLimiter,
  commentWriteLimiter
};