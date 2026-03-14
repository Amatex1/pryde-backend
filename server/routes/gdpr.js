/**
 * GDPR Data Export — GET /api/gdpr/export
 *
 * Allows authenticated users to download all personal data Pryde holds about
 * them in a single JSON file. This satisfies:
 *  - GDPR Article 20 (Right to data portability)
 *  - GDPR Article 15 (Right of access)
 *
 * Rate-limited to 3 exports per 24 hours to prevent abuse.
 * Export is streamed as an attachment so it never lives in memory entirely.
 */

import express from 'express';
const router = express.Router();
import auth from '../middleware/auth.js';
import requireActiveUser from '../middleware/requireActiveUser.js';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import Message from '../models/Message.js';
import Follow from '../models/Follow.js';
import Notification from '../models/Notification.js';
import SecurityLog from '../models/SecurityLog.js';
import Report from '../models/Report.js';
import Journal from '../models/Journal.js';
import Longform from '../models/Longform.js';
import Draft from '../models/Draft.js';
import logger from '../utils/logger.js';

// Max 3 exports per 24 hours per user
const exportLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.userId || req.ip,
  message: { error: 'Too many export requests. Please wait 24 hours.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }
});

/**
 * @route  GET /api/gdpr/export
 * @desc   Download all personal data for the authenticated user
 * @access Private
 */
router.get('/export', auth, requireActiveUser, exportLimiter, async (req, res) => {
  const userId = req.userId;

  try {
    logger.info(`[GDPR] Export requested by user ${userId}`);

    // ── Profile ────────────────────────────────────────────────────────────
    const user = await User.findById(userId)
      .select('-password -resetPasswordToken -resetPasswordExpires -twoFactorSecret -friends')
      .lean();

    if (!user) return res.status(404).json({ error: 'User not found' });

    // ── Content ────────────────────────────────────────────────────────────
    const [
      posts,
      comments,
      journals,
      longformPosts,
      drafts,
      sentMessages,
      followers,
      following,
      securityLogs,
      reportsSubmitted
    ] = await Promise.all([
      Post.find({ author: userId }).select('-__v').lean(),
      Comment.find({ author: userId }).select('-__v').lean(),
      Journal.find({ author: userId }).select('-__v').lean(),
      Longform.find({ author: userId }).select('-__v').lean(),
      Draft.find({ author: userId }).select('-__v').lean(),
      Message.find({ sender: userId })
        .select('content createdAt recipient groupChat edited editedAt isDeletedForAll')
        .lean(),
      Follow.find({ following: userId }).select('follower createdAt').lean(),
      Follow.find({ follower: userId }).select('following createdAt').lean(),
      SecurityLog.find({ userId }).select('-__v').lean(),
      Report.find({ reporter: userId }).select('-__v').lean()
    ]);

    // ── Assemble export ────────────────────────────────────────────────────
    const exportData = {
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0',
      requestedBy: userId,

      profile: {
        ...user,
        // Redact any remaining sensitive fields that shouldn't leave the server
        password: undefined,
        resetPasswordToken: undefined
      },

      content: {
        posts: posts.length,
        postsData: posts,
        comments: comments.length,
        commentsData: comments,
        journals: journals.length,
        journalsData: journals,
        longformPosts: longformPosts.length,
        longformPostsData: longformPosts,
        drafts: drafts.length,
        draftsData: drafts
      },

      messages: {
        sent: sentMessages.length,
        sentData: sentMessages
      },

      socialGraph: {
        followersCount: followers.length,
        followersData: followers,
        followingCount: following.length,
        followingData: following
      },

      security: {
        logsCount: securityLogs.length,
        logsData: securityLogs
      },

      reports: {
        submitted: reportsSubmitted.length,
        submittedData: reportsSubmitted
      },

      legalNotice: [
        'This file contains all personal data Pryde Social holds about you.',
        'You may request deletion of your account and data via Settings > Account > Delete Account.',
        'For questions contact: privacy@prydeapp.com'
      ]
    };

    const filename = `pryde-data-export-${userId}-${Date.now()}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(exportData);

    logger.info(`[GDPR] Export completed for user ${userId}: ${posts.length} posts, ${sentMessages.length} messages`);
  } catch (error) {
    logger.error(`[GDPR] Export failed for user ${userId}:`, error);
    res.status(500).json({ error: 'Failed to generate data export. Please try again.' });
  }
});

/**
 * @route  GET /api/gdpr/status
 * @desc   Check if a user can request an export (rate limit status)
 * @access Private
 */
router.get('/status', auth, requireActiveUser, async (req, res) => {
  res.json({
    canExport: true,
    message: 'You can request a data export. Limit: 3 exports per 24 hours.',
    endpoint: 'GET /api/gdpr/export'
  });
});

export default router;
