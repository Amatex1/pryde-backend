/**
 * Session Middleware
 * Handles session management and token validation
 */

import cookie from 'cookie';

/**
 * Session validation middleware
 * @param {Object} options - Configuration options
 * @returns {Function} Express middleware
 */
export const sessionMiddleware = (options = {}) => {
  const {
    sessionTimeout = 3600000, // 1 hour default
    cookieName = 'sessionId'
  } = options;

  return (req, res, next) => {
    // Parse session cookie if present
    const cookies = cookie.parse(req.headers.cookie || '');
    const sessionId = cookies[cookieName];

    if (sessionId) {
      req.sessionId = sessionId;
    }

    next();
  };
};

/**
 * Validate session expiration
 * @param {Date|number} sessionExpiresAt - Session expiration timestamp
 * @returns {boolean} True if session is valid
 */
export const isSessionValid = (sessionExpiresAt) => {
  if (!sessionExpiresAt) return false;
  const expiresAt = new Date(sessionExpiresAt).getTime();
  return expiresAt > Date.now();
};

/**
 * Create session cookie options
 * @param {Object} options - Cookie options
 * @returns {Object} Cookie configuration
 */
export const createSessionCookie = (options = {}) => {
  const {
    secure = true,
    httpOnly = true,
    sameSite = 'strict',
    maxAge = 3600000
  } = options;

  return {
    secure,
    httpOnly,
    sameSite,
    maxAge,
    path: '/'
  };
};

export default {
  sessionMiddleware,
  isSessionValid,
  createSessionCookie
};
