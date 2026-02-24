import rateLimit from 'express-rate-limit';

// Window: 1 hour
const WINDOW_MS = 60 * 60 * 1000;

// Per-IP limiter: 5 requests per hour
export const deletionIPLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 5, // 5 requests per IP per hour
  message: {
    message: 'Too many deletion attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Normalize IPv6-mapped IPv4 addresses (e.g. ::ffff:1.2.3.4 → 1.2.3.4)
    return (req.ip || 'unknown').replace(/^::ffff:/, '');
  },
  skip: (req) => {
    // Skip rate limiting for development/testing
    return process.env.NODE_ENV === 'development';
  }
});

// Per-user limiter: 3 requests per hour
export const deletionUserLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 3, // 3 requests per user per hour
  message: {
    message: 'Too many deletion attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.userId || req.user?._id?.toString();
  },
  skip: (req) => {
    // Skip rate limiting for development/testing
    return process.env.NODE_ENV === 'development';
  }
});
