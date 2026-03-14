import express from 'express';
const router = express.Router();
import auth from '../middleware/auth.js';
import SecurityLog from '../models/SecurityLog.js';
import logger from '../utils/logger.js';

// Safe event types that are meaningful to an end-user
const USER_VISIBLE_TYPES = [
  'login_success',
  'login_failed',
  'failed_login',
  'logout',
  'password_changed',
  'email_changed',
  'email_verified',
  'two_factor_enabled',
  'two_factor_disabled',
  'account_locked',
  'account_unlocked',
  'suspicious_activity',
  'session_revoked',
  'passkey_added',
  'passkey_removed'
];

/**
 * GET /api/user/security-logs
 * Returns the authenticated user's own security activity log.
 * @access Private
 */
router.get('/security-logs', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    // Optional: filter by event type
    const query = {
      userId: req.userId,
      type: { $in: USER_VISIBLE_TYPES }
    };

    if (req.query.type && USER_VISIBLE_TYPES.includes(req.query.type)) {
      query.type = req.query.type;
    }

    const [logs, total] = await Promise.all([
      SecurityLog.find(query)
        .select('type severity ipAddress userAgent details action createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SecurityLog.countDocuments(query)
    ]);

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: skip + limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    logger.error('User security logs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/user/security-logs/summary
 * Returns a quick summary: last login, failed attempts in last 30 days, active sessions count.
 * @access Private
 */
router.get('/security-logs/summary', auth, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [lastLogin, recentFailures, recentSuspicious] = await Promise.all([
      SecurityLog.findOne({ userId: req.userId, type: 'login_success' })
        .sort({ createdAt: -1 })
        .select('ipAddress userAgent createdAt')
        .lean(),
      SecurityLog.countDocuments({
        userId: req.userId,
        type: { $in: ['failed_login', 'login_failed'] },
        createdAt: { $gte: thirtyDaysAgo }
      }),
      SecurityLog.countDocuments({
        userId: req.userId,
        type: 'suspicious_activity',
        createdAt: { $gte: thirtyDaysAgo }
      })
    ]);

    res.json({
      lastLogin,
      last30Days: {
        failedLoginAttempts: recentFailures,
        suspiciousEvents: recentSuspicious
      },
      recommendation: recentFailures > 5 || recentSuspicious > 0
        ? 'We noticed unusual activity. Consider changing your password and enabling 2FA.'
        : null
    });
  } catch (error) {
    logger.error('Security logs summary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
