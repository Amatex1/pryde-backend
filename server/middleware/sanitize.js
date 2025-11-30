/**
 * Simple HTML tag removal function
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
const stripHtmlTags = (str) => {
  if (typeof str !== 'string') return str;
  // Remove HTML tags
  return str.replace(/<[^>]*>/g, '').trim();
};

/**
 * Middleware to sanitize specified fields in request body
 * @param {Array<string>} fields - Array of field names to sanitize
 * @returns {Function} Express middleware function
 */
export const sanitizeFields = (fields = []) => {
  return (req, res, next) => {
    try {
      if (!req.body) {
        return next();
      }

      // Sanitize each specified field
      fields.forEach(field => {
        if (req.body[field] && typeof req.body[field] === 'string') {
          // Remove any HTML tags and scripts
          req.body[field] = stripHtmlTags(req.body[field]);
        }
      });

      next();
    } catch (error) {
      console.error('Sanitization error:', error);
      next(error);
    }
  };
};

/**
 * Middleware to sanitize all string fields in request body
 * @returns {Function} Express middleware function
 */
export const sanitizeAll = () => {
  return (req, res, next) => {
    try {
      if (!req.body) {
        return next();
      }

      // Recursively sanitize all string fields
      const sanitizeObject = (obj) => {
        Object.keys(obj).forEach(key => {
          if (typeof obj[key] === 'string') {
            obj[key] = stripHtmlTags(obj[key]);
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            sanitizeObject(obj[key]);
          }
        });
      };

      sanitizeObject(req.body);
      next();
    } catch (error) {
      console.error('Sanitization error:', error);
      next(error);
    }
  };
};

export default { sanitizeFields, sanitizeAll };

