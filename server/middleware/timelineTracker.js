/**
 * Timeline Tracker Middleware
 * 
 * Automatically tracks API requests and responses in session timeline
 */

import { trackEvent, EventType } from '../utils/sessionTimeline.js';

/**
 * Extract session ID from request
 * Priority: X-Session-Id header > cookie > generate new
 */
function getSessionId(req) {
  // Try header first
  if (req.headers['x-session-id']) {
    return req.headers['x-session-id'];
  }
  
  // Try cookie
  if (req.cookies?.sessionId) {
    return req.cookies.sessionId;
  }
  
  // Try user ID (if authenticated)
  if (req.userId) {
    return `user-${req.userId}`;
  }
  
  // Generate temporary session ID
  return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Timeline tracker middleware
 */
export default function timelineTracker(req, res, next) {
  const sessionId = getSessionId(req);
  const startTime = Date.now();
  
  // Store session ID in request for later use
  req.sessionId = sessionId;
  
  // Track API request
  trackEvent(sessionId, EventType.API_FAILURE, {
    method: req.method,
    path: req.path,
    query: req.query,
    timestamp: startTime
  });
  
  // Intercept response to track failures
  const originalSend = res.send;
  const originalJson = res.json;
  
  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    // Track API failures (4xx, 5xx)
    if (res.statusCode >= 400) {
      trackEvent(sessionId, EventType.API_FAILURE, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        error: data
      });
    }
    
    return originalSend.call(this, data);
  };
  
  res.json = function(data) {
    const duration = Date.now() - startTime;
    
    // Track API failures (4xx, 5xx)
    if (res.statusCode >= 400) {
      trackEvent(sessionId, EventType.API_FAILURE, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        error: data
      });
    }
    
    return originalJson.call(this, data);
  };
  
  next();
}

/**
 * Track auth state change
 */
export function trackAuthStateChange(sessionId, state, data = {}) {
  trackEvent(sessionId, EventType.AUTH_STATE_CHANGE, {
    state,
    ...data
  });
}

/**
 * Track token refresh
 */
export function trackTokenRefresh(sessionId, success, data = {}) {
  trackEvent(sessionId, EventType.TOKEN_REFRESH, {
    success,
    ...data
  });
}

/**
 * Track mutation
 */
export function trackMutationEvent(sessionId, mutationType, entity, data = {}) {
  trackEvent(sessionId, EventType.MUTATION, {
    mutationType,
    entity,
    ...data
  });
}

/**
 * Track error
 */
export function trackError(sessionId, error, context = {}) {
  trackEvent(sessionId, EventType.ERROR, {
    message: error.message,
    stack: error.stack,
    ...context
  });
}

/**
 * Track socket event
 */
export function trackSocketEvent(sessionId, eventName, data = {}) {
  trackEvent(sessionId, EventType.SOCKET_EVENT, {
    eventName,
    ...data
  });
}

