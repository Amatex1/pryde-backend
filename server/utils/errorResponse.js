/**
 * Standardized Error Response Utility
 * 
 * Ensures all API errors return consistent format:
 * {
 *   message: string,
 *   code: string,
 *   details?: any (development only)
 * }
 */

import config from '../config/config.js';

/**
 * Standard error codes
 */
export const ErrorCodes = {
  // Authentication & Authorization
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  MALFORMED_TOKEN: 'MALFORMED_TOKEN',
  TOKEN_NOT_ACTIVE: 'TOKEN_NOT_ACTIVE',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  ACCOUNT_DELETED: 'ACCOUNT_DELETED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  ACCOUNT_BANNED: 'ACCOUNT_BANNED',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_ID: 'INVALID_ID',
  
  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  
  // Server Errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  
  // Business Logic
  OPERATION_FAILED: 'OPERATION_FAILED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INVALID_OPERATION: 'INVALID_OPERATION'
};

/**
 * Send standardized error response
 * 
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Human-readable error message
 * @param {string} code - Machine-readable error code
 * @param {any} details - Additional error details (development only)
 */
export const sendError = (res, statusCode, message, code = ErrorCodes.INTERNAL_ERROR, details = null) => {
  const errorResponse = {
    message,
    code
  };
  
  // Only include details in development mode
  if (config.nodeEnv === 'development' && details) {
    errorResponse.details = details;
  }
  
  return res.status(statusCode).json(errorResponse);
};

/**
 * Send validation error response
 */
export const sendValidationError = (res, message, details = null) => {
  return sendError(res, 400, message, ErrorCodes.VALIDATION_ERROR, details);
};

/**
 * Send unauthorized error response
 */
export const sendUnauthorizedError = (res, message = 'Unauthorized', code = ErrorCodes.UNAUTHORIZED) => {
  return sendError(res, 401, message, code);
};

/**
 * Send forbidden error response
 */
export const sendForbiddenError = (res, message = 'Forbidden', code = ErrorCodes.FORBIDDEN) => {
  return sendError(res, 403, message, code);
};

/**
 * Send not found error response
 */
export const sendNotFoundError = (res, message = 'Resource not found', code = ErrorCodes.NOT_FOUND) => {
  return sendError(res, 404, message, code);
};

/**
 * Send rate limit error response
 */
export const sendRateLimitError = (res, message = 'Too many requests', code = ErrorCodes.RATE_LIMIT_EXCEEDED) => {
  return sendError(res, 429, message, code);
};

/**
 * Send internal server error response
 */
export const sendInternalError = (res, message = 'Internal server error', details = null) => {
  return sendError(res, 500, message, ErrorCodes.INTERNAL_ERROR, details);
};

/**
 * Handle Mongoose validation errors
 */
export const handleMongooseError = (res, error) => {
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map(err => err.message);
    return sendValidationError(res, messages.join(', '), error.errors);
  }
  
  if (error.name === 'CastError') {
    return sendValidationError(res, `Invalid ${error.path}: ${error.value}`, error);
  }
  
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    return sendError(res, 409, `${field} already exists`, ErrorCodes.DUPLICATE_ENTRY, error);
  }
  
  // Default to internal error
  return sendInternalError(res, 'Database error', error.message);
};

/**
 * Express error handling middleware
 * Use this as the last middleware in your app
 */
export const errorHandler = (err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  
  // Handle Mongoose errors
  if (err.name === 'ValidationError' || err.name === 'CastError' || err.code === 11000) {
    return handleMongooseError(res, err);
  }
  
  // Handle JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return sendUnauthorizedError(res, 'Invalid or expired token', ErrorCodes.INVALID_TOKEN);
  }
  
  // Default to 500
  return sendInternalError(res, err.message || 'Internal server error', err.stack);
};

