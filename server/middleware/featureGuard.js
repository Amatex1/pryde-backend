/**
 * Feature Guard Middleware
 * Instruments feature access attempts and logs blocked attempts
 * Helps identify why users can't access certain features
 */

import { canPost, canMessage, canUploadMedia, canReply, canChat } from '../utils/featureCapability.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

// In-memory log of blocked attempts (last 1000 entries)
const blockedAttempts = [];
const MAX_LOG_SIZE = 1000;

/**
 * Log a blocked feature attempt
 */
const logBlockedAttempt = (userId, username, feature, reasons) => {
  const entry = {
    userId,
    username,
    feature,
    reasons,
    timestamp: new Date().toISOString()
  };

  blockedAttempts.unshift(entry);

  // Keep only last 1000 entries
  if (blockedAttempts.length > MAX_LOG_SIZE) {
    blockedAttempts.pop();
  }

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    logger.warn(`🚫 Feature blocked: ${username} tried to ${feature}`, {
      reasons: reasons.join(', ')
    });
  }
};

/**
 * Get blocked attempts log
 */
export const getBlockedAttempts = () => {
  return blockedAttempts;
};

/**
 * Clear blocked attempts log
 */
export const clearBlockedAttempts = () => {
  blockedAttempts.length = 0;
};

/**
 * Middleware to check if user can create posts
 */
export const requireCanPost = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const check = canPost(user);

    if (!check.allowed) {
      logBlockedAttempt(user._id, user.username, 'post', check.reasons);
      return res.status(403).json({
        message: 'You cannot create posts at this time',
        reasons: check.reasons,
        code: 'FEATURE_BLOCKED'
      });
    }

    next();
  } catch (error) {
    logger.error('requireCanPost error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Middleware to check if user can send messages
 */
export const requireCanMessage = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const check = canMessage(user);

    if (!check.allowed) {
      logBlockedAttempt(user._id, user.username, 'message', check.reasons);
      return res.status(403).json({
        message: 'You cannot send messages at this time',
        reasons: check.reasons,
        code: 'FEATURE_BLOCKED'
      });
    }

    next();
  } catch (error) {
    logger.error('requireCanMessage error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Middleware to check if user can upload media
 */
export const requireCanUploadMedia = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const check = canUploadMedia(user);

    if (!check.allowed) {
      logBlockedAttempt(user._id, user.username, 'upload', check.reasons);
      return res.status(403).json({
        message: 'You cannot upload media at this time',
        reasons: check.reasons,
        code: 'FEATURE_BLOCKED'
      });
    }

    next();
  } catch (error) {
    logger.error('requireCanUploadMedia error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Middleware to check if user can reply to posts/comments
 */
export const requireCanReply = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const check = canReply(user);

    if (!check.allowed) {
      logBlockedAttempt(user._id, user.username, 'reply', check.reasons);
      return res.status(403).json({
        message: 'You cannot reply at this time',
        reasons: check.reasons,
        code: 'FEATURE_BLOCKED'
      });
    }

    next();
  } catch (error) {
    logger.error('requireCanReply error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

