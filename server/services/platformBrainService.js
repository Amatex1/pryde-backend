/**
 * platformBrainService.js
 *
 * Aggregates cross-cutting platform signals into a single snapshot
 * for the Platform Brain admin dashboard.
 *
 * Signals:
 *   - Community activity (posts, comments, new users in last 24 h)
 *   - Moderation queue (pending / reviewing reports)
 *   - Trust signals (unresolved security / minor-detection entries)
 *   - Discovery (trending post count from Redis)
 *   - Notifications (total sent in last 24 h, unread rate)
 */

import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import User from '../models/User.js';
import Report from '../models/Report.js';
import SecurityLog from '../models/SecurityLog.js';
import Notification from '../models/Notification.js';
import Session from '../models/Session.js';
import { getRedisClient, isRedisConnected } from '../utils/redisCache.js';
import { getFileScanStatus } from './fileScanService.js';
import logger from '../utils/logger.js';

const MINOR_SIGNAL_TYPES = ['underage_registration', 'underage_login'];

// Security event types tracked in the health panel
const SECURITY_EVENT_TYPES = [
  'refresh_token_reuse_detected',
  'session_family_revoked',
  'malware_detected_upload',
  'malware_scan_failed',
  'security_alert_triggered',
  'failed_login',
  'suspicious_activity',
];

/**
 * Returns a Date 24 hours before now.
 */
const since24h = () => new Date(Date.now() - 24 * 60 * 60 * 1000);

/**
 * Safe wrapper — returns 0 instead of throwing if a query fails.
 */
async function safeCount(promise) {
  try {
    return await promise;
  } catch (err) {
    logger.warn('[PlatformBrain] count query failed:', err.message);
    return 0;
  }
}

/**
 * Read the trending:day Redis sorted-set / key and return the number
 * of post IDs stored there. Gracefully returns null when Redis is unavailable.
 *
 * @returns {Promise<number|null>}
 */
async function getTrendingCount() {
  try {
    if (!isRedisConnected()) return null;
    const client = getRedisClient();
    if (!client) return null;

    // trending:day is stored as a sorted set (ZADD) by the feed cache
    const type = await client.type('trending:day');
    if (type === 'zset') {
      return await client.zcard('trending:day');
    }
    // Fallback: plain string key holding a JSON array
    if (type === 'string') {
      const raw = await client.get('trending:day');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length : null;
    }
    return null;
  } catch (err) {
    logger.warn('[PlatformBrain] Redis trending query failed:', err.message);
    return null;
  }
}

/**
 * Aggregate security event counts for the last 24 h and return a health panel.
 */
async function getSecurityHealthStats(cutoff) {
  try {
    const [eventCounts, highRiskSessions, fileScanStatus] = await Promise.all([
      // Count each security event type in the last 24 h using aggregation
      SecurityLog.aggregate([
        {
          $match: {
            type: { $in: SECURITY_EVENT_TYPES },
            createdAt: { $gte: cutoff },
          },
        },
        {
          $group: { _id: '$type', count: { $sum: 1 } },
        },
      ]).exec(),

      // Sessions with elevated risk score (anomalous activity signals)
      safeCount(Session.countDocuments({ isActive: true, riskScore: { $gte: 30 } })),

      // File scan posture (sync — no DB call)
      Promise.resolve(getFileScanStatus()),
    ]);

    // Convert array to a keyed object with 0 defaults
    const byType = {};
    for (const type of SECURITY_EVENT_TYPES) byType[type] = 0;
    for (const row of eventCounts) byType[row._id] = row.count;

    return {
      last24h: byType,
      highRiskActiveSessions: highRiskSessions,
      fileScan: fileScanStatus,
    };
  } catch (err) {
    logger.warn('[PlatformBrain] securityHealth query failed:', err.message);
    return null;
  }
}

/**
 * getPlatformBrainStats
 *
 * Runs all signal queries in parallel and returns an aggregated snapshot.
 *
 * @returns {Promise<object>}
 */
export async function getPlatformBrainStats() {
  const cutoff = since24h();

  const [
    postsLast24h,
    commentsLast24h,
    newUsersLast24h,
    pendingReports,
    reviewingReports,
    minorSignals,
    totalUsers,
    activeUsers,
    notificationsSent24h,
    unreadNotifications,
    trendingCount,
    securityHealth,
  ] = await Promise.all([
    // Community activity
    safeCount(Post.countDocuments({ createdAt: { $gte: cutoff } })),
    safeCount(Comment.countDocuments({ createdAt: { $gte: cutoff } })),
    safeCount(User.countDocuments({ createdAt: { $gte: cutoff } })),

    // Moderation queue
    safeCount(Report.countDocuments({ status: 'pending' })),
    safeCount(Report.countDocuments({ status: 'reviewing' })),

    // Trust signals — unresolved minor-detection entries
    safeCount(
      SecurityLog.countDocuments({
        type: { $in: MINOR_SIGNAL_TYPES },
        resolved: { $ne: true },
      })
    ),

    // User totals for context
    safeCount(User.countDocuments({ isActive: true, isBanned: { $ne: true } })),
    safeCount(
      User.countDocuments({
        isActive: true,
        isBanned: { $ne: true },
        isSuspended: { $ne: true },
      })
    ),

    // Notification metrics
    safeCount(Notification.countDocuments({ createdAt: { $gte: cutoff } })),
    safeCount(Notification.countDocuments({ read: false })),

    // Discovery — Redis
    getTrendingCount(),

    // Security health panel
    getSecurityHealthStats(cutoff),
  ]);

  return {
    generatedAt: new Date().toISOString(),

    communityActivity: {
      postsLast24h,
      commentsLast24h,
      newUsersLast24h,
    },

    feedIntelligence: {
      trendingPostCount: trendingCount,
      redisConnected: isRedisConnected(),
    },

    moderationSignals: {
      pendingReports,
      reviewingReports,
      totalQueued: pendingReports + reviewingReports,
    },

    trustSignals: {
      unresolvedMinorSignals: minorSignals,
    },

    discovery: {
      trendingPostCount: trendingCount,
    },

    notifications: {
      sentLast24h: notificationsSent24h,
      currentlyUnread: unreadNotifications,
    },

    platform: {
      totalActiveUsers: totalUsers,
      nonSuspendedUsers: activeUsers,
    },

    securityHealth,
  };
}
