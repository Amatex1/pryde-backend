/**
 * Email Verification Enforcement Middleware
 * Requires users to verify their email before accessing certain features
 * 
 * SECURITY: Prevents spam accounts and ensures valid contact information
 */

import User from '../models/User.js';
import logger from '../utils/logger.js';

/**
 * Middleware to require email verification for protected actions
 * Blocks unverified users from creating content or interacting
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export default async function requireEmailVerification(req, res, next) {
  try {
    // req.userId is set by auth middleware
    if (!req.userId) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Get user from database
    const user = await User.findById(req.userId).select('emailVerified email username');

    if (!user) {
      return res.status(404).json({ 
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check if email is verified
    if (!user.emailVerified) {
      logger.warn(`Blocked unverified user from protected action: ${user.username} (${user.email})`);
      
      return res.status(403).json({
        message: 'Please verify your email address to access this feature',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
        action: 'resend_verification'
      });
    }

    // Email is verified, continue
    next();
  } catch (error) {
    logger.error('requireEmailVerification error:', error);
    res.status(500).json({ 
      message: 'Server error',
      code: 'SERVER_ERROR'
    });
  }
}

/**
 * Soft email verification check
 * Allows action but warns user if email is not verified
 * Useful for non-critical features
 */
export const warnEmailVerification = async (req, res, next) => {
  try {
    if (!req.userId) {
      return next();
    }

    const user = await User.findById(req.userId).select('emailVerified email');

    if (user && !user.emailVerified) {
      // Add warning to response headers
      res.setHeader('X-Email-Verification-Warning', 'true');
      res.setHeader('X-Email-Address', user.email);
    }

    next();
  } catch (error) {
    logger.error('warnEmailVerification error:', error);
    // Don't block request on error, just continue
    next();
  }
};

