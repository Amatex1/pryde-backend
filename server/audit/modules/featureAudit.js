/**
 * Feature Availability Audit Module
 * Validates feature access across different user states and roles
 */

import * as featureCapability from '../../utils/featureCapability.js';
import User from '../../models/User.js';
import logger from '../../utils/logger.js';

/**
 * Audit feature availability for users
 * @returns {Object} Audit report
 */
export default async function runFeatureAudit() {
  const report = {
    pass: 0,
    warn: 0,
    fail: 0,
    issues: [],
    details: {
      usersAudited: 0,
      featuresChecked: 0,
      blockedUsers: 0,
      activeUsers: 0,
    },
  };

  try {
    // Sample users from different states
    const users = await User.find({ isDeleted: false })
      .limit(50)
      .select('_id username role isActive isBanned isSuspended suspendedUntil emailVerified moderation');

    report.details.usersAudited = users.length;

    const features = [
      { name: 'post', fn: featureCapability.canPost },
      { name: 'comment', fn: featureCapability.canReply },
      { name: 'reply', fn: featureCapability.canReply },
      { name: 'message', fn: featureCapability.canMessage },
      { name: 'upload', fn: featureCapability.canUploadMedia },
      { name: 'chat', fn: featureCapability.canChat },
    ];

    for (const user of users) {
      // Track user state
      if (user.isActive && !user.isBanned && !user.isSuspended) {
        report.details.activeUsers++;
      } else {
        report.details.blockedUsers++;
      }

      for (const feature of features) {
        report.details.featuresChecked++;
        
        const result = feature.fn(user);
        const allowed = result.allowed;

        // For active, non-banned regular users, all features should be allowed
        if (user.role === 'user' && user.isActive && !user.isBanned && !user.isSuspended) {
          if (allowed === false) {
            report.fail++;
            report.issues.push({
              type: 'feature_blocked_unexpectedly',
              severity: 'high',
              user: user._id,
              username: user.username,
              feature: feature.name,
              message: `Feature '${feature.name}' blocked for active user`,
              reasons: result.reasons || [],
            });
          } else {
            report.pass++;
          }
        } else {
          // For banned/suspended users, features should be blocked
          if (user.isBanned || user.isSuspended) {
            if (allowed === true) {
              report.warn++;
              report.issues.push({
                type: 'feature_allowed_unexpectedly',
                severity: 'medium',
                user: user._id,
                username: user.username,
                feature: feature.name,
                message: `Feature '${feature.name}' allowed for banned/suspended user`,
              });
            } else {
              report.pass++;
            }
          } else {
            // Inactive users
            report.pass++;
          }
        }
      }
    }

    logger.debug(`Feature audit: ${report.pass} pass, ${report.warn} warn, ${report.fail} fail`);
  } catch (error) {
    logger.error('Feature audit error:', error);
    report.fail++;
    report.issues.push({
      type: 'audit_error',
      severity: 'critical',
      message: `Feature audit failed: ${error.message}`,
      error: error.stack,
    });
  }

  return report;
}

