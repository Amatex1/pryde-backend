import express from 'express';
const router = express.Router();
import Report from '../models/Report.js';
import User from '../models/User.js';
import auth from '../middleware/auth.js';
import { flagSuspectedMinor } from '../services/minorDetectionService.js';
import { reportLimiter } from '../middleware/rateLimiter.js';
import { sanitizeFields } from '../middleware/sanitize.js';
import { validateParamId } from '../middleware/validation.js';
import { createLogger } from '../utils/logger.js';
import { buildContentSnapshot } from '../services/reportSnapshotService.js';
import { computeSeverity } from '../services/reportSeverityService.js';
import { evaluateReportSignals } from '../services/reportSignalService.js';

const logger = createLogger('reports');

// @route   POST /api/reports
// @desc    Create a new report
// @access  Private
router.post('/', auth, reportLimiter, sanitizeFields(['description', 'reason']), async (req, res) => {
  try {
    const { reportType, reportedContent, reportedUser, reason, description } = req.body;
    const userId = req.userId || req.user._id;

    // Validate required fields
    if (!reportType || !reason) {
      return res.status(400).json({ message: 'Report type and reason are required' });
    }

    // Determine the model based on report type
    let onModel;
    switch (reportType) {
      case 'post':    onModel = 'Post';    break;
      case 'comment': onModel = 'Comment'; break;
      case 'message': onModel = 'Message'; break;
      case 'user':    onModel = 'User';    break;
      default:
        return res.status(400).json({ message: 'Invalid report type' });
    }

    // ── Phase 1: Duplicate-report guard ──────────────────────────────────────
    // One active report per (reporter, reportType, reportedContent) triplet.
    // If the prior report was resolved or dismissed a new report is allowed.
    const existingReport = await Report.findOne({
      reporter: userId,
      reportType,
      reportedContent: reportedContent || null,
      status: { $in: ['pending', 'reviewing'] }
    }).lean();

    if (existingReport) {
      return res.status(400).json({
        message: 'You have already reported this content.',
        existingReportId: existingReport._id
      });
    }

    // ── Phase 3: Capture immutable content snapshot ───────────────────────────
    const contentSnapshot = await buildContentSnapshot(reportType, reportedContent);

    // ── Phase 4: Compute severity score ──────────────────────────────────────
    const { severityScore, severityLabel } = await computeSeverity(
      reason,
      reportType,
      reportedContent || null,
      reportedUser || null
    );

    const report = new Report({
      reporter: userId,
      reportedUser: reportedUser || null,
      reportType,
      reportedContent: reportedContent || null,
      onModel,
      reason,
      description: description || '',
      status: 'pending',
      contentSnapshot: contentSnapshot || undefined,
      severityScore,
      severityLabel
    });

    await report.save();

    // ── Improvement 2: Increment reported user's report counter ──────────────
    if (reportedUser) {
      User.updateOne(
        { _id: reportedUser },
        { $inc: { reportCount: 1 }, $set: { lastReportedAt: new Date() } }
      ).catch(err => logger.error('Failed to increment reportCount', err));
    }

    // ── Phase 5: Emit moderation signals (non-blocking) ──────────────────────
    evaluateReportSignals(report, req).catch(err =>
      logger.error('evaluateReportSignals error', err)
    );

    // Minor-detection hook (existing behaviour preserved)
    const lowerReason = (reason || '').toLowerCase();
    const lowerDescription = (description || '').toLowerCase();
    if (
      lowerReason.includes('underage') || lowerReason.includes('minor') ||
      lowerDescription.includes('underage') || lowerDescription.includes('minor')
    ) {
      try {
        let targetUser = null;
        if (reportedUser) {
          targetUser = await User.findById(reportedUser).select('_id username email').lean();
        }
        await flagSuspectedMinor(targetUser, {
          reason: 'user_reported_underage',
          reporterId: userId,
          ip: req.ip,
          userAgent: req.headers['user-agent']
        });
      } catch (flagError) {
        logger.error('Failed to flag suspected minor from report:', flagError);
      }
    }

    res.status(201).json({
      message: 'Report submitted successfully. We will review it shortly.',
      report
    });
  } catch (error) {
    logger.error('Create report error', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/my-reports
// @desc    Get current user's reports
// @access  Private
router.get('/my-reports', auth, async (req, res) => {
  try {
    const userId = req.userId || req.user._id;

    const reports = await Report.find({ reporter: userId })
      .populate('reportedUser', 'username displayName profilePhoto')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(reports);
  } catch (error) {
    logger.error('Get reports error', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/:id
// @desc    Get single report
// @access  Private
router.get('/:id', auth, validateParamId('id'), async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    const report = await Report.findById(req.params.id)
      .populate('reporter', 'username displayName')
      .populate('reportedUser', 'username displayName profilePhoto');

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    if (report.reporter._id.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(report);
  } catch (error) {
    logger.error('Get report error', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/reports/:id
// @desc    Delete/cancel a report
// @access  Private
router.delete('/:id', auth, validateParamId('id'), async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    if (report.reporter.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (report.status !== 'pending') {
      return res.status(400).json({ message: 'Cannot delete a report that is being reviewed or resolved' });
    }

    await report.deleteOne();

    res.json({ message: 'Report cancelled successfully' });
  } catch (error) {
    logger.error('Delete report error', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
