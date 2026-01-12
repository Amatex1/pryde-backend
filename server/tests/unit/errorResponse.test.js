/**
 * Unit Tests: Error Response Utility
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  ErrorCodes,
  sendError,
  sendValidationError,
  sendUnauthorizedError,
  sendNotFoundError,
  handleMongooseError
} from '../../utils/errorResponse.js';

describe('Error Response Utility', () => {
  let mockRes;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('sendError', () => {
    it('should send error with correct status and format', () => {
      sendError(mockRes, 400, 'Test error', ErrorCodes.VALIDATION_ERROR);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Test error',
        code: ErrorCodes.VALIDATION_ERROR
      });
    });

    it('should include details in development mode', () => {
      process.env.NODE_ENV = 'development';
      
      sendError(mockRes, 500, 'Server error', ErrorCodes.INTERNAL_ERROR, { stack: 'error stack' });
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: { stack: 'error stack' }
        })
      );
    });

    it('should not include details in production mode', () => {
      process.env.NODE_ENV = 'production';
      
      sendError(mockRes, 500, 'Server error', ErrorCodes.INTERNAL_ERROR, { stack: 'error stack' });
      
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Server error',
        code: ErrorCodes.INTERNAL_ERROR
      });
    });
  });

  describe('sendValidationError', () => {
    it('should send 400 with validation error code', () => {
      sendValidationError(mockRes, 'Invalid input');
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Invalid input',
        code: ErrorCodes.VALIDATION_ERROR
      });
    });
  });

  describe('sendUnauthorizedError', () => {
    it('should send 401 with unauthorized code', () => {
      sendUnauthorizedError(mockRes, 'Not authenticated');
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Not authenticated',
        code: ErrorCodes.UNAUTHORIZED
      });
    });

    it('should use custom error code if provided', () => {
      sendUnauthorizedError(mockRes, 'Token expired', ErrorCodes.TOKEN_EXPIRED);
      
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Token expired',
        code: ErrorCodes.TOKEN_EXPIRED
      });
    });
  });

  describe('sendNotFoundError', () => {
    it('should send 404 with not found code', () => {
      sendNotFoundError(mockRes, 'User not found');
      
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'User not found',
        code: ErrorCodes.NOT_FOUND
      });
    });
  });

  describe('handleMongooseError', () => {
    it('should handle ValidationError', () => {
      const error = {
        name: 'ValidationError',
        errors: {
          email: { message: 'Email is required' },
          password: { message: 'Password is required' }
        }
      };
      
      handleMongooseError(mockRes, error);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCodes.VALIDATION_ERROR
        })
      );
    });

    it('should handle CastError', () => {
      const error = {
        name: 'CastError',
        path: 'userId',
        value: 'invalid-id'
      };
      
      handleMongooseError(mockRes, error);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Invalid userId'),
          code: ErrorCodes.VALIDATION_ERROR
        })
      );
    });

    it('should handle duplicate key error', () => {
      const error = {
        code: 11000,
        keyPattern: { email: 1 }
      };
      
      handleMongooseError(mockRes, error);
      
      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('email already exists'),
          code: ErrorCodes.DUPLICATE_ENTRY
        })
      );
    });
  });
});

