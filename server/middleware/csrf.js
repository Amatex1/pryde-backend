import crypto from 'crypto';
import config from '../config/config.js';

/**
 * CSRF Protection Middleware
 * Uses double-submit cookie pattern with SameSite cookies
 * This is a modern alternative to the deprecated csurf package
 */

// Store for CSRF tokens (in production, use Redis or similar)
const csrfTokens = new Map();

// Clean up old tokens every hour
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of csrfTokens.entries()) {
    if (now - data.timestamp > 3600000) { // 1 hour
      csrfTokens.delete(token);
    }
  }
}, 3600000);

/**
 * Generate a CSRF token
 */
export const generateCsrfToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Middleware to generate and set CSRF token
 * Use this on routes that render forms or need CSRF protection
 */
export const setCsrfToken = (req, res, next) => {
  // Check if client already has a valid CSRF token
  const existingToken = req.cookies?.['XSRF-TOKEN'];

  // If token exists and is still valid, reuse it
  if (existingToken && csrfTokens.has(existingToken)) {
    const tokenData = csrfTokens.get(existingToken);

    // Check if token is not expired (1 hour)
    if (Date.now() - tokenData.timestamp <= 3600000) {
      // Token is still valid, reuse it
      req.csrfToken = existingToken;
      res.locals.csrfToken = existingToken;
      return next();
    } else {
      // Token expired, remove it
      csrfTokens.delete(existingToken);
    }
  }

  // Generate new token only if needed
  const token = generateCsrfToken();

  // Store token with timestamp
  csrfTokens.set(token, {
    timestamp: Date.now(),
    userId: req.userId || null
  });

  // Set cookie with SameSite attribute
  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false, // Allow JavaScript to read for sending in headers
    secure: config.nodeEnv === 'production', // HTTPS only in production
    sameSite: config.nodeEnv === 'production' ? 'none' : 'lax', // 'none' for cross-origin in production
    path: '/', // Available on all routes
    maxAge: 3600000 // 1 hour
  });

  // Also make it available in response
  req.csrfToken = token;
  res.locals.csrfToken = token;

  next();
};

/**
 * Middleware to verify CSRF token
 * Use this on state-changing routes (POST, PUT, DELETE, PATCH)
 */
export const verifyCsrfToken = (req, res, next) => {
  // Skip CSRF check for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Get token from header or body
  const token = req.headers['x-xsrf-token'] || 
                req.headers['x-csrf-token'] || 
                req.body._csrf ||
                req.query._csrf;

  // Get token from cookie
  const cookieToken = req.cookies?.['XSRF-TOKEN'];

  // In development, log CSRF attempts
  if (config.nodeEnv === 'development') {
    console.log('🛡️ CSRF Check:', {
      method: req.method,
      path: req.path,
      hasToken: !!token,
      hasCookie: !!cookieToken,
      tokensMatch: token === cookieToken
    });
  }

  // Verify token exists
  if (!token || !cookieToken) {
    return res.status(403).json({ 
      message: 'CSRF token missing',
      error: 'Invalid CSRF token'
    });
  }

  // Verify tokens match (double-submit cookie pattern)
  if (token !== cookieToken) {
    return res.status(403).json({ 
      message: 'CSRF token mismatch',
      error: 'Invalid CSRF token'
    });
  }

  // Verify token exists in our store
  const tokenData = csrfTokens.get(token);
  if (!tokenData) {
    return res.status(403).json({ 
      message: 'CSRF token expired or invalid',
      error: 'Invalid CSRF token'
    });
  }

  // Verify token is not too old (1 hour)
  if (Date.now() - tokenData.timestamp > 3600000) {
    csrfTokens.delete(token);
    return res.status(403).json({ 
      message: 'CSRF token expired',
      error: 'Invalid CSRF token'
    });
  }

  // Token is valid
  next();
};

/**
 * Middleware to enforce CSRF for all state-changing requests
 * Even with JWT authentication, CSRF protection adds defense in depth
 * This prevents attacks where an attacker tricks a user's browser into making requests
 */
export const enforceCsrf = (req, res, next) => {
  // Skip CSRF check for GET, HEAD, OPTIONS (safe methods)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for authentication endpoints (login, register, refresh)
  // These endpoints don't have a CSRF token yet since the user hasn't made any requests
  const authPaths = [
    '/api/auth/login',
    '/api/auth/signup',
    '/api/auth/register',
    '/api/auth/refresh',
    '/api/refresh',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/verify-email',
    '/api/auth/verify-2fa-login'
  ];

  if (authPaths.includes(req.path)) {
    return next();
  }

  // For all other methods (POST, PUT, PATCH, DELETE), verify CSRF token
  verifyCsrfToken(req, res, next);
};

/**
 * Middleware to skip CSRF for API routes with JWT authentication (DEPRECATED)
 * Use enforceCsrf instead for better security
 * JWT tokens provide sufficient protection for API endpoints
 */
export const skipCsrfForApi = (req, res, next) => {
  // If request has valid JWT token, skip CSRF check
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return next();
  }

  // Otherwise, verify CSRF
  verifyCsrfToken(req, res, next);
};

export default {
  generateCsrfToken,
  setCsrfToken,
  verifyCsrfToken,
  enforceCsrf,
  skipCsrfForApi
};

