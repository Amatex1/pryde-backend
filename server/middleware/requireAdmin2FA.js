import logger from '../utils/logger.js';

/**
 * Middleware: Require 2FA for admin dashboard access
 * Allows login but blocks /api/admin/* routes unless 2FA enabled
 * Roles: super_admin, admin, moderator
 */
const requireAdmin2FA = (req, res, next) => {
  // Skip if no user (public endpoints)
  if (!req.user) {
    return next();
  }

  const adminRoles = ['super_admin', 'admin', 'moderator'];
  
  // Only enforce for admin roles
  if (!adminRoles.includes(req.user.role)) {
    return next();
  }

  // Check if user has ANY 2FA enabled
  if (req.user.twoFactorEnabled || req.user.pushTwoFactorEnabled) {
    logger.debug(`✅ 2FA OK: ${req.user.username} (${req.user.role}) → ${req.path}`);
    return next();
  }

  // 2FA required but not enabled → Block admin access
  logger.warn(`🚫 2FA BLOCK: ${req.user.username} (${req.user.role}) → ${req.path}`);
  
  return res.status(403).json({
    success: false,
    code: 'ADMIN_2FA_REQUIRED',
    message: 'Admin accounts must enable two-factor authentication before accessing the admin dashboard.',
    requiredRoles: adminRoles,
    user2FAStatus: {
      twoFactorEnabled: req.user.twoFactorEnabled,
      pushTwoFactorEnabled: req.user.pushTwoFactorEnabled
    },
    setupPath: '/twoFactor/setup'
  });
};

export default requireAdmin2FA;

