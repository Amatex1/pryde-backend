/**
 * Mutation Trace Utility
 * 
 * Provides end-to-end traceability for all mutation operations.
 * Generates unique IDs that flow through Frontend → Backend → MongoDB → Response
 * 
 * CANONICAL SOURCE OF TRUTH:
 * - MongoDB is the final authority
 * - Backend API is the gatekeeper
 * - Frontend state must mirror backend responses ONLY
 */

import crypto from 'crypto';
import logger from './logger.js';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Generate a unique mutation trace ID
 * Format: mut_<timestamp>_<random>
 */
export const generateMutationId = () => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString('hex');
  return `mut_${timestamp}_${random}`;
};

/**
 * Mutation trace context - stores mutation metadata
 */
export class MutationTrace {
  constructor(mutationId, operation, entity, userId) {
    this.mutationId = mutationId || generateMutationId();
    this.operation = operation; // 'CREATE', 'UPDATE', 'DELETE'
    this.entity = entity; // 'post', 'draft', 'comment', etc.
    this.userId = userId;
    this.startTime = Date.now();
    this.steps = [];
  }

  /**
   * Add a step to the trace
   */
  addStep(step, data = {}) {
    const timestamp = Date.now();
    this.steps.push({
      step,
      timestamp,
      elapsed: timestamp - this.startTime,
      ...data
    });

    if (isDev) {
      logger.debug(`🔍 [${this.mutationId}] ${step}`, data);
    }
  }

  /**
   * Mark mutation as successful
   */
  success(result = {}) {
    this.status = 'SUCCESS';
    this.endTime = Date.now();
    this.duration = this.endTime - this.startTime;
    this.result = result;

    if (isDev) {
      logger.success(`✅ [${this.mutationId}] ${this.operation} ${this.entity} completed in ${this.duration}ms`);
    }

    return this.toResponse();
  }

  /**
   * Mark mutation as failed
   */
  fail(error, code = 500) {
    this.status = 'FAILED';
    this.endTime = Date.now();
    this.duration = this.endTime - this.startTime;
    this.error = error;
    this.errorCode = code;

    logger.error(`❌ [${this.mutationId}] ${this.operation} ${this.entity} failed:`, error);

    return this.toResponse();
  }

  /**
   * Convert to API response format
   * Includes mutationId for frontend tracking
   */
  toResponse() {
    const response = {
      _mutationId: this.mutationId
    };

    // Only include full trace in dev mode
    if (isDev) {
      response._trace = {
        operation: this.operation,
        entity: this.entity,
        status: this.status,
        duration: this.duration,
        steps: this.steps
      };
    }

    return response;
  }
}

/**
 * Middleware to extract or generate mutation ID from request
 * Attaches mutation context to request object
 */
export const mutationTraceMiddleware = (operation, entity) => {
  return (req, res, next) => {
    // Accept mutationId from frontend or generate new one
    const mutationId = req.headers['x-mutation-id'] || 
                       req.body?._mutationId || 
                       generateMutationId();

    const userId = req.userId || req.user?._id?.toString() || 'anonymous';

    req.mutation = new MutationTrace(mutationId, operation, entity, userId);
    req.mutation.addStep('REQUEST_RECEIVED', {
      method: req.method,
      path: req.path,
      bodyKeys: req.body ? Object.keys(req.body) : []
    });

    // Attach mutationId to response headers for debugging
    res.setHeader('X-Mutation-Id', mutationId);

    next();
  };
};

/**
 * Verify a document exists after write operation
 * CRITICAL: Never assume MongoDB write succeeded silently
 */
export const verifyWrite = async (Model, documentId, mutation, expectedFields = {}) => {
  mutation.addStep('VERIFY_WRITE_START', { documentId: documentId.toString() });

  const doc = await Model.findById(documentId).lean();

  if (!doc) {
    mutation.addStep('VERIFY_WRITE_FAILED', { reason: 'Document not found after write' });
    throw new Error(`Write verification failed: ${Model.modelName} ${documentId} not found after save`);
  }

  // Verify expected fields match
  for (const [field, expectedValue] of Object.entries(expectedFields)) {
    const actualValue = doc[field];
    if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
      mutation.addStep('VERIFY_WRITE_MISMATCH', {
        field,
        expected: expectedValue,
        actual: actualValue
      });
      logger.warn(`⚠️ [${mutation.mutationId}] Field mismatch: ${field}`, {
        expected: expectedValue,
        actual: actualValue
      });
    }
  }

  mutation.addStep('VERIFY_WRITE_SUCCESS', { documentId: documentId.toString() });
  return doc;
};

export default {
  generateMutationId,
  MutationTrace,
  mutationTraceMiddleware,
  verifyWrite
};

