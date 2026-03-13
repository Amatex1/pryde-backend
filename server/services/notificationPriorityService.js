/**
 * Notification Priority Service
 *
 * Assigns a priority level to a notification based on its type.
 * Priority controls:
 *   - Delivery speed  (critical/high → immediate, normal → ~10s, low → up to 60s)
 *   - Quiet Mode bypass  (critical always delivered, low suppressed)
 *
 * Levels (new):   critical | high | normal | low
 * Legacy levels:  important | passive  (kept for backward compat)
 */

/**
 * Map from notification type to priority level.
 * @type {Record<string, 'critical'|'high'|'normal'|'low'>}
 */
const PRIORITY_MAP = {
  // ── Critical: security / account / admin ───────────────────────────────────
  login_approval: 'critical',
  moderation:     'critical',
  system:         'critical',
  announcement:   'critical',

  // ── High: direct social interaction ────────────────────────────────────────
  mention:         'high',
  group_mention:   'high',
  friend_request:  'high',
  friend_accept:   'high',
  comment:         'high',  // direct reply to your post
  circle_invite:   'high',

  // ── Normal: ambient social activity ────────────────────────────────────────
  group_post:             'normal',
  circle_post:            'normal',
  conversation_resurface: 'normal',
  resonance:              'normal',
  share:                  'normal',

  // ── Low: passive engagement (likes / reactions) ─────────────────────────────
  like:     'low',
  reaction: 'low',
};

/**
 * Return the priority level for a notification type.
 *
 * @param {string} type - Notification type (e.g. 'like', 'comment', 'mention')
 * @returns {'critical'|'high'|'normal'|'low'}
 */
export function getNotificationPriority(type) {
  return PRIORITY_MAP[type] ?? 'normal';
}

/**
 * Return the delivery delay in milliseconds for a priority level.
 * Used by notificationDeliveryService to schedule deliveryScheduledAt.
 *
 * @param {'critical'|'high'|'normal'|'low'|'important'|'passive'} priority
 * @returns {number} Milliseconds to wait before delivering
 */
export function getDeliveryDelayMs(priority) {
  switch (priority) {
    case 'critical':
    case 'important':  // legacy alias
      return 0;
    case 'high':
      return 0;
    case 'normal':
    case 'passive':    // legacy alias
      return 10_000;   // 10 seconds
    case 'low':
      return 60_000;   // 60 seconds (allows batching window to close)
    default:
      return 10_000;
  }
}
