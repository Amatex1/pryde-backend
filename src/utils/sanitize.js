/**
 * Frontend XSS Protection Utility
 * Sanitizes user-generated content before rendering
 * Uses DOMPurify for comprehensive XSS protection
 */

import DOMPurify from 'dompurify';

/**
 * Default sanitization configuration
 * Allows basic formatting while blocking scripts and dangerous attributes
 */
const DEFAULT_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 's', 'a', 'span',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre'
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  KEEP_CONTENT: true,
  RETURN_TRUSTED_TYPE: false
};

/**
 * Strict sanitization configuration
 * Strips all HTML tags, only allows plain text
 */
const STRICT_CONFIG = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true
};

/**
 * Sanitize HTML content with default configuration
 * Allows basic formatting tags while blocking XSS
 * 
 * @param {string} dirty - Unsanitized HTML string
 * @returns {string} Sanitized HTML string safe for rendering
 */
export const sanitizeHTML = (dirty) => {
  if (!dirty || typeof dirty !== 'string') {
    return '';
  }
  
  return DOMPurify.sanitize(dirty, DEFAULT_CONFIG);
};

/**
 * Sanitize to plain text only
 * Strips all HTML tags, returns only text content
 * 
 * @param {string} dirty - Unsanitized string
 * @returns {string} Plain text string
 */
export const sanitizeText = (dirty) => {
  if (!dirty || typeof dirty !== 'string') {
    return '';
  }
  
  return DOMPurify.sanitize(dirty, STRICT_CONFIG);
};

/**
 * Sanitize user bio
 * Allows line breaks but no other formatting
 * 
 * @param {string} bio - User bio text
 * @returns {string} Sanitized bio
 */
export const sanitizeBio = (bio) => {
  if (!bio || typeof bio !== 'string') {
    return '';
  }
  
  const config = {
    ALLOWED_TAGS: ['br'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  };
  
  return DOMPurify.sanitize(bio, config);
};

/**
 * Sanitize URL
 * Ensures URL is safe and doesn't contain javascript: or data: schemes
 * 
 * @param {string} url - URL to sanitize
 * @returns {string} Sanitized URL or empty string if unsafe
 */
export const sanitizeURL = (url) => {
  if (!url || typeof url !== 'string') {
    return '';
  }
  
  // Remove any whitespace
  url = url.trim();
  
  // Block dangerous protocols
  const dangerousProtocols = /^(javascript|data|vbscript|file|about):/i;
  if (dangerousProtocols.test(url)) {
    return '';
  }
  
  // Sanitize the URL
  const sanitized = DOMPurify.sanitize(url, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  });
  
  return sanitized;
};

/**
 * Sanitize post/comment content
 * Preserves line breaks and basic formatting
 * Converts URLs to clickable links (handled by FormattedText component)
 * 
 * @param {string} content - Post or comment content
 * @returns {string} Sanitized content
 */
export const sanitizeContent = (content) => {
  if (!content || typeof content !== 'string') {
    return '';
  }
  
  // Allow line breaks but strip all other HTML
  const config = {
    ALLOWED_TAGS: ['br'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  };
  
  return DOMPurify.sanitize(content, config);
};

/**
 * Sanitize message content
 * Similar to post content but more restrictive
 * 
 * @param {string} message - Message content
 * @returns {string} Sanitized message
 */
export const sanitizeMessage = (message) => {
  if (!message || typeof message !== 'string') {
    return '';
  }
  
  // Strip all HTML, keep only text
  return DOMPurify.sanitize(message, STRICT_CONFIG);
};

/**
 * Batch sanitize an object's string properties
 * Useful for sanitizing entire user objects or post objects
 * 
 * @param {Object} obj - Object with properties to sanitize
 * @param {Array<string>} fields - Array of field names to sanitize
 * @param {Function} sanitizer - Sanitization function to use (default: sanitizeText)
 * @returns {Object} Object with sanitized fields
 */
export const sanitizeObject = (obj, fields = [], sanitizer = sanitizeText) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  const sanitized = { ...obj };
  
  fields.forEach(field => {
    if (sanitized[field] && typeof sanitized[field] === 'string') {
      sanitized[field] = sanitizer(sanitized[field]);
    }
  });
  
  return sanitized;
};

export default {
  sanitizeHTML,
  sanitizeText,
  sanitizeBio,
  sanitizeURL,
  sanitizeContent,
  sanitizeMessage,
  sanitizeObject
};

