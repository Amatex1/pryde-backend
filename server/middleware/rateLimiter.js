import rateLimit from 'express-rate-limit';
import logger from '../utils/logger.js';

/**
 * Helper function to log rate limit violations
 * @param {Object} req - Express request object
 * @param {string} limitType - Type of rate limit (e.g., 'global', 'login', 'post')
 */
const logRateLimitViolation = (req, limitType) => {
  const ip = req.ip || req.connection.remoteAddress;
  const userId = req.userId || req.user?._id || 'anonymous';
  const path = req.path;
  const method = req.method;

  logger.warn(`🚨 Rate limit exceeded - ${limitType}`, {
    ip,
    userId,
    path,
    method,
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString()
  });
};

// Global rate limiter - applies to all requests
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logRateLimitViolation(req, 'global');
    res.status(429).json({
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Login rate limiter - stricter to prevent brute force attacks
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login attempts per windowMs
  skipSuccessfulRequests: false, // Count successful requests
  message: 'Too many login attempts from this IP, please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logRateLimitViolation(req, 'login');
    res.status(429).json({
      message: 'Too many login attempts. Please try again after 15 minutes.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Signup rate limiter - prevent spam account creation
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 signups per hour
  message: 'Too many accounts created from this IP, please try again after an hour.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logRateLimitViolation(req, 'signup');
    res.status(429).json({
      message: 'Too many accounts created from this IP. Please try again after an hour.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Post creation rate limiter
export const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each IP to 50 posts per hour
  message: 'You are posting too frequently. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logRateLimitViolation(req, 'post');
    res.status(429).json({
      message: 'You are posting too frequently. Please slow down.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Message rate limiter
export const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 messages per minute
  message: 'You are sending messages too quickly. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logRateLimitViolation(req, 'message');
    res.status(429).json({
      message: 'You are sending messages too quickly. Please slow down.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Comment rate limiter (also applies to replies)
export const commentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Limit each IP to 20 comments per minute
  message: 'You are commenting too frequently. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logRateLimitViolation(req, 'comment');
    res.status(429).json({
      message: 'You are commenting too frequently. Please slow down.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Friend request rate limiter
export const friendRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // Limit each IP to 30 friend requests per hour
  message: 'You are sending friend requests too frequently. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logRateLimitViolation(req, 'friend_request');
    res.status(429).json({
      message: 'You are sending friend requests too frequently. Please slow down.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Password reset rate limiter
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 password reset requests per hour
  message: 'Too many password reset requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logRateLimitViolation(req, 'password_reset');
    res.status(429).json({
      message: 'Too many password reset requests. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// File upload rate limiter
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // Limit each IP to 100 uploads per hour
  message: 'Too many file uploads. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logRateLimitViolation(req, 'upload');
    res.status(429).json({
      message: 'Too many file uploads. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Search rate limiter
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 searches per minute
  message: 'Too many search requests. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logRateLimitViolation(req, 'search');
    res.status(429).json({
      message: 'Too many search requests. Please slow down.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Reaction rate limiter - prevent spam reactions (likes, emoji reactions)
export const reactionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 reactions per minute (1 per second)
  message: 'You are reacting too frequently. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logRateLimitViolation(req, 'reaction');
    res.status(429).json({
      message: 'You are reacting too frequently. Please slow down.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Report rate limiter - prevent spam reports
export const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 reports per hour
  message: 'You are submitting reports too frequently. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logRateLimitViolation(req, 'report');
    res.status(429).json({
      message: 'You are submitting reports too frequently. Please slow down.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

