/**
 * adminReports.js
 *
 * Admin-only report management endpoints.
 * Mounted at /api/admin/reports by server/routes/admin.js.
 *
 * Permissions preserved from original implementation:
 *   GET  routes → canViewReports
 *   PUT  routes → canResolveReports
 */

import express from 'express';
const router = express.Router();
import mongoose from 'mongoose';
import Report from '../models/Report.js';
import { checkPermission } from '../middleware/adminAuth.js';
import logger from '../utils/logger.js';

// ── GET /api/admin/reports ────────────────────────────────────────────────────
// Phase 6: Supports filtering by status, reason, reportType
//          Supports sorting by newest | severity | mostReported
//          Returns per-target aggregated counts and reason breakdowns (Phase 2)
router.get('/', checkPermission('canViewReports'), async (req, res) => {
  try {
    const {
      status,
      reason,
      reportType,
      sort = 'newest',
      page = 1,
      limit = 20
    } = req.query;

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    // ── Build match filter ──────────────────────────────────────────────────
    const match = {};
    if (status)     match.status     = status;
    if (reason)     match.reason     = reason;
    if (reportType) match.reportType = reportType;

    // ── Sort order ──────────────────────────────────────────────────────────
    let sortStage;
    switch (sort) {
      case 'severity':
        sortStage = { severityScore: -1, createdAt: -1 };
        break;
      case 'mostReported':
        // Will be overridden below via aggregation
        sortStage = { targetReportCount: -1, createdAt: -1 };
        break;
      default: // 'newest'
        sortStage = { createdAt: -1 };
    }

    // ── Phase 2: Aggregation pipeline ──────────────────────────────────────
    // For each report we look up how many total active reports share the same
    // (reportType, reportedContent) target so the admin UI can render a count
    // badge and a reason breakdown without a separate request.

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'reports',
          let: { rt: '$reportType', rc: '$reportedContent' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$reportType', '$$rt'] },
                    { $eq: ['$reportedContent', '$$rc'] },
                    { $in: ['$status', ['pending', 'reviewing']] }
                  ]
                }
              }
            },
            { $group: {
              _id: '$reason',
              count: { $sum: 1 }
            }}
          ],
          as: '_targetReasonGroups'
        }
      },
      {
        $addFields: {
          // Total active reports on this target
          targetReportCount: { $sum: '$_targetReasonGroups.count' },
          // Reason breakdown: { harassment: 3, spam: 1, ... }
          groupedReasonCounts: {
            $arrayToObject: {
              $map: {
                input: '$_targetReasonGroups',
                as: 'r',
                in: { k: '$$r._id', v: '$$r.count' }
              }
            }
          }
        }
      },
      { $unset: '_targetReasonGroups' },
      { $sort: sortStage },
      { $skip: (pageNum - 1) * limitNum },
      { $limit: limitNum }
    ];

    const [reports, total] = await Promise.all([
      Report.aggregate(pipeline),
      Report.countDocuments(match)
    ]);

    // Populate relational fields (aggregation bypasses Mongoose populate)
    const populated = await Report.populate(reports, [
      { path: 'reporter',    select: 'username displayName email profilePhoto' },
      { path: 'reportedUser', select: 'username displayName email profilePhoto' },
      { path: 'reportedContent', populate: { path: 'author authorId sender', select: 'username displayName profilePhoto' } },
      { path: 'reviewedBy',  select: 'username displayName' }
    ]);

    res.json({
      reports: populated,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    logger.error('Admin get reports error', { error: error.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/admin/reports/stats ─────────────────────────────────────────────
// Quick summary counters for the admin dashboard header
router.get('/stats', checkPermission('canViewReports'), async (req, res) => {
  try {
    const [statusCounts, reasonCounts] = await Promise.all([
      Report.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Report.aggregate([
        { $match: { status: { $in: ['pending', 'reviewing'] } } },
        { $group: { _id: '$reason', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    const byStatus = {};
    statusCounts.forEach(s => { byStatus[s._id] = s.count; });

    const byReason = {};
    reasonCounts.forEach(r => { byReason[r._id] = r.count; });

    res.json({ byStatus, byReason });
  } catch (error) {
    logger.error('Admin reports stats error', { error: error.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/admin/reports/:id ────────────────────────────────────────────────
router.get('/:id', checkPermission('canViewReports'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid report ID' });
    }

    const report = await Report.findById(req.params.id)
      .populate('reporter',    'username displayName email profilePhoto')
      .populate('reportedUser', 'username displayName email profilePhoto')
      .populate('reportedContent')
      .populate('reviewedBy',  'username displayName');

    if (!report) return res.status(404).json({ message: 'Report not found' });

    res.json(report);
  } catch (error) {
    logger.error('Admin get single report error', { error: error.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// ── PUT /api/admin/reports/:id ────────────────────────────────────────────────
// Phase 6: supports status transitions + action + reviewNotes
router.put('/:id', checkPermission('canResolveReports'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid report ID' });
    }

    const { status, reviewNotes, action } = req.body;
    const adminUser   = req.adminUser;
    const adminUserId = adminUser._id;

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found' });

    if (status)      report.status      = status;
    if (reviewNotes) report.reviewNotes = reviewNotes;
    if (action)      report.action      = action;
    report.reviewedBy  = adminUserId;
    report.reviewedAt  = new Date();

    // Improvement 1: append to audit trail
    report.actionHistory.push({
      action:            action || status || 'none',
      moderatorId:       adminUserId,
      moderatorUsername: adminUser.username || adminUser.email || String(adminUserId),
      timestamp:         new Date(),
      notes:             reviewNotes || ''
    });

    await report.save();

    res.json({ message: 'Report updated successfully', report });
  } catch (error) {
    logger.error('Admin update report error', { error: error.message });
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
