import User from '../models/User.js';
import logger from '../utils/logger.js';

/**
 * Canonical role hierarchy (lowest → highest privilege)
 *   moderator  — content moderation only
 *   admin      — full platform management (all permissions)
 *   super_admin — all admin capabilities + destructive/system operations
 *
 * Usage:
 *   adminAuth()                          — any staff role (moderator/admin/super_admin)
 *   adminAuth(['admin', 'super_admin'])  — admin-level and above
 *   adminAuth(['super_admin'])           — super_admin only
 *
 * NOTE: always call as a factory adminAuth([...]) or adminAuth().
 * Direct usage as middleware (adminAuth without parens) is supported for
 * backward compatibility but adminAuth() is the preferred form.
 */

const ALL_ADMIN_ROLES = ['moderator', 'admin', 'super_admin'];

/**
 * Middleware factory — checks that the authenticated user has one of allowedRoles.
 * Requires auth middleware to have run first (req.userId must be set).
 *
 * @param {string[]} [allowedRoles] - Roles permitted. Defaults to ALL_ADMIN_ROLES.
 * @returns {Function} Express middleware
 */
function adminAuth(allowedRoles = ALL_ADMIN_ROLES) {
  // Backward-compat: detect direct Express middleware invocation (adminAuth used as middleware)
  if (allowedRoles && typeof allowedRoles === 'object' && allowedRoles.headers) {
    const req = allowedRoles;
    const res = arguments[1];  // eslint-disable-line prefer-rest-params
    const next = arguments[2]; // eslint-disable-line prefer-rest-params
    return _adminAuthMiddleware(ALL_ADMIN_ROLES)(req, res, next);
  }
  return _adminAuthMiddleware(allowedRoles);
}

const _adminAuthMiddleware = (allowedRoles) => async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Use req.adminUser if already populated by a parent router's adminAuth call
    const user = req.adminUser || await User.findById(userId).select('+permissions').lean();
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (!allowedRoles.includes(user.role)) {
      logger.warn('Admin access denied', {
        userId: user._id,
        role: user.role,
        requiredRoles: allowedRoles,
        path: req.path
      });
      return res.status(403).json({ message: 'Access denied. Insufficient role.' });
    }

    // Attach to request for downstream handlers
    req.adminUser = user;
    next();
  } catch (error) {
    logger.error('adminAuth error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Middleware factory — checks that req.adminUser has a specific named permission.
 * super_admin and admin bypass all named permission checks.
 * Must follow adminAuth() in middleware chain.
 *
 * @param {string} permission - Permission key on user.permissions (e.g. 'canViewReports')
 * @returns {Function} Express middleware
 */
const checkPermission = (permission) => async (req, res, next) => {
  try {
    const user = req.adminUser;
    if (!user) {
      return res.status(401).json({ message: 'Not authenticated as admin' });
    }

    // super_admin and admin have all permissions
    if (user.role === 'super_admin' || user.role === 'admin') {
      return next();
    }

    const hasPermission = user.permissions && user.permissions[permission] === true;
    if (!hasPermission) {
      logger.warn('Permission check failed', {
        userId: user._id,
        role: user.role,
        permission,
        path: req.path
      });
      return res.status(403).json({
        message: `Access denied. ${permission} permission required.`
      });
    }

    next();
  } catch (error) {
    logger.error('checkPermission error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

export { adminAuth, checkPermission };
export default adminAuth;
