/**
 * Notification Engagement Score Service
 *
 * Assigns a numeric score to each notification that represents how likely
 * the notification is to bring a user back to the app.
 *
 * Higher score → shown first in the notification list.
 *
 * Base scores by type:
 *   comment          +8   (direct engagement)
 *   mention          +10  (highest pull: someone addressed you)
 *   group_mention    +10
 *   friend_request   +7
 *   friend_accept    +6
 *   group_post       +5
 *   resonance        +4
 *   circle_post      +4
 *   circle_invite    +6
 *   share            +5
 *   like             +3
 *   reaction         +2
 *   conversation_resurface +3
 *   system / moderation / login_approval / announcement +0  (informational)
 *
 * Aggregation bonus:
 *   score += count × 2   (more actors = more social pull)
 */

/** @type {Record<string, number>} */
const BASE_SCORES = {
  mention:                10,
  group_mention:          10,
  comment:                 8,
  circle_invite:           6,
  friend_request:          7,
  friend_accept:           6,
  group_post:              5,
  share:                   5,
  resonance:               4,
  circle_post:             4,
  conversation_resurface:  3,
  like:                    3,
  reaction:                2,
  // Informational types — not engagement pull
  system:           0,
  moderation:       0,
  login_approval:   0,
  announcement:     0,
};

/**
 * Compute the engagement score for a notification.
 *
 * @param {string} type   - Notification type
 * @param {number} [count=1] - Aggregated interaction count
 * @returns {number}
 */
export function getEngagementScore(type, count = 1) {
  const base = BASE_SCORES[type] ?? 3;
  const aggregationBonus = Math.max(0, count - 1) * 2;
  return base + aggregationBonus;
}
