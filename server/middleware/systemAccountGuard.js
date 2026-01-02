/**
 * System Account Guard Middleware
 * 
 * Enforces strict behavioral limits for system accounts.
 * System accounts must NEVER:
 * - Pretend to be human
 * - Share personal stories or opinions
 * - Express emotions (e.g. "I'm proud of you", "That sounds hard")
 * - Engage in arguments or debates
 * - React to user content with praise or validation
 * - Attempt to drive engagement
 * - Simulate conversation
 * - Post frequently or dominate the feed
 * - Send unsolicited DMs
 * - Replace human moderation judgment
 * 
 * This middleware prevents system accounts from performing unauthorized actions.
 */

import User from '../models/User.js';
import logger from '../utils/logger.js';

// ============================================================================
// ROLE-BASED PERMISSION MATRIX
// Defines what each system role can and cannot do
// ============================================================================

const SYSTEM_ROLE_PERMISSIONS = {
  PROMPTS: {
    canCreatePosts: true,
    canComment: false,
    canReply: false,
    canReact: false,
    canSendDM: false,
    canJoinGroups: false,
    canFollow: false,
    description: 'Scheduled prompt posts only'
  },
  GUIDE: {
    canCreatePosts: true,
    canComment: true, // Only predefined informational responses
    canReply: true,   // Only predefined informational responses
    canReact: false,
    canSendDM: false,
    canJoinGroups: false,
    canFollow: false,
    description: 'Onboarding guidance and info responses'
  },
  MODERATION: {
    canCreatePosts: true,
    canComment: true, // Moderation notices only
    canReply: false,
    canReact: false,
    canSendDM: false,
    canJoinGroups: false,
    canFollow: false,
    description: 'Moderation notices and policy updates'
  },
  ANNOUNCEMENTS: {
    canCreatePosts: true,
    canComment: false,
    canReply: false,
    canReact: false,
    canSendDM: false,
    canJoinGroups: false,
    canFollow: false,
    description: 'Rare platform announcements only'
  }
};

/**
 * Check if user is a system account
 */
export function isSystemAccount(user) {
  return user?.isSystemAccount === true;
}

/**
 * Get permissions for a system role
 */
export function getSystemRolePermissions(role) {
  return SYSTEM_ROLE_PERMISSIONS[role] || null;
}

/**
 * Guard middleware factory - blocks system accounts from specific actions
 * 
 * @param {string} action - The action to guard (createPost, comment, reply, react, sendDM, etc.)
 * @returns {Function} Express middleware
 */
export function guardSystemAccountAction(action) {
  return async (req, res, next) => {
    try {
      const userId = req.userId || req.user?._id;
      if (!userId) return next();
      
      // Fetch user with system fields
      const user = await User.findById(userId).select('isSystemAccount systemRole username');
      
      if (!user || !user.isSystemAccount) {
        return next(); // Regular users pass through
      }
      
      const permissions = SYSTEM_ROLE_PERMISSIONS[user.systemRole];
      
      if (!permissions) {
        logger.warn(`System account ${user.username} has no valid systemRole`);
        return res.status(403).json({
          message: 'System account has invalid configuration',
          code: 'SYSTEM_ACCOUNT_INVALID_ROLE'
        });
      }
      
      // Check if action is allowed for this role
      const permissionKey = `can${action.charAt(0).toUpperCase() + action.slice(1)}`;
      
      if (!permissions[permissionKey]) {
        logger.info(`System account ${user.username} blocked from action: ${action}`);
        return res.status(403).json({
          message: `System accounts with role ${user.systemRole} cannot perform this action`,
          code: 'SYSTEM_ACCOUNT_ACTION_DENIED',
          action,
          role: user.systemRole
        });
      }
      
      // Mark request as from system account (for logging/auditing)
      req.isSystemAccountRequest = true;
      req.systemAccountRole = user.systemRole;
      
      next();
    } catch (error) {
      logger.error('System account guard error:', error);
      next(error);
    }
  };
}

// Pre-configured guards for common actions
export const guardComment = guardSystemAccountAction('comment');
export const guardReply = guardSystemAccountAction('reply');
export const guardReact = guardSystemAccountAction('react');
export const guardSendDM = guardSystemAccountAction('sendDM');
export const guardFollow = guardSystemAccountAction('follow');
export const guardJoinGroups = guardSystemAccountAction('joinGroups');

export default {
  isSystemAccount,
  getSystemRolePermissions,
  guardSystemAccountAction,
  guardComment,
  guardReply,
  guardReact,
  guardSendDM,
  guardFollow,
  guardJoinGroups,
  SYSTEM_ROLE_PERMISSIONS
};

