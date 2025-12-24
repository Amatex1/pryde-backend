/**
 * Token Consistency Checker
 * Validates JWT tokens against current user state
 * Detects stale tokens, missing claims, and permission mismatches
 */

import { verifyAccessToken } from './tokenUtils.js';
import User from '../models/User.js';
import logger from './logger.js';

/**
 * Check if a JWT token is consistent with current user state
 * @param {string} token - JWT access token
 * @returns {Object} Consistency report
 */
export const checkTokenConsistency = async (token) => {
  const issues = [];
  const warnings = [];

  try {
    // Verify and decode token
    const decoded = verifyAccessToken(token);

    if (!decoded || !decoded.userId) {
      return {
        valid: false,
        issues: ['Invalid token or missing userId claim'],
        warnings: []
      };
    }

    // Fetch current user state
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return {
        valid: false,
        issues: ['User not found in database'],
        warnings: []
      };
    }

    // Check critical state mismatches
    if (user.isDeleted) {
      issues.push('Token belongs to deleted user');
    }

    if (user.isBanned) {
      issues.push('Token belongs to banned user');
    }

    if (!user.isActive) {
      issues.push('Token belongs to deactivated user');
    }

    if (user.isSuspended && user.suspendedUntil > new Date()) {
      issues.push(`Token belongs to suspended user (until ${user.suspendedUntil.toISOString()})`);
    }

    // Check session validity
    if (decoded.sessionId) {
      const sessionExists = user.activeSessions?.some(
        s => s.sessionId === decoded.sessionId
      );

      if (!sessionExists) {
        issues.push('Session has been logged out');
      }
    } else {
      warnings.push('Token missing sessionId claim (old token format)');
    }

    // Check role consistency
    if (decoded.role && decoded.role !== user.role) {
      issues.push(`Role mismatch: token has '${decoded.role}', user has '${user.role}'`);
    }

    // Check if token is too old (potential stale permissions)
    const tokenAge = Date.now() - (decoded.iat * 1000);
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    if (tokenAge > maxAge) {
      warnings.push(`Token is ${Math.floor(tokenAge / (24 * 60 * 60 * 1000))} days old - consider refresh`);
    }

    // Check email verification status
    if (!user.emailVerified) {
      warnings.push('Email not verified');
    }

    // Check moderation status
    if (user.moderation?.isMuted && user.moderation?.muteExpires > new Date()) {
      warnings.push(`User is muted until ${user.moderation.muteExpires.toISOString()}`);
    }

    return {
      valid: issues.length === 0,
      userId: user._id,
      username: user.username,
      tokenAge: Math.floor(tokenAge / (60 * 1000)), // in minutes
      issues,
      warnings,
      userState: {
        isActive: user.isActive,
        isDeleted: user.isDeleted,
        isBanned: user.isBanned,
        isSuspended: user.isSuspended,
        emailVerified: user.emailVerified,
        role: user.role
      }
    };

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return {
        valid: false,
        issues: ['Token has expired'],
        warnings: []
      };
    }

    if (error.name === 'JsonWebTokenError') {
      return {
        valid: false,
        issues: ['Invalid token signature'],
        warnings: []
      };
    }

    logger.error('Token consistency check error:', error);
    return {
      valid: false,
      issues: [`Token validation error: ${error.message}`],
      warnings: []
    };
  }
};

/**
 * Audit all active sessions for a user
 * @param {string} userId - User ID
 * @returns {Object} Session audit report
 */
export const auditUserSessions = async (userId) => {
  try {
    const user = await User.findById(userId).select('activeSessions username');

    if (!user) {
      return {
        error: 'User not found'
      };
    }

    const sessionReports = [];

    for (const session of user.activeSessions || []) {
      sessionReports.push({
        sessionId: session.sessionId,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        userAgent: session.userAgent,
        ipAddress: session.ipAddress
      });
    }

    return {
      username: user.username,
      totalSessions: sessionReports.length,
      sessions: sessionReports
    };

  } catch (error) {
    logger.error('Session audit error:', error);
    return {
      error: error.message
    };
  }
};

