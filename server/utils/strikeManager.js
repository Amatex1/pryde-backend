/**
 * Strike Manager — GOVERNANCE V1
 *
 * Centralised strike escalation and decay logic.
 * Called by moderation routes whenever a content violation is confirmed.
 *
 * Escalation ladder:
 *   Category strike 2 → 48-hour restriction
 *   Category strike 3 → 30-day restriction
 *   Global strike ≥ 4  → permanent ban (overrideable by admin)
 *
 * Decay:
 *   > 30 days since last violation → decrement each category by 1 (min 0)
 *   > 90 days since last violation → reset all strikes to 0
 *
 * All permanent bans are overrideable via POST /api/admin/moderation-v2/restore-user/:userId
 */

import ModerationEvent from '../models/ModerationEvent.js';
import logger from './logger.js';

const MS_30_DAYS = 30 * 24 * 60 * 60 * 1000;
const MS_90_DAYS = 90 * 24 * 60 * 60 * 1000;
const MS_48_HOURS = 48 * 60 * 60 * 1000;

/**
 * Apply strike decay based on time since last violation.
 * Called here on every applyStrike() call so no separate cron is needed.
 *
 * @param {object} user - Mongoose User document (must not be lean)
 * @param {Date} now
 */
function applyDecay(user, now) {
  if (!user.lastViolationAt) return;

  const elapsed = now - user.lastViolationAt;

  if (elapsed > MS_90_DAYS) {
    // Full reset after 90 days of silence
    user.postStrikes = 0;
    user.commentStrikes = 0;
    user.dmStrikes = 0;
    user.globalStrikes = 0;
  } else if (elapsed > MS_30_DAYS) {
    // Soft decay: decrement each category by 1 (floor at 0)
    user.postStrikes = Math.max(0, (user.postStrikes || 0) - 1);
    user.commentStrikes = Math.max(0, (user.commentStrikes || 0) - 1);
    user.dmStrikes = Math.max(0, (user.dmStrikes || 0) - 1);
    // Recalculate globalStrikes to match current category totals
    user.globalStrikes = Math.max(
      0,
      (user.postStrikes || 0) + (user.commentStrikes || 0) + (user.dmStrikes || 0)
    );
  }
}

/**
 * Apply a strike for a confirmed content violation and escalate as needed.
 *
 * @param {object} user     - Mongoose User document (full, not lean)
 * @param {string} category - 'post' | 'comment' | 'dm'
 * @param {object} [eventMeta] - Optional fields forwarded to ModerationEvent
 * @returns {Promise<{ status: string, strikeLevel: number, newStatus: string }>}
 */
export async function applyStrike(user, category, eventMeta = {}) {
  const now = new Date();

  // ── 1. Decay check (rolling 30-day window reset) ───────────────────────────
  applyDecay(user, now);

  // ── 2. Record the violation timestamp ─────────────────────────────────────
  user.lastViolationAt = now;

  // ── 3. Increment category and global counters ──────────────────────────────
  if (category === 'post')    user.postStrikes    = (user.postStrikes    || 0) + 1;
  if (category === 'comment') user.commentStrikes = (user.commentStrikes || 0) + 1;
  if (category === 'dm')      user.dmStrikes      = (user.dmStrikes      || 0) + 1;

  user.globalStrikes = (user.globalStrikes || 0) + 1;

  // ── 4. Determine current category strike count ────────────────────────────
  const categoryStrikes =
    category === 'post'    ? user.postStrikes :
    category === 'comment' ? user.commentStrikes :
                             user.dmStrikes;

  // ── 5. Category escalation ────────────────────────────────────────────────
  let restrictionDurationMs = 0;
  let action = 'STRIKE_RECORDED';

  if (categoryStrikes === 2) {
    restrictionDurationMs = MS_48_HOURS;
    user.restrictedUntil  = new Date(now.getTime() + MS_48_HOURS);
    user.governanceStatus = 'restricted';
    action = 'TEMP_RESTRICT_48H';
  } else if (categoryStrikes >= 3) {
    restrictionDurationMs = MS_30_DAYS;
    user.restrictedUntil  = new Date(now.getTime() + MS_30_DAYS);
    user.governanceStatus = 'restricted';
    action = 'TEMP_RESTRICT_30D';
  }

  // ── 6. Global escalation — overrides category restriction ─────────────────
  if (user.globalStrikes >= 4) {
    user.governanceStatus = 'banned';
    user.restrictedUntil  = null;
    restrictionDurationMs = 0;
    action = 'PERMANENT_BAN';
  }

  // ── 7. Persist ────────────────────────────────────────────────────────────
  await user.save();

  // ── 8. Log ModerationEvent ────────────────────────────────────────────────
  try {
    await ModerationEvent.create({
      userId:        user._id,
      contentType:   category === 'dm' ? 'message' : category,
      contentId:     eventMeta.contentId    || null,
      contentPreview: eventMeta.contentPreview || '',
      expression: { classification: 'normal', expressiveRatio: 0, realWordRatio: 0 },
      intent: {
        category:       category,
        score:          eventMeta.intentScore || 0,
        targetDetected: eventMeta.targetDetected || false
      },
      behavior: {
        score:          eventMeta.behaviorScore  || 0,
        trend:          eventMeta.behaviorTrend  || 'stable',
        accountAgeDays: eventMeta.accountAgeDays || 0
      },
      response: {
        action:          action,
        durationMinutes: Math.round(restrictionDurationMs / 60000),
        automated:       true
      },
      confidence:       eventMeta.confidence || 80,
      explanationCode:  action,
      shadowMode:       false,
      // Governance-specific fields
      strikeCategory:   category,
      strikeLevel:      categoryStrikes,
      globalStrikeCount: user.globalStrikes,
      restrictionDurationMs
    });
  } catch (eventError) {
    logger.error('[strikeManager] Failed to create ModerationEvent:', eventError);
  }

  return {
    status:      user.governanceStatus,
    strikeLevel: categoryStrikes,
    newStatus:   user.governanceStatus,
    action
  };
}

/**
 * Decay-only check — call on login to keep counters fresh without a new violation.
 * Does NOT save; caller must save the user document.
 *
 * @param {object} user - Mongoose User document
 */
export function checkDecay(user) {
  const now = new Date();
  applyDecay(user, now);
}

export default { applyStrike, checkDecay };
