/**
 * Session Timeout Middleware
 * 
 * Tracks user activity and enforces 30-minute idle timeout
 * Updates lastActivity timestamp on each authenticated request
 */

import logger from '../utils/logger.js';

// Session timeout duration (30 minutes in milliseconds)
const SESSION_TIMEOUT = 30 * 60 * 1000;

// In-memory session activity tracker
// In production, this should be stored in Redis or database
const sessionActivity = new Map();

/**
 * Update session activity timestamp
 */
export function updateSessionActivity(userId) {
  if (!userId) return;
  
  sessionActivity.set(userId.toString(), {
    lastActivity: Date.now(),
    userId: userId.toString()
  });
}

/**
 * Check if session has timed out
 */
export function isSessionTimedOut(userId) {
  if (!userId) return true;
  
  const session = sessionActivity.get(userId.toString());
  
  if (!session) {
    // No session found - consider it timed out
    return true;
  }
  
  const timeSinceActivity = Date.now() - session.lastActivity;
  return timeSinceActivity > SESSION_TIMEOUT;
}

/**
 * Get time remaining before session timeout (in milliseconds)
 */
export function getTimeUntilTimeout(userId) {
  if (!userId) return 0;
  
  const session = sessionActivity.get(userId.toString());
  
  if (!session) return 0;
  
  const timeSinceActivity = Date.now() - session.lastActivity;
  const timeRemaining = SESSION_TIMEOUT - timeSinceActivity;
  
  return Math.max(0, timeRemaining);
}

/**
 * Clear session activity (on logout)
 */
export function clearSessionActivity(userId) {
  if (!userId) return;
  
  sessionActivity.delete(userId.toString());
  logger.debug(`Session activity cleared for user: ${userId}`);
}

/**
 * Middleware to track session activity
 * Should be applied AFTER auth middleware
 */
export const trackActivity = (req, res, next) => {
  // Only track activity for authenticated requests
  if (req.userId) {
    updateSessionActivity(req.userId);
  }
  
  next();
};

/**
 * Middleware to check session timeout
 * Should be applied AFTER auth middleware
 */
export const checkSessionTimeout = (req, res, next) => {
  // Only check timeout for authenticated requests
  if (!req.userId) {
    return next();
  }
  
  if (isSessionTimedOut(req.userId)) {
    logger.info(`Session timed out for user: ${req.userId}`);
    
    // Clear the session
    clearSessionActivity(req.userId);
    
    return res.status(401).json({
      error: 'session_timeout',
      message: 'Your session has expired due to inactivity. Please log in again.',
      reason: 'idle_timeout'
    });
  }
  
  // Update activity timestamp
  updateSessionActivity(req.userId);
  
  next();
};

/**
 * Get session info for a user
 */
export function getSessionInfo(userId) {
  if (!userId) return null;
  
  const session = sessionActivity.get(userId.toString());
  
  if (!session) return null;
  
  return {
    userId: session.userId,
    lastActivity: session.lastActivity,
    timeUntilTimeout: getTimeUntilTimeout(userId),
    isTimedOut: isSessionTimedOut(userId)
  };
}

// Export timeout duration for frontend
export const SESSION_TIMEOUT_MS = SESSION_TIMEOUT;

export default {
  trackActivity,
  checkSessionTimeout,
  updateSessionActivity,
  isSessionTimedOut,
  getTimeUntilTimeout,
  clearSessionActivity,
  getSessionInfo,
  SESSION_TIMEOUT_MS
};

