/**
 * PRYDE_LEGACY_MODERATION_PASSIVE_MODE
 * 
 * Global moderation mode flags that determine which moderation system
 * has enforcement authority.
 * 
 * PASSIVE mode: Legacy system detects and logs but does NOT apply penalties
 * ACTIVE mode: Legacy system applies penalties as normal
 * 
 * V5 is always the primary moderation system when legacy is PASSIVE.
 */

export const moderationModes = {
  /**
   * Legacy moderation mode
   * PASSIVE = detect and log only, no penalties
   * ACTIVE = full enforcement (mute, ban, strike accumulation)
   */
  legacy: 'PASSIVE',

  /**
   * Primary moderation system
   * V5 = PRYDE_MODERATION_SAFE_ROLLOUT_V5 is the sole authority
   */
  primary: 'V5'
};

/**
 * Check if legacy moderation enforcement is allowed
 * @returns {boolean} true if legacy system may apply penalties
 */
export function isLegacyEnforcementActive() {
  return moderationModes.legacy === 'ACTIVE';
}

/**
 * Check if V5 is the primary moderation system
 * @returns {boolean} true if V5 has sole enforcement authority
 */
export function isV5Primary() {
  return moderationModes.primary === 'V5';
}

/**
 * Get current moderation mode summary
 * @returns {{ legacy: string, primary: string, legacyEnforcementAllowed: boolean }}
 */
export function getModerationModes() {
  return {
    legacy: moderationModes.legacy,
    primary: moderationModes.primary,
    legacyEnforcementAllowed: isLegacyEnforcementActive()
  };
}

export default moderationModes;

