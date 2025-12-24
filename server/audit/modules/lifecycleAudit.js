/**
 * State & Lifecycle Audit Module
 * Validates application state management and lifecycle behavior
 */

import User from '../../models/User.js';
import logger from '../../utils/logger.js';

/**
 * Audit application lifecycle and state management
 * @returns {Object} Audit report
 */
export default async function runLifecycleAudit() {
  const report = {
    pass: 0,
    warn: 0,
    fail: 0,
    issues: [],
    details: {
      activeUsers: 0,
      deactivatedUsers: 0,
      deletedUsers: 0,
      bannedUsers: 0,
      suspendedUsers: 0,
      staleAccounts: 0,
    },
  };

  try {
    // Count users by state
    report.details.activeUsers = await User.countDocuments({
      isActive: true,
      isDeleted: false,
      isBanned: false,
    });

    report.details.deactivatedUsers = await User.countDocuments({
      isActive: false,
      isDeleted: false,
    });

    report.details.deletedUsers = await User.countDocuments({
      isDeleted: true,
    });

    report.details.bannedUsers = await User.countDocuments({
      isBanned: true,
    });

    report.details.suspendedUsers = await User.countDocuments({
      isSuspended: true,
      suspendedUntil: { $gt: new Date() },
    });

    report.pass++;

    // Check for stale accounts (created but never completed onboarding)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const staleAccounts = await User.countDocuments({
      onboardingCompleted: false,
      createdAt: { $lt: sixMonthsAgo },
      isDeleted: false,
    });

    report.details.staleAccounts = staleAccounts;

    if (staleAccounts > 100) {
      report.warn++;
      report.issues.push({
        type: 'stale_accounts',
        severity: 'low',
        count: staleAccounts,
        message: `Found ${staleAccounts} stale accounts (created >6 months ago, onboarding incomplete)`,
      });
    } else {
      report.pass++;
    }

    // Check for expired suspensions that should be cleared
    const expiredSuspensions = await User.countDocuments({
      isSuspended: true,
      suspendedUntil: { $lt: new Date() },
    });

    if (expiredSuspensions > 0) {
      report.warn++;
      report.issues.push({
        type: 'expired_suspensions',
        severity: 'medium',
        count: expiredSuspensions,
        message: `Found ${expiredSuspensions} users with expired suspensions that should be cleared`,
      });
    } else {
      report.pass++;
    }

    // Check for users with inconsistent state
    const inconsistentUsers = await User.countDocuments({
      isDeleted: true,
      isActive: true,
    });

    if (inconsistentUsers > 0) {
      report.fail++;
      report.issues.push({
        type: 'inconsistent_user_state',
        severity: 'high',
        count: inconsistentUsers,
        message: `Found ${inconsistentUsers} users marked as both deleted and active`,
      });
    } else {
      report.pass++;
    }

    logger.debug(`Lifecycle audit: ${report.pass} pass, ${report.warn} warn, ${report.fail} fail`);
  } catch (error) {
    logger.error('Lifecycle audit error:', error);
    report.fail++;
    report.issues.push({
      type: 'audit_error',
      severity: 'critical',
      message: `Lifecycle audit failed: ${error.message}`,
      error: error.stack,
    });
  }

  return report;
}

