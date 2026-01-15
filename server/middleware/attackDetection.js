/**
 * Attack Detection Middleware
 *
 * Monitors requests for suspicious patterns and logs potential attacks.
 * This is a lightweight detection layer - not a replacement for WAF.
 */

import { logSuspiciousRequest, logInjectionAttempt, logXSSAttempt } from '../utils/securityLogger.js';

// Patterns that indicate potential attacks
const SUSPICIOUS_PATTERNS = {
  // SQL/NoSQL injection patterns
  injection: [
    /(\$where|\$regex|\$ne|\$gt|\$lt|\$or|\$and)/i,  // NoSQL operators in unexpected places
    /(union\s+select|drop\s+table|insert\s+into)/i,   // SQL injection
    /(\{\s*"\$)/,  // MongoDB operator injection
  ],
  // XSS patterns
  xss: [
    /<script[\s>]/i,
    /javascript:/i,
    /on\w+\s*=/i,  // onclick=, onerror=, etc.
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ],
  // Path traversal
  pathTraversal: [
    /\.\.\//,
    /\.\.\\/,
    /%2e%2e/i,
  ],
  // Command injection
  commandInjection: [
    /[;&|`$]/,  // Shell metacharacters in specific contexts
  ]
};

/**
 * Check a string for suspicious patterns
 */
const checkForPatterns = (str, patterns) => {
  if (!str || typeof str !== 'string') return null;
  for (const pattern of patterns) {
    if (pattern.test(str)) {
      return pattern.toString();
    }
  }
  return null;
};

/**
 * Recursively check object values for patterns
 */
const deepCheck = (obj, patterns, maxDepth = 5, currentDepth = 0) => {
  if (currentDepth >= maxDepth) return null;
  if (!obj || typeof obj !== 'object') return null;

  for (const key in obj) {
    const value = obj[key];
    if (typeof value === 'string') {
      const match = checkForPatterns(value, patterns);
      if (match) return { key, value: value.substring(0, 100), pattern: match };
    } else if (typeof value === 'object') {
      const result = deepCheck(value, patterns, maxDepth, currentDepth + 1);
      if (result) return result;
    }
  }
  return null;
};

/**
 * Attack detection middleware
 * Checks request body, query, and params for suspicious patterns
 */
export const detectAttacks = async (req, res, next) => {
  try {
    // Skip for safe methods unless they have query params
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !Object.keys(req.query).length) {
      return next();
    }

    // Check for injection attempts
    const injectionInBody = deepCheck(req.body, SUSPICIOUS_PATTERNS.injection);
    const injectionInQuery = deepCheck(req.query, SUSPICIOUS_PATTERNS.injection);

    if (injectionInBody || injectionInQuery) {
      const payload = injectionInBody || injectionInQuery;
      await logInjectionAttempt(req, JSON.stringify(payload));
      // Don't block - mongo-sanitize should handle it, but log for monitoring
    }

    // Check for XSS attempts
    const xssInBody = deepCheck(req.body, SUSPICIOUS_PATTERNS.xss);
    const xssInQuery = deepCheck(req.query, SUSPICIOUS_PATTERNS.xss);

    if (xssInBody || xssInQuery) {
      const payload = xssInBody || xssInQuery;
      await logXSSAttempt(req, JSON.stringify(payload));
      // Don't block - sanitize-html should handle it, but log for monitoring
    }

    // Check for path traversal in URL
    if (checkForPatterns(req.path, SUSPICIOUS_PATTERNS.pathTraversal)) {
      await logSuspiciousRequest(req, 'Path traversal attempt detected');
      return res.status(400).json({ message: 'Invalid request path' });
    }

    next();
  } catch (error) {
    // Never block requests due to logging errors
    console.error('Attack detection error:', error);
    next();
  }
};

/**
 * Log suspicious 4xx/5xx responses for monitoring
 */
export const logSuspiciousResponses = (req, res, next) => {
  const originalSend = res.send;

  res.send = function(body) {
    // Log suspicious response patterns
    if (res.statusCode >= 400) {
      const shouldLog =
        res.statusCode === 401 || // Unauthorized
        res.statusCode === 403 || // Forbidden
        res.statusCode === 429 || // Rate limited
        res.statusCode >= 500;    // Server errors

      if (shouldLog) {
        // Async log - don't await
        logSuspiciousRequest(req, `Response ${res.statusCode}`).catch(() => {});
      }
    }

    return originalSend.call(this, body);
  };

  next();
};

export default {
  detectAttacks,
  logSuspiciousResponses
};
