/**
 * Backend Hardening Middleware
 * Version: 2024-12-28
 * 
 * PURPOSE:
 * - Add request IDs for tracing
 * - Add request timeouts
 * - Ensure consistent error responses
 * - Prevent stack trace leaks
 * - Add security headers for API responses
 */

import crypto from 'crypto';
import logger from '../utils/logger.js';

/**
 * Generate a unique request ID
 * Uses crypto.randomUUID if available (Node 14.17+), otherwise falls back to randomBytes
 */
const generateRequestId = () => {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString('hex');
};

/**
 * Request ID Middleware
 * Adds a unique request ID to every request for tracing
 */
export const requestId = (req, res, next) => {
  // PART 10: Validate client-supplied X-Request-Id to prevent log injection
  // Only accept the header if it passes strict validation (max 50 chars, alphanumeric + hyphens only)
  const clientId = req.headers['x-request-id'];
  if (clientId && typeof clientId === 'string' && /^[a-zA-Z0-9\-]{1,50}$/.test(clientId)) {
    req.requestId = clientId;
  } else {
    req.requestId = generateRequestId();
  }
  res.setHeader('X-Request-Id', req.requestId);
  next();
};

/**
 * Request Timeout Middleware
 * Prevents requests from hanging indefinitely
 * @param {number} timeoutMs - Timeout in milliseconds (default: 30 seconds)
 */
export const requestTimeout = (timeoutMs = 30000) => {
  return (req, res, next) => {
    // Set timeout on the request
    req.setTimeout(timeoutMs, () => {
      if (!res.headersSent) {
        logger.warn('Request timeout', {
          requestId: req.requestId,
          method: req.method,
          path: req.path,
          timeoutMs
        });
        res.status(503).json({
          message: 'Request timeout - please try again',
          requestId: req.requestId
        });
      }
    });
    next();
  };
};

/**
 * API Security Headers Middleware
 * Adds additional security headers for API responses
 */
export const apiSecurityHeaders = (req, res, next) => {
  // Prevent caching of sensitive API responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Prevent content type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  next();
};

/**
 * Request Logging Middleware
 * Logs incoming requests with timing information
 */
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log request start
  logger.info('Request started', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent']?.substring(0, 100)
  });
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 500 ? 'error' : 
                     res.statusCode >= 400 ? 'warn' : 'info';
    
    logger[logLevel]('Request completed', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });
  
  next();
};

/**
 * Safe JSON Response Wrapper
 * Ensures all JSON responses are properly formatted
 * and don't leak sensitive information
 */
export const safeJsonResponse = (req, res, next) => {
  const originalJson = res.json.bind(res);
  
  res.json = (data) => {
    // Add request ID to all responses
    if (typeof data === 'object' && data !== null) {
      data.requestId = req.requestId;
    }
    
    // Ensure error responses don't leak stack traces
    if (data && data.stack) {
      delete data.stack;
    }
    
    return originalJson(data);
  };
  
  next();
};

/**
 * Combined hardening middleware
 * Apply all hardening middleware in the correct order
 */
export const applyHardening = (app) => {
  app.use(requestId);
  app.use(requestTimeout(30000)); // 30 second timeout
  app.use(apiSecurityHeaders);
  // Note: requestLogger is optional - enable in production if needed
  // app.use(requestLogger);
  app.use(safeJsonResponse);
};

export default {
  requestId,
  requestTimeout,
  apiSecurityHeaders,
  requestLogger,
  safeJsonResponse,
  applyHardening
};

