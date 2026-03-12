/**
 * Quiet Mode Time Check Utility
 * Determines if current time falls within user's quiet hours.
 * Supports overnight ranges (22:00-08:00).
 */

function isQuietHours(user) {
  if (!user.privacySettings?.quietModeEnabled) return false;

  const now = new Date();

  const [startHour, startMinute] = user.privacySettings.quietHoursStart.split(":").map(Number);
  const [endHour, endMinute] = user.privacySettings.quietHoursEnd.split(":").map(Number);

  const start = new Date(now);
  start.setHours(startHour, startMinute, 0, 0);

  const end = new Date(now);
  end.setHours(endHour, endMinute, 0, 0);

  if (start > end) {
    // Overnight quiet hours (e.g., 22:00 - 08:00)
    return now >= start || now <= end;
  }

  return now >= start && now <= end;
}

/**
 * Calculate next quiet mode end time for queued notifications
 */
function getNextQuietEnd(user) {
  if (!user.privacySettings.quietHoursEnabled) return null;

  const [endHour, endMinute] = user.privacySettings.quietHoursEnd.split(":").map(Number);

  const now = new Date();
  const endToday = new Date(now);
  endToday.setHours(endHour, endMinute, 0, 0);

  if (endToday > now) {
    return endToday;
  }

  // Tomorrow
  const endTomorrow = new Date(endToday);
  endTomorrow.setDate(endTomorrow.getDate() + 1);
  return endTomorrow;
}

export { isQuietHours, getNextQuietEnd };

