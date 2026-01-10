import AdminEscalationToken from '../models/AdminEscalationToken.js';
import logger from '../utils/logger.js';

/**
 * Middleware to require admin escalation for privileged actions
 * 
 * PURPOSE: Privileged Admin Escalation
 * Sensitive admin actions (posting as system accounts, bans, deletes, policy changes)
 * require a second factor (Passkey/WebAuthn preferred; TOTP fallback) even if the
 * attacker has Mat's password/session cookie.
 * 
 * SECURITY: A compromised Mat session must NOT be enough to use /admin powers.
 * 
 * PRIVILEGED ACTIONS:
 * - Post as system account (pryde_announcements, pryde_safety, etc.)
 * - Ban/unban users
 * - Delete users/posts globally
 * - Role changes (assign Admin/Moderator/Super Admin)
 * - Security settings changes
 * - API keys / webhook config (if any)
 * 
 * NON-PRIVILEGED ACTIONS:
 * - Viewing /admin dashboards
 * - Viewing reports
 * - Viewing analytics
 * - Viewing user lists
 * 
 * USAGE:
 * Apply this middleware ONLY to privileged routes:
 * 
 * router.post('/api/admin/posts', auth, adminAuth, requireAdminEscalation, ...)
 * router.put('/api/admin/users/:id/ban', auth, adminAuth, checkPermission('canManageUsers'), requireAdminEscalation, ...)
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const requireAdminEscalation = async (req, res, next) => {
  try {
    // User must be authenticated
    if (!req.user || !req.userId) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }
    
    // User must be admin or super_admin
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Admin access required',
        code: 'ADMIN_ACCESS_REQUIRED'
      });
    }
    
    // Get escalation token from cookie
    const token = req.cookies?.pryde_admin_escalated;
    
    if (!token) {
      logger.warn(`Admin ${req.user.username} attempted privileged action without escalation`);
      return res.status(403).json({ 
        message: 'Admin escalation required for this action',
        code: 'ADMIN_ESCALATION_REQUIRED',
        hint: 'Please unlock admin actions using passkey or TOTP'
      });
    }
    
    // Verify token
    const escalationToken = await AdminEscalationToken.verifyToken(
      token,
      req.userId,
      req.sessionId
    );
    
    if (!escalationToken) {
      logger.warn(`Admin ${req.user.username} attempted privileged action with invalid/expired escalation token`);
      
      // Clear invalid cookie
      res.clearCookie('pryde_admin_escalated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/'
      });
      
      return res.status(403).json({ 
        message: 'Admin escalation expired or invalid',
        code: 'ADMIN_ESCALATION_REQUIRED',
        hint: 'Please unlock admin actions again using passkey or TOTP'
      });
    }
    
    // Optional: Bind token to IP (best effort; avoid false positives on mobile)
    // Disabled by default to avoid issues with mobile networks and VPNs
    // Uncomment if you want strict IP binding:
    /*
    const currentIp = getClientIp(req);
    if (escalationToken.ipAddress !== currentIp) {
      logger.warn(`Admin ${req.user.username} escalation token IP mismatch: ${escalationToken.ipAddress} vs ${currentIp}`);
      return res.status(403).json({ 
        message: 'Admin escalation IP mismatch',
        code: 'ADMIN_ESCALATION_REQUIRED',
        hint: 'Please unlock admin actions again from this device'
      });
    }
    */
    
    // Attach escalation info to request for logging
    req.adminEscalation = {
      method: escalationToken.method,
      issuedAt: escalationToken.issuedAt,
      expiresAt: escalationToken.expiresAt
    };
    
    logger.debug(`Admin ${req.user.username} privileged action authorized (escalation: ${escalationToken.method})`);
    
    next();
  } catch (error) {
    logger.error('Admin escalation middleware error:', error);
    res.status(500).json({ 
      message: 'Server error during escalation check',
      code: 'SERVER_ERROR'
    });
  }
};

export default requireAdminEscalation;

