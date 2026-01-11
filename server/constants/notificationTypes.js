/**
 * CANONICAL NOTIFICATION TYPES
 *
 * Single source of truth for all notification type definitions.
 * Implements calm-first defaults per Pryde design philosophy.
 *
 * RULES:
 * - SOCIAL notifications appear in Bell icon
 * - MESSAGE notifications appear in Messages badge only
 * - No engagement bait types (follow, profile_view, trending, etc.)
 * - No batching or summarization
 */

// ============================================
// SOCIAL NOTIFICATIONS (Bell Icon)
// ============================================
export const SOCIAL_NOTIFICATION_TYPES = Object.freeze({
  REACT_ON_POST: 'like',           // Legacy: 'like' covers reactions
  COMMENT_ON_POST: 'comment',
  REPLY_TO_COMMENT: 'comment',     // Uses same type, different message
  MENTION_IN_POST: 'mention',
  MENTION_IN_COMMENT: 'mention',   // Uses same type
  GROUP_REPLY_DIRECT: 'group_mention',
  GROUP_MENTION_DIRECT: 'group_mention',
  SYSTEM_NOTICE: 'system',
  MODERATION_RESULT: 'moderation',
  // Legacy types still in use
  RESONANCE: 'resonance',
  CIRCLE_INVITE: 'circle_invite',
  CIRCLE_POST: 'circle_post',
  GROUP_POST: 'group_post',
  LOGIN_APPROVAL: 'login_approval',
});

// ============================================
// MESSAGE NOTIFICATIONS (Messages Badge Only)
// ============================================
export const MESSAGE_NOTIFICATION_TYPES = Object.freeze({
  DIRECT_MESSAGE: 'message',
});

// ============================================
// CANONICAL ENUM (for Mongoose schema)
// ============================================
export const ALL_NOTIFICATION_TYPES = Object.freeze([
  // Social types
  'like',
  'comment',
  'mention',
  'group_mention',
  'group_post',
  'system',
  'moderation',
  'resonance',
  'circle_invite',
  'circle_post',
  'login_approval',
  // Message types
  'message',
  // Legacy types (deprecated, kept for backward compatibility)
  'friend_request',  // Deprecated: now uses follow system
  'friend_accept',   // Deprecated: now uses follow system
  'share',           // Deprecated: removed in Phase 5
]);

// ============================================
// FORBIDDEN TYPES (Never create these)
// ============================================
export const FORBIDDEN_NOTIFICATION_TYPES = Object.freeze([
  'follow',           // No follow notifications
  'profile_view',     // No stalking notifications
  'bookmark',         // Private action, no notification
  'group_join',       // Silent action
  'trending',         // No algorithmic pressure
  'suggested_content',// No algorithmic pressure
  'activity_summary', // No engagement bait
  'milestone',        // No gamification
  'reminder',         // No come-back prompts
]);

// ============================================
// TYPE CLASSIFICATION HELPERS
// ============================================

/**
 * Check if a notification type is a SOCIAL type (Bell icon)
 * @param {string} type - Notification type
 * @returns {boolean}
 */
export function isSocialNotificationType(type) {
  const socialTypes = [
    'like', 'comment', 'mention', 'group_mention', 'group_post',
    'system', 'moderation', 'resonance', 'circle_invite', 'circle_post',
    'login_approval', 'friend_request', 'friend_accept', 'share'
  ];
  return socialTypes.includes(type);
}

/**
 * Check if a notification type is a MESSAGE type (Messages badge)
 * @param {string} type - Notification type
 * @returns {boolean}
 */
export function isMessageNotificationType(type) {
  return type === 'message';
}

/**
 * Check if a notification type is FORBIDDEN
 * @param {string} type - Notification type
 * @returns {boolean}
 */
export function isForbiddenNotificationType(type) {
  return FORBIDDEN_NOTIFICATION_TYPES.includes(type);
}

/**
 * Validate notification type before creation
 * Logs warning for invalid types (non-fatal)
 * @param {string} type - Notification type to validate
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateNotificationType(type) {
  if (isForbiddenNotificationType(type)) {
    return {
      valid: false,
      reason: `FORBIDDEN: Notification type '${type}' violates calm-first principles`
    };
  }

  if (!ALL_NOTIFICATION_TYPES.includes(type)) {
    return {
      valid: false,
      reason: `UNKNOWN: Notification type '${type}' is not in canonical list`
    };
  }

  return { valid: true };
}

/**
 * Get notification category for routing
 * @param {string} type - Notification type
 * @returns {'social' | 'message' | 'unknown'}
 */
export function getNotificationCategory(type) {
  if (isMessageNotificationType(type)) return 'message';
  if (isSocialNotificationType(type)) return 'social';
  return 'unknown';
}

