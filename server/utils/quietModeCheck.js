/**
 * Quiet Mode — Notification Suppression Utility
 *
 * Determines whether the current time falls inside a user's configured
 * quiet hours, and computes when those hours end (so queued notifications
 * can be scheduled for release).
 */

/**
 * Returns true if right now is inside the user's quiet hours.
 * Handles overnight windows such as 22:00 – 08:00.
 *
 * @param {object} user – Mongoose lean doc or populated User
 * @returns {boolean}
 */
export function isQuietHours(user) {
  const ps = user?.privacySettings || {};
  if (!ps.quietHoursEnabled) return false;

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const [sh, sm] = (ps.quietHoursStart || '22:00').split(':').map(Number);
  const [eh, em] = (ps.quietHoursEnd   || '08:00').split(':').map(Number);

  const startMins = sh * 60 + sm;
  const endMins   = eh * 60 + em;

  // Overnight window: start > end means the range crosses midnight
  if (startMins > endMins) {
    return nowMins >= startMins || nowMins <= endMins;
  }
  return nowMins >= startMins && nowMins <= endMins;
}

/**
 * Returns the Date when the user's quiet hours will end.
 * If the end time is earlier than now, returns the end time tomorrow.
 *
 * @param {object} user – Mongoose lean doc or populated User
 * @returns {Date}
 */
export function nextQuietModeEnd(user) {
  const ps = user?.privacySettings || {};
  const [eh, em] = (ps.quietHoursEnd || '08:00').split(':').map(Number);

  const now = new Date();
  const end = new Date(now);
  end.setHours(eh, em, 0, 0);

  // If that time has already passed today, aim for tomorrow
  if (end <= now) end.setDate(end.getDate() + 1);

  return end;
}

/**
 * Returns the priority tier for a given notification type.
 * Used to decide whether quiet mode should suppress it.
 *
 * @param {string} type
 * @returns {'critical' | 'important' | 'passive'}
 */
export function getNotifPriority(type) {
  if (['login_approval', 'moderation', 'announcement'].includes(type)) return 'critical';
  if (['comment', 'mention', 'group_mention', 'friend_request', 'circle_invite', 'circle_post'].includes(type)) return 'important';
  return 'passive'; // like, resonance, group_post, system, friend_accept, …
}
