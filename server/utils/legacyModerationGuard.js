/**
 * PRYDE_LEGACY_MODERATION_PASSIVE_MODE
 * 
 * Legacy Moderation Guard
 * 
 * Provides a single point of control for legacy moderation enforcement.
 * When legacy mode is PASSIVE, all penalty applications are blocked
 * but detection and logging continue.
 * 
 * RULES:
 * - PASSIVE mode: Detect, log, but DO NOT apply penalties
 * - No auto-mute, no auto-ban, no strike accumulation
 * - All events are logged with enforcementSkipped = true
 * - V5 is the sole authority for penalties
 */

import { isLegacyEnforcementActive, getModerationModes } from '../config/moderationModes.js';
import logger from './logger.js';

/**
 * Check if legacy moderation enforcement is allowed
 * @returns {boolean} true if legacy system may apply penalties
 */
export function legacyEnforcementAllowed() {
  return isLegacyEnforcementActive();
}

/**
 * Log a skipped enforcement event
 * @param {string} action - The action that was skipped (e.g., 'auto-mute', 'strike-increment')
 * @param {string} reason - Why the action would have been triggered
 * @param {object} context - Additional context (userId, content, etc.)
 */
export function logSkippedEnforcement(action, reason, context = {}) {
  const modes = getModerationModes();
  
  logger.info('Legacy moderation enforcement skipped', {
    action,
    reason,
    enforcementSkipped: true,
    legacyMode: modes.legacy,
    primarySystem: modes.primary,
    ...context
  });
}

/**
 * Create a moderation event that marks enforcement as skipped
 * @param {string} action - The moderation action type
 * @param {string} reason - The reason for the action
 * @param {object} details - Additional details
 * @returns {object} Moderation event object with enforcementSkipped flag
 */
export function createSkippedEnforcementEvent(action, reason, details = {}) {
  return {
    action: `${action}-skipped`,
    reason: `[PASSIVE MODE] ${reason}`,
    contentType: details.contentType || 'other',
    contentId: details.contentId || null,
    contentPreview: details.contentPreview || null,
    detectedViolations: details.detectedViolations || [],
    automated: true,
    enforcementSkipped: true,
    wouldHaveApplied: action,
    skippedBecause: 'LEGACY_PASSIVE_MODE',
    timestamp: new Date()
  };
}

/**
 * Wrap a penalty application with the legacy guard
 * If enforcement is not allowed, logs and returns without applying
 * 
 * @param {string} action - The action being attempted
 * @param {string} reason - Why the action is triggered
 * @param {Function} enforceFn - The function that applies the penalty
 * @param {object} context - Additional context for logging
 * @returns {Promise<{ enforced: boolean, skipped: boolean, event?: object }>}
 */
export async function guardedEnforcement(action, reason, enforceFn, context = {}) {
  if (legacyEnforcementAllowed()) {
    // Legacy enforcement is ACTIVE - apply penalty
    await enforceFn();
    return { enforced: true, skipped: false };
  }
  
  // Legacy enforcement is PASSIVE - log and skip
  logSkippedEnforcement(action, reason, context);
  
  const event = createSkippedEnforcementEvent(action, reason, context);
  
  return { 
    enforced: false, 
    skipped: true, 
    event 
  };
}

export default {
  legacyEnforcementAllowed,
  logSkippedEnforcement,
  createSkippedEnforcementEvent,
  guardedEnforcement
};

