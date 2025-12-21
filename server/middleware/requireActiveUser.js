/**
 * requireActiveUser.js
 * Middleware that blocks deactivated users from accessing protected app routes
 * 
 * Use AFTER auth middleware on routes that should block deactivated users
 * 
 * Routes that should use this:
 * - posts, feed, comments, reactions, messages, follow, bookmarks, notifications
 * 
 * Routes that should NOT use this:
 * - /api/users/reactivate
 * - /api/auth/logout
 * - /api/auth/login
 * - /api/auth/refresh
 */

export default function requireActiveUser(req, res, next) {
  // req.user is set by auth middleware
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Block deactivated users from accessing protected routes
  if (!req.user.isActive) {
    return res.status(403).json({
      code: 'ACCOUNT_DEACTIVATED',
      message: 'Account is deactivated'
    });
  }

  next();
}

