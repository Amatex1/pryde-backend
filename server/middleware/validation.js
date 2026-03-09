/**
 * Input Validation & Sanitization Middleware
 * Provides request body validation and sanitization
 */

import validator from 'validator';
import logger from '../utils/logger.js';

/**
 * Sanitize a string value - removes potentially dangerous characters
 * @param {string} value - Value to sanitize
 * @returns {string} Sanitized value
 */
export const sanitizeString = (value) => {
  if (typeof value !== 'string') return value;
  
  // Trim whitespace
  let sanitized = value.trim();
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Escape HTML entities to prevent XSS
  sanitized = validator.escape(sanitized);
  
  return sanitized;
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
export const isValidEmail = (email) => {
  return validator.isEmail(email);
};

/**
 * Validate username format
 * @param {string} username - Username to validate
 * @returns {boolean} True if valid
 */
export const isValidUsername = (username) => {
  if (!username || typeof username !== 'string') return false;
  
  // Username: 3-30 chars, alphanumeric + underscore only
  return /^[a-zA-Z0-9_]{3,30}$/.test(username);
};

/**
 * Validate MongoDB ObjectId format
 * @param {string} id - ID to validate
 * @returns {boolean} True if valid
 */
export const isValidObjectId = (id) => {
  return validator.isMongoId(id);
};

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 */
export const isValidUrl = (url) => {
  return validator.isURL(url, {
    protocols: ['http', 'https'],
    require_protocol: true
  });
};

/**
 * Middleware factory for validating request body fields
 * @param {Object} schema - Validation schema
 * @param {string} source - 'body' | 'query' | 'params'
 * @returns {Function} Express middleware
 */
export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = req[source];
    const errors = [];
    
    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];
      
      // Required check
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push({ field, message: `${field} is required` });
        continue;
      }
      
      // Skip further validation if empty and not required
      if (value === undefined || value === null || value === '') {
        continue;
      }
      
      // Type validation
      if (rules.type) {
        if (rules.type === 'string' && typeof value !== 'string') {
          errors.push({ field, message: `${field} must be a string` });
          continue;
        }
        if (rules.type === 'number' && typeof value !== 'number') {
          errors.push({ field, message: `${field} must be a number` });
          continue;
        }
        if (rules.type === 'boolean' && typeof value !== 'boolean') {
          errors.push({ field, message: `${field} must be a boolean` });
          continue;
        }
        if (rules.type === 'array' && !Array.isArray(value)) {
          errors.push({ field, message: `${field} must be an array` });
          continue;
        }
      }
      
      // String validations
      if (typeof value === 'string') {
        if (rules.minLength && value.length < rules.minLength) {
          errors.push({ field, message: `${field} must be at least ${rules.minLength} characters` });
        }
        
        if (rules.maxLength && value.length > rules.maxLength) {
          errors.push({ field, message: `${field} must be at most ${rules.maxLength} characters` });
        }
        
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push({ field, message: rules.patternMessage || `${field} has invalid format` });
        }
        
        if (rules.isEmail && !isValidEmail(value)) {
          errors.push({ field, message: `${field} must be a valid email` });
        }
        
        if (rules.isUrl && !isValidUrl(value)) {
          errors.push({ field, message: `${field} must be a valid URL` });
        }
        
        if (rules.custom && typeof rules.custom === 'function') {
          const result = rules.custom(value);
          if (result !== true) {
            errors.push({ field, message: result || `${field} is invalid` });
          }
        }
      }
      
      // Array validations
      if (Array.isArray(value)) {
        if (rules.minItems && value.length < rules.minItems) {
          errors.push({ field, message: `${field} must have at least ${rules.minItems} items` });
        }
        if (rules.maxItems && value.length > rules.maxItems) {
          errors.push({ field, message: `${field} must have at most ${rules.maxItems} items` });
        }
      }
    }
    
    if (errors.length > 0) {
      logger.warn(`Validation failed for ${source}:`, errors);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    next();
  };
};

/**
 * Middleware factory for sanitizing request body fields
 * @param {Array|string} fields - Fields to sanitize
 * @param {string} source - 'body' | 'query' | 'params'
 * @returns {Function} Express middleware
 */
export const sanitize = (fields, source = 'body') => {
  return (req, res, next) => {
    const data = req[source];
    const fieldList = Array.isArray(fields) ? fields : [fields];
    
    for (const field of fieldList) {
      if (data[field] && typeof data[field] === 'string') {
        data[field] = sanitizeString(data[field]);
      }
    }
    
    next();
  };
};

/**
 * Sanitize all string fields in request
 * @param {string} source - 'body' | 'query' | 'params'
 * @returns {Function} Express middleware
 */
export const sanitizeAll = (source = 'body') => {
  return (req, res, next) => {
    const data = req[source];
    
    const sanitizeObject = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'string') {
          obj[key] = sanitizeString(obj[key]);
        } else if (Array.isArray(obj[key])) {
          obj[key] = obj[key].map(item => 
            typeof item === 'string' ? sanitizeString(item) : item
          );
        } else if (typeof obj[key] === 'object') {
          sanitizeObject(obj[key]);
        }
      }
    };
    
    sanitizeObject(data);
    next();
  };
};

/**
 * Validate MongoDB ObjectId in route parameters
 * @param {string} paramName - Parameter name to validate
 * @returns {Function} Express middleware
 */
export const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!id || !isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${paramName} format`
      });
    }
    
    next();
  };
};

// Backward-compatible alias used across older route modules.
export const validateParamId = validateObjectId;

/**
 * Pre-built middleware for the login endpoint
 * Validates email format and presence of password before the handler runs
 */
export const validateLogin = validate({
  email: {
    required: true,
    type: 'string',
    isEmail: true
  },
  password: {
    required: true,
    type: 'string',
    minLength: 1
  }
});

/**
 * Pre-built middleware for the signup endpoint
 * Validates required fields and signup password policy before the handler runs
 * Note: birthday age check is still enforced in the route handler
 */
export const validateSignup = validate({
  fullName: {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 100
  },
  username: {
    required: true,
    type: 'string',
    custom: (v) => isValidUsername(v) || 'Username must be 3-30 characters, letters, numbers, and underscores only'
  },
  email: {
    required: true,
    type: 'string',
    isEmail: true
  },
  password: {
    required: true,
    type: 'string',
    minLength: 12,
    maxLength: 128,
    custom: (v) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/])/.test(v)
      || 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  },
  birthday: {
    required: true,
    type: 'string'
  }
});

export default {
  sanitizeString,
  isValidEmail,
  isValidUsername,
  isValidObjectId,
  isValidUrl,
  validate,
  sanitize,
  sanitizeAll,
  validateParamId,
  validateObjectId,
  validateLogin,
  validateSignup
};
