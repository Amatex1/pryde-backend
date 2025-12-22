import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import logger from '../utils/logger.js';
import config from '../config/config.js';

// Redis connection for rate limiting
const redisClient = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  enableOfflineQueue: false
});

// Advanced rate limiting configuration
const createAdvancedLimiter = (options) => {
  const { 
    windowMs = 15 * 60 * 1000, // 15 minutes default
    max = 100, // 100 requests per window default
    message = 'Too many requests, please try again later.',
    keyGenerator = (req) => req.ip,
    skipFailedRequests = false,
    standardHeaders = true,
    legacyHeaders = false,
    handler = (req, res, next, options) => {
      res.status(429).json({
        error: 'Too Many Requests',
        message: options.message,
        retryAfter: Math.ceil(options.windowMs / 1000 / 60) // minutes
      });
    }
  } = options;

  return rateLimit({
    windowMs,
    max,
    message,
    keyGenerator,
    skipFailedRequests,
    standardHeaders,
    legacyHeaders,
    handler,
    store: new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix: `rate_limit:${options.prefix || 'default'}:`,
    }),
    // Dynamic scaling based on user role
    skip: (req, res) => {
      // Exempt admin and system users from rate limiting
      const userRole = req.user?.role;
      const exemptRoles = ['admin', 'super_admin', 'system'];
      return exemptRoles.includes(userRole);
    },
    // Logging for rate limit events
    onLimitReached: (req, res, options) => {
      logger.warn('Rate limit reached', {
        ip: req.ip,
        path: req.path,
        method: req.method
      });
    }
  });
};

// Specialized rate limiters for different endpoints
export const globalLimiter = createAdvancedLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per 15 minutes
  prefix: 'global'
});

export const loginLimiter = createAdvancedLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per 15 minutes
  prefix: 'login',
  message: 'Too many login attempts, please try again later.'
});

export const signupLimiter = createAdvancedLimiter({
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
    await redisClient.quit();
    console.log('Redis client disconnected');
  } catch (error) {
    console.error('Error closing Redis connection:', error);
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
