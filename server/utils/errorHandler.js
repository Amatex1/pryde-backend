/**
 * Centralized Error Handling Utility
 * Phase 2 - Backend Failure Safety
 * 
 * Provides consistent error responses across all routes.
 * Never leaks stack traces to clients.
 */

import logger from './logger.js';

/**
 * Standard HTTP Error Codes
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};

/**
 * Custom API Error class for consistent error handling
 */
export class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true; // Distinguishes from programming errors
  }

  static badRequest(message = 'Bad request', details = null) {
    return new ApiError(HttpStatus.BAD_REQUEST, message, details);
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(HttpStatus.UNAUTHORIZED, message);
  }

  static forbidden(message = 'Access denied') {
    return new ApiError(HttpStatus.FORBIDDEN, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(HttpStatus.NOT_FOUND, message);
  }

  static conflict(message = 'Resource conflict') {
    return new ApiError(HttpStatus.CONFLICT, message);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(HttpStatus.INTERNAL_ERROR, message);
  }
}

/**
 * Safe response helper - ensures no raw errors leak to client
 * @param {Response} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - User-friendly message
 * @param {object} data - Optional additional data
 */
export const sendError = (res, statusCode, message, data = null) => {
  const response = { message };
  if (data) {
    response.details = data;
  }
  return res.status(statusCode).json(response);
};

/**
 * Wraps async route handlers to catch errors automatically
 * @param {Function} fn - Async route handler
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Guard clause helper - validates required user auth
 * Returns user ID or sends 401 response
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @returns {string|null} - User ID or null if unauthorized
 */
export const requireAuth = (req, res) => {
  const userId = req.user?.id || req.user?._id || req.userId;
  if (!userId) {
    sendError(res, HttpStatus.UNAUTHORIZED, 'Authentication required');
    return null;
  }
  return userId.toString();
};

/**
 * Validates MongoDB ObjectId format
 * @param {string} id - ID to validate
 * @returns {boolean}
 */
export const isValidObjectId = (id) => {
  if (!id) return false;
  // MongoDB ObjectId is a 24-character hex string
  return /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Guard clause for required parameters
 * @param {object} params - Object with param names and values
 * @param {Response} res - Express response object
 * @returns {boolean} - true if all params valid, false if response sent
 */
export const requireParams = (params, res) => {
  const missing = Object.entries(params)
    .filter(([_, value]) => value === undefined || value === null || value === '')
    .map(([key]) => key);

  if (missing.length > 0) {
    sendError(res, HttpStatus.BAD_REQUEST, `Missing required parameters: ${missing.join(', ')}`);
    return false;
  }
  return true;
};

/**
 * Validate ObjectId parameter
 * @param {string} id - ID to validate
 * @param {string} paramName - Name of the parameter (for error message)
 * @param {Response} res - Express response object
 * @returns {boolean} - true if valid, false if response sent
 */
export const requireValidId = (id, paramName, res) => {
  if (!isValidObjectId(id)) {
    sendError(res, HttpStatus.BAD_REQUEST, `Invalid ${paramName}: must be a valid ID`);
    return false;
  }
  return true;
};

/**
 * Global error handler middleware (use at end of middleware chain)
 */
export const globalErrorHandler = (err, req, res, next) => {
  // Log the error
  logger.error('Global error handler:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    userId: req.user?.id || req.userId
  });

  // Handle operational errors (expected)
  if (err.isOperational) {
    return sendError(res, err.statusCode, err.message, err.details);
  }

  // Handle specific error types
  if (err.name === 'ValidationError') {
    // Mongoose validation error
    const messages = Object.values(err.errors || {}).map(e => e.message);
    return sendError(res, HttpStatus.BAD_REQUEST, 'Validation failed', { errors: messages });
  }

  if (err.name === 'CastError') {
    return sendError(res, HttpStatus.BAD_REQUEST, 'Invalid ID format');
  }

  if (err.code === 11000) {
    // MongoDB duplicate key error
    return sendError(res, HttpStatus.CONFLICT, 'Resource already exists');
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return sendError(res, HttpStatus.UNAUTHORIZED, 'Invalid or expired token');
  }

  // Default to 500 for unknown errors - NEVER leak stack traces
  return sendError(res, HttpStatus.INTERNAL_ERROR, 'An unexpected error occurred');
};

export default {
  HttpStatus,
  ApiError,
  sendError,
  asyncHandler,
  requireAuth,
  isValidObjectId,
  requireParams,
  requireValidId,
  globalErrorHandler
};

