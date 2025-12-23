/**
 * Audit Routes
 * Admin-only endpoints for user capability auditing
 */

import express from 'express';
const router = express.Router();
import User from '../models/User.js';
import auth from '../middleware/auth.js';
import adminAuth from '../middleware/adminAuth.js';
import { getUserCapabilities } from '../utils/featureCapability.js';
import { checkTokenConsistency, auditUserSessions } from '../utils/tokenConsistency.js';
import { getBlockedAttempts, clearBlockedAttempts } from '../middleware/featureGuard.js';
import logger from '../utils/logger.js';

/**
 * @route   GET /api/audit/users
 * @desc    Audit all users and generate capability report
 * @access  Admin only
 */
router.get('/users', auth, adminAuth, async (req, res) => {
  try {
    logger.info('Starting user capability audit...');

    // Fetch all users (excluding password)
    const users = await User.find({}).select('-password').lean();

    const results = {
      totalUsers: users.length,
      fullyFunctional: [],
      partiallyBlocked: [],
      fullyBlocked: [],
      blockingReasons: {},
      timestamp: new Date().toISOString()
    };

    // Audit each user
    for (const user of users) {
      const report = getUserCapabilities(user);
      
      // Count blocked features
      const capabilities = report.capabilities;
      const blockedFeatures = [];
      const allReasons = new Set();

      Object.entries(capabilities).forEach(([feature, result]) => {
        if (!result.allowed) {
          blockedFeatures.push(feature);
          result.reasons.forEach(reason => allReasons.add(reason));
        }
      });

      // Track blocking reasons frequency
      allReasons.forEach(reason => {
        results.blockingReasons[reason] = (results.blockingReasons[reason] || 0) + 1;
      });

      // Categorize user
      const userSummary = {
        userId: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        blockedFeatures,
        blockedReasons: Array.from(allReasons),
        accountState: report.accountState,
        capabilities: report.capabilities
      };

      if (blockedFeatures.length === 0) {
        results.fullyFunctional.push(userSummary);
      } else if (blockedFeatures.length === Object.keys(capabilities).length) {
        results.fullyBlocked.push(userSummary);
      } else {
        results.partiallyBlocked.push(userSummary);
      }
    }

    // Generate summary statistics
    const summary = {
      total: results.totalUsers,
      fullyFunctional: results.fullyFunctional.length,
      partiallyBlocked: results.partiallyBlocked.length,
      fullyBlocked: results.fullyBlocked.length,
      percentageFunctional: ((results.fullyFunctional.length / results.totalUsers) * 100).toFixed(1),
      percentagePartiallyBlocked: ((results.partiallyBlocked.length / results.totalUsers) * 100).toFixed(1),
      percentageFullyBlocked: ((results.fullyBlocked.length / results.totalUsers) * 100).toFixed(1)
    };

    // Sort blocking reasons by frequency
    const topBlockingReasons = Object.entries(results.blockingReasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([reason, count]) => ({ reason, count }));

    logger.info('User capability audit complete', { summary });

    res.json({
      summary,
      topBlockingReasons,
      fullyFunctional: results.fullyFunctional.slice(0, 100), // Limit to first 100
      partiallyBlocked: results.partiallyBlocked,
      fullyBlocked: results.fullyBlocked,
      timestamp: results.timestamp
    });

  } catch (error) {
    logger.error('User audit error:', error);
    res.status(500).json({ message: 'Audit failed', error: error.message });
  }
});

/**
 * @route   GET /api/audit/user/:userId
 * @desc    Get detailed capability report for a specific user
 * @access  Admin only
 */
router.get('/user/:userId', auth, adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const report = getUserCapabilities(user);
    const sessionAudit = await auditUserSessions(user._id);

    res.json({
      ...report,
      sessions: sessionAudit
    });

  } catch (error) {
    logger.error('User capability check error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/audit/token
 * @desc    Check token consistency
 * @access  Admin only
 */
router.post('/token', auth, adminAuth, async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Token required' });
    }

    const consistency = await checkTokenConsistency(token);
    res.json(consistency);

  } catch (error) {
    logger.error('Token consistency check error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/audit/blocked-attempts
 * @desc    Get log of blocked feature attempts
 * @access  Admin only
 */
router.get('/blocked-attempts', auth, adminAuth, async (req, res) => {
  try {
    const attempts = getBlockedAttempts();

    // Group by user
    const byUser = {};
    attempts.forEach(attempt => {
      if (!byUser[attempt.username]) {
        byUser[attempt.username] = [];
      }
      byUser[attempt.username].push(attempt);
    });

    // Group by feature
    const byFeature = {};
    attempts.forEach(attempt => {
      if (!byFeature[attempt.feature]) {
        byFeature[attempt.feature] = [];
      }
      byFeature[attempt.feature].push(attempt);
    });

    // Get most common blocking reasons
    const reasonCounts = {};
    attempts.forEach(attempt => {
      attempt.reasons.forEach(reason => {
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      });
    });

    const topReasons = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([reason, count]) => ({ reason, count }));

    res.json({
      total: attempts.length,
      recentAttempts: attempts.slice(0, 50),
      byUser: Object.keys(byUser).map(username => ({
        username,
        count: byUser[username].length,
        attempts: byUser[username].slice(0, 5)
      })),
      byFeature: Object.keys(byFeature).map(feature => ({
        feature,
        count: byFeature[feature].length
      })),
      topReasons
    });

  } catch (error) {
    logger.error('Blocked attempts fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   DELETE /api/audit/blocked-attempts
 * @desc    Clear blocked attempts log
 * @access  Admin only
 */
router.delete('/blocked-attempts', auth, adminAuth, async (req, res) => {
  try {
    clearBlockedAttempts();
    logger.info('Blocked attempts log cleared by admin', { adminId: req.userId });
    res.json({ message: 'Blocked attempts log cleared' });
  } catch (error) {
    logger.error('Clear blocked attempts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

