import { body, param, query, validationResult } from 'express-validator';

/**
 * Input validation middleware using express-validator
 * Provides comprehensive validation for all user inputs
 */

/**
 * Middleware to handle validation errors
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg
      }))
    });
  }
  next();
};

/**
 * Auth validation rules
 */
export const validateSignup = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  
  body('email')
    .trim()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 12 })
    .withMessage('Password must be at least 12 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/])/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&#^()_+-=[]{};\':"\\|,.<>/)'),
  
  body('birthday')
    .isISO8601()
    .withMessage('Birthday must be a valid date'),
  
  handleValidationErrors
];

export const validateLogin = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

/**
 * Post validation rules
 */
export const validatePost = [
  body('content')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Post content must not exceed 5000 characters'),
  
  body('visibility')
    .optional()
    .isIn(['public', 'friends', 'private', 'custom'])
    .withMessage('Invalid visibility setting'),
  
  handleValidationErrors
];

export const validateComment = [
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Comment content is required')
    .isLength({ max: 2000 })
    .withMessage('Comment must not exceed 2000 characters'),
  
  handleValidationErrors
];

/**
 * Message validation rules
 */
export const validateMessage = [
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Message content is required')
    .isLength({ max: 5000 })
    .withMessage('Message must not exceed 5000 characters'),
  
  body('recipient')
    .optional()
    .isMongoId()
    .withMessage('Invalid recipient ID'),
  
  handleValidationErrors
];

/**
 * User profile validation rules
 */
export const validateProfileUpdate = [
  body('displayName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Display name must be between 1 and 50 characters'),
  
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio must not exceed 500 characters'),
  
  body('location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Location must not exceed 100 characters'),
  
  body('website')
    .optional()
    .trim()
    .isURL()
    .withMessage('Must be a valid URL'),
  
  handleValidationErrors
];

/**
 * ID parameter validation
 */
export const validateMongoId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
  
  handleValidationErrors
];

/**
 * Pagination validation
 */
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors
];

export default {
  handleValidationErrors,
  validateSignup,
  validateLogin,
  validatePost,
  validateComment,
  validateMessage,
  validateProfileUpdate,
  validateMongoId,
  validatePagination
};

