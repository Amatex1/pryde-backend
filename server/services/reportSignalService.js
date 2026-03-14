/**
 * reportSignalService.js
 *
 * Emits SecurityLog entries when report thresholds are crossed so that
 * automated monitoring tools and on-call reviewers can react without waiting
 * for a human to manually triage the queue.
 *
 * Rules
 * ─────
 * 1. 3+ active reports on the same target  → reported_content_threshold_reached
 * 2. 5+ active reports against the same user across any target
 *                                          → reported_user_threshold_reached
 * 3. self_harm / violence / hate_speech on first report
 *                                          → high_severity_report_submitted (immediately)
 *
 * Deduplication: each signal type is only re-emitted once every 24 h per
 * target to avoid log spam when reports accumulate quickly.
 *
 * Safety guarantees (per spec):
 *   - Never auto-bans users
 *   - Never auto-deletes content
 *   - Only flags for moderator review
 */

import SecurityLog from '../models/SecurityLog.js';
import { createLogger } from '../utils/logger.js';
import { HIGH_SEVERITY_REASONS } from './reportSeverityService.js';

const logger = createLogger('reportSignalService');

const CONTENT_THRESHOLD = 3;
const USER_THRESHOLD    = 5;
const DEDUPE_WINDOW_MS  = 24 * 60 * 60 * 1000; // 24 h

/**
 * Called after a new report has been saved.
 *
 * @param {Object} report     Mongoose document (freshly saved)
 * @param {Object} req        Express request (for ip / userAgent)
 */
export async function evaluateReportSignals(report, req = {}) {
  const promises = [];

  // Rule 3 — high-severity reason on first report
  if (HIGH_SEVERITY_REASONS.has(report.reason)) {
    promises.push(_emitHighSeveritySignal(report, req));
  }

  // Rule 1 — content threshold
  if (report.reportedContent) {
    promises.push(_checkContentThreshold(report, req));
  }

  // Rule 2 — user threshold
  if (report.reportedUser) {
    promises.push(_checkUserThreshold(report, req));
  }

  await Promise.allSettled(promises);
}

// ── Private helpers ───────────────────────────────────────────────────────────

async function _emitHighSeveritySignal(report, req) {
  try {
    const alreadyEmitted = await _recentSignalExists(
      'high_severity_report_submitted',
      report.reportedContent?.toString() || report.reportedUser?.toString()
    );
    if (alreadyEmitted) return;

    await SecurityLog.create({
      type: 'high_severity_report_submitted',
      severity: 'critical',
      userId: report.reportedUser || null,
      ipAddress: req.ip || null,
      userAgent: req.headers?.['user-agent'] || null,
      action: 'flagged',
      details: JSON.stringify({
        reportId: report._id,
        reason: report.reason,
        reportType: report.reportType,
        targetId: report.reportedContent || report.reportedUser,
        targetOwnerId: report.reportedUser || null,
        severityScore: report.severityScore
      })
    });
  } catch (err) {
    logger.error('_emitHighSeveritySignal error', err.message);
  }
}

async function _checkContentThreshold(report, req) {
  try {
    const count = await _countActiveReportsForContent(
      report.reportType,
      report.reportedContent
    );
    if (count < CONTENT_THRESHOLD) return;

    const alreadyEmitted = await _recentSignalExists(
      'reported_content_threshold_reached',
      report.reportedContent.toString()
    );
    if (alreadyEmitted) return;

    // Collect distinct reasons for context
    const reasons = await _distinctReasonsForContent(report.reportType, report.reportedContent);

    await SecurityLog.create({
      type: 'reported_content_threshold_reached',
      severity: 'high',
      userId: report.reportedUser || null,
      ipAddress: req.ip || null,
      userAgent: req.headers?.['user-agent'] || null,
      action: 'flagged',
      details: JSON.stringify({
        reportType: report.reportType,
        targetId: report.reportedContent,
        targetOwnerId: report.reportedUser || null,
        reportCount: count,
        reasons,
        triggeringReportId: report._id,
        severityScore: report.severityScore
      })
    });
  } catch (err) {
    logger.error('_checkContentThreshold error', err.message);
  }
}

async function _checkUserThreshold(report, req) {
  try {
    const { default: Report } = await import('../models/Report.js');

    const count = await Report.countDocuments({
      reportedUser: report.reportedUser,
      status: { $in: ['pending', 'reviewing'] }
    });
    if (count < USER_THRESHOLD) return;

    const alreadyEmitted = await _recentSignalExists(
      'reported_user_threshold_reached',
      report.reportedUser.toString()
    );
    if (alreadyEmitted) return;

    await SecurityLog.create({
      type: 'reported_user_threshold_reached',
      severity: 'high',
      userId: report.reportedUser,
      ipAddress: req.ip || null,
      userAgent: req.headers?.['user-agent'] || null,
      action: 'flagged',
      details: JSON.stringify({
        reportedUserId: report.reportedUser,
        activeReportCount: count,
        triggeringReportId: report._id,
        triggeringReason: report.reason,
        severityScore: report.severityScore
      })
    });
  } catch (err) {
    logger.error('_checkUserThreshold error', err.message);
  }
}

// ── Utility helpers ───────────────────────────────────────────────────────────

async function _countActiveReportsForContent(reportType, contentId) {
  const { default: Report } = await import('../models/Report.js');
  return Report.countDocuments({
    reportType,
    reportedContent: contentId,
    status: { $in: ['pending', 'reviewing'] }
  });
}

async function _distinctReasonsForContent(reportType, contentId) {
  const { default: Report } = await import('../models/Report.js');
  return Report.distinct('reason', {
    reportType,
    reportedContent: contentId,
    status: { $in: ['pending', 'reviewing'] }
  });
}

/**
 * Returns true if a signal of the given type was emitted for the given target
 * within the last DEDUPE_WINDOW_MS milliseconds.
 */
async function _recentSignalExists(signalType, targetId) {
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
  const log = await SecurityLog.findOne({
    type: signalType,
    createdAt: { $gte: since },
    details: { $regex: targetId }
  }).lean();
  return !!log;
}
