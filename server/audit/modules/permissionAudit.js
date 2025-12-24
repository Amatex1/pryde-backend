/**
 * Role & Permission Audit Module
 * Validates role-based permissions and access control
 */

import { ROLE_MATRIX, ROLES } from '../../config/roles.js';
import User from '../../models/User.js';
import logger from '../../utils/logger.js';

/**
 * Audit role and permission configuration
 * @returns {Object} Audit report
 */
export default async function runPermissionAudit() {
  const report = {
    pass: 0,
    warn: 0,
    fail: 0,
    issues: [],
    details: {
      usersAudited: 0,
      roleDistribution: {},
      permissionMismatches: 0,
    },
  };

  try {
    // Initialize role distribution
    for (const role of ROLES) {
      report.details.roleDistribution[role] = 0;
    }

    // Fetch all users
    const users = await User.find({ isDeleted: false })
      .select('_id username role permissions');

    report.details.usersAudited = users.length;

    for (const user of users) {
      // Check if role is valid
      if (!ROLES.includes(user.role)) {
        report.fail++;
        report.issues.push({
          type: 'invalid_role',
          severity: 'critical',
          user: user._id,
          username: user.username,
          role: user.role,
          message: `User has invalid role: ${user.role}`,
        });
        continue;
      }

      // Count role distribution
      report.details.roleDistribution[user.role]++;

      // Get expected permissions for this role
      const expectedPerms = ROLE_MATRIX[user.role];
      if (!expectedPerms) {
        report.fail++;
        report.issues.push({
          type: 'missing_role_matrix',
          severity: 'critical',
          user: user._id,
          username: user.username,
          role: user.role,
          message: `No permission matrix found for role: ${user.role}`,
        });
        continue;
      }

      // Validate permission flags
      const permissionFlags = [
        'canViewReports',
        'canResolveReports',
        'canManageUsers',
        'canViewAnalytics',
        'canManageAdmins',
      ];

      let hasPermissionMismatch = false;

      for (const flag of permissionFlags) {
        const expected = expectedPerms[flag];
        const actual = user.permissions?.[flag];

        if (expected !== actual) {
          hasPermissionMismatch = true;
          report.warn++;
          report.details.permissionMismatches++;
          report.issues.push({
            type: 'permission_mismatch',
            severity: 'medium',
            user: user._id,
            username: user.username,
            role: user.role,
            permission: flag,
            expected: expected,
            actual: actual,
            message: `Permission '${flag}' mismatch for ${user.role}: expected ${expected}, got ${actual}`,
          });
        }
      }

      if (!hasPermissionMismatch) {
        report.pass++;
      }
    }

    // Check for role matrix completeness
    for (const role of ROLES) {
      if (!ROLE_MATRIX[role]) {
        report.fail++;
        report.issues.push({
          type: 'incomplete_role_matrix',
          severity: 'high',
          role: role,
          message: `Role matrix missing definition for: ${role}`,
        });
      }
    }

    logger.debug(`Permission audit: ${report.pass} pass, ${report.warn} warn, ${report.fail} fail`);
  } catch (error) {
    logger.error('Permission audit error:', error);
    report.fail++;
    report.issues.push({
      type: 'audit_error',
      severity: 'critical',
      message: `Permission audit failed: ${error.message}`,
      error: error.stack,
    });
  }

  return report;
}

