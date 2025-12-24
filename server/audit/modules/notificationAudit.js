/**
 * Notification System Audit Module
 * Validates notification delivery, preferences, and system health
 */

import User from '../../models/User.js';
import Notification from '../../models/Notification.js';
import logger from '../../utils/logger.js';

/**
 * Audit notification system
 * @returns {Object} Audit report
 */
export default async function runNotificationAudit() {
  const report = {
    pass: 0,
    warn: 0,
    fail: 0,
    issues: [],
    details: {
      totalNotifications: 0,
      unreadNotifications: 0,
      usersWithPushEnabled: 0,
      orphanedNotifications: 0,
    },
  };

  try {
    // Check notification counts
    const totalNotifications = await Notification.countDocuments();
    const unreadNotifications = await Notification.countDocuments({ read: false });
    
    report.details.totalNotifications = totalNotifications;
    report.details.unreadNotifications = unreadNotifications;
    report.pass++;

    // Check for orphaned notifications (user doesn't exist)
    const notifications = await Notification.find().limit(100).select('recipient');
    let orphanedCount = 0;

    for (const notification of notifications) {
      const userExists = await User.exists({ _id: notification.recipient });
      if (!userExists) {
        orphanedCount++;
      }
    }

    report.details.orphanedNotifications = orphanedCount;
    
    if (orphanedCount > 0) {
      report.warn++;
      report.issues.push({
        type: 'orphaned_notifications',
        severity: 'medium',
        count: orphanedCount,
        message: `Found ${orphanedCount} notifications for non-existent users`,
      });
    } else {
      report.pass++;
    }

    // Check push notification configuration
    const usersWithPush = await User.countDocuments({
      'pushSubscription': { $exists: true, $ne: null }
    });
    
    report.details.usersWithPushEnabled = usersWithPush;
    report.pass++;

    // Check notification preferences
    const usersWithPreferences = await User.countDocuments({
      'notificationPreferences': { $exists: true }
    });

    if (usersWithPreferences > 0) {
      report.pass++;
    } else {
      report.warn++;
      report.issues.push({
        type: 'missing_notification_preferences',
        severity: 'low',
        message: 'No users have notification preferences configured',
      });
    }

    logger.debug(`Notification audit: ${report.pass} pass, ${report.warn} warn, ${report.fail} fail`);
  } catch (error) {
    logger.error('Notification audit error:', error);
    report.fail++;
    report.issues.push({
      type: 'audit_error',
      severity: 'critical',
      message: `Notification audit failed: ${error.message}`,
      error: error.stack,
    });
  }

  return report;
}

