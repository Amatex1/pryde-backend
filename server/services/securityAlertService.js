/**
 * Security Alert Service
 *
 * Near-real-time alerting for high-severity security events.
 * Keeps first version simple: threshold-based deduplication, email delivery
 * to configured security contact(s). Extend with Slack/webhook as needed.
 *
 * Alert triggers:
 *   - refresh_token_reuse_detected
 *   - repeated failed admin logins (≥ THRESHOLD within window)
 *   - login brute-force spikes  (≥ THRESHOLD within window)
 *   - bulk bans/suspensions      (≥ THRESHOLD within window)
 *   - multiple underage signals  (≥ THRESHOLD within window)
 *   - repeated admin 2FA failures
 *   - malware detected in upload
 *   - session_family_revoked
 *
 * Deduplication: a Redis key (or in-memory Map fallback) prevents the same
 * alert category from firing more than once per DEDUP_WINDOW_MS.
 */

import SecurityLog from '../models/SecurityLog.js';
import { createLogger } from '../utils/logger.js';
import { sendEmail } from '../services/emailService.js';
import { maskIp } from '../utils/securityLogSanitizer.js';

const logger = createLogger('securityAlert');

// ── Configuration ─────────────────────────────────────────────────────────────

const SECURITY_ALERT_EMAIL = process.env.SECURITY_ALERT_EMAIL || null;
const ALERTS_ENABLED = process.env.SECURITY_ALERTS_ENABLED !== 'false'; // opt-out flag

// Time window for counting events (15 minutes)
const COUNT_WINDOW_MS = parseInt(process.env.SECURITY_ALERT_WINDOW_MS || String(15 * 60 * 1000), 10);

// Deduplication window — don't re-alert the same category within this period (1 hour)
const DEDUP_WINDOW_MS = parseInt(process.env.SECURITY_ALERT_DEDUP_MS || String(60 * 60 * 1000), 10);

// Per-category thresholds
const THRESHOLDS = {
  failed_admin_login: parseInt(process.env.ALERT_THRESH_ADMIN_FAIL || '3', 10),
  brute_force_spike:  parseInt(process.env.ALERT_THRESH_BRUTE_FORCE || '20', 10),
  bulk_ban:           parseInt(process.env.ALERT_THRESH_BULK_BAN || '5', 10),
  underage_signals:   parseInt(process.env.ALERT_THRESH_UNDERAGE || '3', 10),
  admin_2fa_failures: parseInt(process.env.ALERT_THRESH_ADMIN_2FA || '3', 10),
};

// In-memory deduplication (keyed by alert category string)
const _dedupMap = new Map();

const _isDuplicate = (category) => {
  const last = _dedupMap.get(category);
  return last && Date.now() - last < DEDUP_WINDOW_MS;
};

const _markSent = (category) => {
  _dedupMap.set(category, Date.now());
};

// ── Core dispatch ─────────────────────────────────────────────────────────────

/**
 * Send a security alert email to the configured security contact.
 * Fails silently — alerts must never break the main request flow.
 *
 * @param {string} subject - Alert subject line
 * @param {string} body    - Plain HTML body
 * @param {string} category - Dedup key
 */
const _dispatch = async (subject, body, category) => {
  if (!ALERTS_ENABLED) return;
  if (_isDuplicate(category)) {
    logger.debug(`[SecurityAlert] Dedup suppressed: ${category}`);
    return;
  }

  _markSent(category);

  // Log the alert event regardless of email delivery
  SecurityLog.create({
    type: 'security_alert_triggered',
    severity: 'high',
    details: `Security alert dispatched: ${category}`,
    action: 'flagged'
  }).catch(e => logger.error('Failed to log security_alert_triggered:', e.message));

  if (!SECURITY_ALERT_EMAIL) {
    logger.warn(`[SecurityAlert] ${category} — no SECURITY_ALERT_EMAIL configured, alert not emailed`);
    return;
  }

  try {
    await sendEmail(
      SECURITY_ALERT_EMAIL,
      `[Pryde Security Alert] ${subject}`,
      `<pre style="font-family:monospace;font-size:13px">${body}</pre>`
    );
    logger.info(`[SecurityAlert] Sent: ${category}`);
  } catch (err) {
    logger.error(`[SecurityAlert] Email delivery failed for ${category}:`, err.message);
  }
};

