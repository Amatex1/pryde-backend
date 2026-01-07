import User from '../models/User.js';

// Default admin roles
const DEFAULT_ADMIN_ROLES = ['moderator', 'admin', 'super_admin'];

/**
 * Middleware factory to check if user has required admin role(s)
 *
 * Usage:
 *   adminAuth()                     - Any admin role (moderator, admin, super_admin)
 *   adminAuth(['admin', 'super_admin']) - Only admin or super_admin
 *   adminAuth                       - Legacy: used directly as middleware (any admin)
 *
 * @param {string[]} [allowedRoles] - Array of allowed roles (defaults to all admin roles)
 * @returns {Function} Express middleware function
 */
function adminAuth(allowedRoles = DEFAULT_ADMIN_ROLES) {
  // Check if being used directly as middleware (req object passed as first arg)
  if (typeof allowedRoles === 'object' && allowedRoles.headers) {
    // Direct usage as middleware - this is the actual middleware call
    // allowedRoles is actually the req object, and we need res and next from arguments
    const req = allowedRoles;
    const res = arguments[1];
    const next = arguments[2];
    return adminAuthMiddleware(DEFAULT_ADMIN_ROLES)(req, res, next);
  }
  // Factory mode: return middleware with specified roles
  return adminAuthMiddleware(allowedRoles);
}

/**
 * Internal middleware creator
 */
const adminAuthMiddleware = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      // Check if user has one of the allowed roles
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
      }
      // Attach user to request for use in routes
      req.adminUser = user;
      next();
    } catch (error) {
      console.error('Admin auth error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  };
};

/**
 * Middleware to check specific permissions
 */
const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const user = req.adminUser;
      if (!user) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      // Super admins have all permissions
      if (user.role === 'super_admin') {
        return next();
      }
      // Admins also have all permissions (like super_admin)
      if (user.role === 'admin') {
        return next();
      }
      // Check if user has the specific permission
      const hasPermission = user.permissions && user.permissions[permission];
      if (!hasPermission) {
        return res.status(403).json({ message: `Access denied. ${permission} permission required.` });
      }
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  };
};

export { adminAuth, checkPermission };
export default adminAuth;
