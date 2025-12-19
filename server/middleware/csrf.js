import crypto from 'crypto';
import config from '../config/config.js';

/**
 * CSRF Protection Middleware
 * Uses double-submit cookie pattern with SameSite cookies
 * This is a modern alternative to the deprecated csurf package
 *
 * CRITICAL: Tokens are NOT stored server-side
 * Security relies on comparing cookie value to header value (double-submit pattern)
 */

/**
 * Generate a CSRF token
 */
export const generateCsrfToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Middleware to generate and set CSRF token
 * CRITICAL: Reuse existing token to prevent 403 errors on subsequent requests
 */
export const setCsrfToken = (req, res, next) => {
  // CRITICAL: Reuse existing XSRF-TOKEN cookie if present
  let token = req.cookies['XSRF-TOKEN'];

  // Only generate a new token if one does not already exist
  if (!token) {
    token = generateCsrfToken();

    const cookieOptions = {
      httpOnly: false, // Allow JavaScript to read for sending in headers
      secure: config.nodeEnv === 'production', // HTTPS only in production
      sameSite: config.nodeEnv === 'production' ? 'none' : 'lax', // 'none' for cross-origin in production
      path: '/', // Available on all routes
      maxAge: 3600000 // 1 hour
    };

    // Set cookie with SameSite attribute
    res.cookie('XSRF-TOKEN', token, cookieOptions);

    if (config.nodeEnv === 'development') {
      console.log('🍪 Generated new CSRF token:', token.substring(0, 10) + '...');
    }
  } else {
    if (config.nodeEnv === 'development') {
      console.log('✅ Reusing existing CSRF token:', token.substring(0, 10) + '...');
    }
  }

  // IMPORTANT: Always send token in response header for cross-origin requests
  // Cross-origin cookies with sameSite='none' are not accessible via document.cookie
  res.setHeader('X-CSRF-Token', token);

  // Make token available in request/response
  req.csrfToken = token;
  res.locals.csrfToken = token;

  next();
};

/**
 * Middleware to verify CSRF token
 * CRITICAL: Only compare cookie token to header token (double-submit pattern)
 * Do NOT regenerate tokens during verification
 */
export const verifyCsrfToken = (req, res, next) => {
  // Skip CSRF check for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF check for health endpoint (used for pre-warming)
  if (req.path === '/api/health' || req.path === '/health') {
    return next();
  }

  // Read token from cookie
  const cookieToken = req.cookies['XSRF-TOKEN'];

  // Read token from header (x-xsrf-token OR x-csrf-token)
  const headerToken = req.headers['x-xsrf-token'] || req.headers['x-csrf-token'];

  // In development, log CSRF attempts
  if (config.nodeEnv === 'development') {
    console.log('🛡️ CSRF Check:', {
      method: req.method,
      path: req.path,
      hasCookie: !!cookieToken,
      hasHeader: !!headerToken,
      tokensMatch: cookieToken === headerToken
    });
  }

  // Reject if missing
  if (!cookieToken || !headerToken) {
    if (config.nodeEnv === 'development') {
      console.log('❌ CSRF token missing:', {
        cookieToken: cookieToken ? cookieToken.substring(0, 10) + '...' : 'MISSING',
        headerToken: headerToken ? headerToken.substring(0, 10) + '...' : 'MISSING'
      });
    }
    return res.status(403).json({
      message: 'CSRF token missing',
      error: 'Invalid CSRF token'
    });
  }

  // Reject if mismatched
  if (cookieToken !== headerToken) {
    if (config.nodeEnv === 'development') {
      console.log('❌ CSRF token mismatch:', {
        cookieToken: cookieToken.substring(0, 10) + '...',
        headerToken: headerToken.substring(0, 10) + '...'
      });
    }
    return res.status(403).json({
      message: 'CSRF token mismatch',
      error: 'Invalid CSRF token'
    });
  }

  // Allow request if values match exactly
  if (config.nodeEnv === 'development') {
    console.log('✅ CSRF token valid');
  }
  next();
};

/**
 * Middleware to enforce CSRF for all state-changing requests
 * Even with JWT authentication, CSRF protection adds defense in depth
 * This prevents attacks where an attacker tricks a user's browser into making requests
 */
export const enforceCsrf = (req, res, next) => {
  // ✅ Skip CSRF for Socket.IO (uses JWT auth in handshake)
  if (req.path.startsWith('/socket.io')) {
    return next();
  }

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