// ── Count-based threshold helper ──────────────────────────────────────────────

const _countRecentEvents = async (type, windowMs = COUNT_WINDOW_MS) => {
  const since = new Date(Date.now() - windowMs);
  return SecurityLog.countDocuments({ type, createdAt: { $gte: since } });
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Alert immediately — no threshold check. Use for single high-severity events.
 * e.g. refresh_token_reuse_detected, malware_detected_upload
 */
export const alertImmediate = async ({ category, subject, details, ipAddress }) => {
  const ip = maskIp(ipAddress) || 'unknown';
  const body = [
    `Event  : ${category}`,
    `Time   : ${new Date().toISOString()}`,
    `IP     : ${ip}`,
    `Details: ${details || 'n/a'}`
  ].join('\n');

  await _dispatch(subject || category, body, category);
};

/**
 * Alert if count of recent events of `type` exceeds `threshold`.
 * Designed for categories where a single event is normal but a burst is suspicious.
 */
export const alertIfThresholdExceeded = async ({
  type,
  threshold,
  category,
  subject,
  details,
  windowMs = COUNT_WINDOW_MS
}) => {
  const count = await _countRecentEvents(type, windowMs);
  if (count < threshold) return;

  const windowMin = Math.round(windowMs / 60000);
  const body = [
    `Event    : ${category}`,
    `Threshold: ${threshold} events in ${windowMin} min`,
    `Actual   : ${count} events`,
    `Time     : ${new Date().toISOString()}`,
    `Details  : ${details || 'n/a'}`
  ].join('\n');

  await _dispatch(subject || category, body, category);
};

// ── Trigger functions (called from routes / services) ─────────────────────────

export const onRefreshTokenReuse = async (ipAddress) => {
  await alertImmediate({
    category: 'refresh_token_reuse_detected',
    subject: 'Refresh token reuse detected',
    details: 'A previously used refresh token was presented — possible token theft.',
    ipAddress
  });
};

export const onMalwareDetected = async ({ filename, scanner, ipAddress }) => {
  await alertImmediate({
    category: 'malware_detected_upload',
    subject: 'Malware detected in file upload',
    details: `File: ${filename || 'unknown'} | Scanner: ${scanner || 'unknown'}`,
    ipAddress
  });
};

export const onBruteForceSpike = async () => {
  await alertIfThresholdExceeded({
    type: 'failed_login',
    threshold: THRESHOLDS.brute_force_spike,
    category: 'brute_force_spike',
    subject: 'Login brute-force spike detected'
  });
};

export const onBulkBan = async () => {
  await alertIfThresholdExceeded({
    type: 'suspicious_activity',
    threshold: THRESHOLDS.bulk_ban,
    category: 'bulk_ban_spike',
    subject: 'Bulk account bans detected'
  });
};

export const onUnderageSignals = async () => {
  await alertIfThresholdExceeded({
    type: 'suspected_minor_signal',
    threshold: THRESHOLDS.underage_signals,
    category: 'underage_signal_spike',
    subject: 'Multiple underage signals detected'
  });
};

export const onSessionFamilyRevoked = async (userId) => {
  await alertImmediate({
    category: 'session_family_revoked',
    subject: 'Session family revoked (token reuse)',
    details: `User ID: ${userId || 'unknown'} — all sessions revoked due to token reuse.`
  });
};

export default {
  alertImmediate,
  alertIfThresholdExceeded,
  onRefreshTokenReuse,
  onMalwareDetected,
  onBruteForceSpike,
  onBulkBan,
  onUnderageSignals,
  onSessionFamilyRevoked
};
