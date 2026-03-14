/**
 * reportSeverityService.js
 *
 * Computes a severity score and label for each incoming report so admins can
 * triage the queue by urgency rather than arrival order.
 *
 * Scoring model
 * ─────────────
 * Base score    — driven by reason category
 * Multipliers   — applied on top of the base score:
 *   +1  if same target has 3+ existing active reports
 *   +1  if the reported user has 5+ active reports against them
 *
 * Final score is clamped to [1, 10].
 * Label thresholds: 1 = low, 2–3 = medium, 4–6 = high, 7+ = critical
 */

import Report from '../models/Report.js';

// ── Base severity per reason ──────────────────────────────────────────────────
const BASE_SCORE = {
  spam:          1,
  misinformation: 1,
  other:         1,
  impersonation: 2,
  harassment:    2,
  nudity:        2,
  hate_speech:   3,
  violence:      3,
  self_harm:     4
};

// Reasons that should trigger an immediate elevated signal regardless of count
export const HIGH_SEVERITY_REASONS = new Set(['self_harm', 'violence', 'hate_speech']);

/**
 * Returns { severityScore, severityLabel } for a new report.
 *
 * @param {string} reason         e.g. 'harassment'
 * @param {string} reportType     'post' | 'comment' | 'message' | 'user'
 * @param {string|null} contentId ObjectId of the target content (may be null for user reports)
 * @param {string|null} userId    ObjectId of the reported user (may be null)
 */
export async function computeSeverity(reason, reportType, contentId, userId) {
  let score = BASE_SCORE[reason] ?? 1;

  try {
    // Multiplier: repeated reports on the same target
    if (contentId) {
      const targetCount = await Report.countDocuments({
        reportType,
        reportedContent: contentId,
        status: { $in: ['pending', 'reviewing'] }
      });
      if (targetCount >= 3) score += 1;
    }

    // Multiplier: reported user has many active reports
    if (userId) {
      const userCount = await Report.countDocuments({
        reportedUser: userId,
        status: { $in: ['pending', 'reviewing'] }
      });
      if (userCount >= 5) score += 1;
    }
  } catch {
    // Non-fatal — fall back to base score
  }

  score = Math.max(1, Math.min(10, score));
  return { severityScore: score, severityLabel: _label(score) };
}

function _label(score) {
  if (score >= 7) return 'critical';
  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}
