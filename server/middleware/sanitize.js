/**
 * Backend XSS Protection Middleware
 * Sanitizes user input before saving to database
 * Uses sanitize-html for comprehensive XSS protection
 */

import sanitizeHtml from 'sanitize-html';

/**
 * Default sanitization options
 * Strips all HTML tags and dangerous content
 */
const DEFAULT_OPTIONS = {
  allowedTags: [], // No HTML tags allowed
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {},
  allowProtocolRelative: false,
  enforceHtmlBoundary: false
};

/**
 * Strict sanitization options for sensitive fields
 * Removes all HTML and special characters
 */
const STRICT_OPTIONS = {
  allowedTags: [],
  allowedAttributes: {},
  textFilter: (text) => {
    // Remove any remaining special characters that could be used for XSS
    return text.replace(/[<>'"]/g, '');
  }
};

/**
 * Sanitize a single string value
 * @param {string} value - Value to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized value
 */
const sanitizeValue = (value, options = DEFAULT_OPTIONS) => {
  if (typeof value !== 'string') return value;

  // Sanitize HTML
  let sanitized = sanitizeHtml(value, options);

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
};

/**
 * Middleware to sanitize specified fields in request body
 * @param {Array<string>} fields - Array of field names to sanitize
 * @param {Object} options - Sanitization options (optional)
 * @returns {Function} Express middleware function
 */
export const sanitizeFields = (fields = [], options = DEFAULT_OPTIONS) => {
  return (req, res, next) => {
    try {
      if (!req.body) {
        return next();
      }

      // Sanitize each specified field
      fields.forEach(field => {
        if (req.body[field] && typeof req.body[field] === 'string') {
          req.body[field] = sanitizeValue(req.body[field], options);
        }
      });

      next();
    } catch (error) {
      console.error('Sanitization error:', error);
      res.status(500).json({ message: 'Error processing request' });
    }
  };
};

/**
 * Middleware to sanitize all string fields in request body
 * @param {Object} options - Sanitization options (optional)
 * @returns {Function} Express middleware function
 */
export const sanitizeAll = (options = DEFAULT_OPTIONS) => {
  return (req, res, next) => {
    try {
      if (!req.body) {
        return next();
      }

      // Recursively sanitize all string fields
      const sanitizeObject = (obj) => {
        Object.keys(obj).forEach(key => {
          if (typeof obj[key] === 'string') {
            obj[key] = sanitizeValue(obj[key], options);
          } else if (Array.isArray(obj[key])) {
            obj[key] = obj[key].map(item =>
              typeof item === 'string' ? sanitizeValue(item, options) : item
            );
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            sanitizeObject(obj[key]);
          }
        });
      };

      sanitizeObject(req.body);
      next();
    } catch (error) {
      console.error('Sanitization error:', error);
      res.status(500).json({ message: 'Error processing request' });
    }
  };
};

/**
 * Strict sanitization middleware for sensitive fields
 * Removes all HTML and special characters
 * @param {Array<string>} fields - Array of field names to sanitize
 * @returns {Function} Express middleware function
 */
export const sanitizeStrict = (fields = []) => {
  return sanitizeFields(fields, STRICT_OPTIONS);
};

export default { sanitizeFields, sanitizeAll, sanitizeStrict };

