import xss from 'xss';

/**
 * XSS sanitization utility
 * Sanitizes user input to prevent XSS attacks
 */

// Custom XSS filter options
const xssOptions = {
  whiteList: {
    // Allow basic text formatting
    b: [],
    i: [],
    em: [],
    strong: [],
    br: [],
    p: [],
    // Allow links with limited attributes
    a: ['href', 'title', 'target'],
    // Allow lists
    ul: [],
    ol: [],
    li: [],
    // No script, iframe, or other dangerous tags
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
  css: false, // Disable inline styles
  onIgnoreTag: (tag, html, options) => {
    // Log ignored tags in development
    if (process.env.NODE_ENV === 'development') {
      console.warn(`⚠️ XSS: Removed tag: ${tag}`);
    }
  },
  onIgnoreTagAttr: (tag, name, value, isWhiteAttr) => {
    // Log ignored attributes in development
    if (process.env.NODE_ENV === 'development' && !isWhiteAttr) {
      console.warn(`⚠️ XSS: Removed attribute: ${name} from ${tag}`);
    }
  }
};

/**
 * Sanitize a string to prevent XSS attacks
 * @param {string} input - The input string to sanitize
 * @returns {string} - Sanitized string
 */
export const sanitizeInput = (input) => {
  if (!input || typeof input !== 'string') {
    return input;
  }
  return xss(input, xssOptions);
};

/**
 * Sanitize an object's string properties recursively
 * @param {object} obj - The object to sanitize
 * @returns {object} - Sanitized object
 */
export const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sanitized = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      
      if (typeof value === 'string') {
        sanitized[key] = sanitizeInput(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
};

/**
 * Express middleware to sanitize request body
 */
export const sanitizeBody = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  next();
};

/**
 * Sanitize specific fields in request body
 * @param {string[]} fields - Array of field names to sanitize
 */
export const sanitizeFields = (fields) => {
  return (req, res, next) => {
    if (req.body) {
      fields.forEach(field => {
        if (req.body[field]) {
          if (typeof req.body[field] === 'string') {
            req.body[field] = sanitizeInput(req.body[field]);
          } else if (typeof req.body[field] === 'object') {
            req.body[field] = sanitizeObject(req.body[field]);
          }
        }
      });
    }
    next();
  };
};

export default {
  sanitizeInput,
  sanitizeObject,
  sanitizeBody,
  sanitizeFields
};

