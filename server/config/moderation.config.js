/**
 * PRYDE_MODERATION_SAFE_ROLLOUT_V5 - Moderation Configuration
 *
 * V5 SAFE ROLLOUT:
 * - SHADOW mode by default (7-day minimum observation)
 * - Limited to NOTE and DAMPEN only
 * - No REVIEW, MUTE, BLOCK in initial rollout
 *
 * ROLLOUT ORDER:
 * Phase 0: Shadow Only (7 days minimum)
 * Phase 1: NOTE enabled in LIVE mode (48-72h observation)
 * Phase 2: DAMPEN enabled - STOP and observe
 *
 * NO BULK ENABLES. NO SILENT CHANGES.
 * ADVANCE ONLY WHEN FALSE POSITIVES ARE RARE AND ADMINS TRUST THE SYSTEM.
 */

/**
 * Default moderation configuration
 * This is the source of truth for moderation behavior.
 * Can be overridden by database settings.
 */
export const DEFAULT_MODERATION_CONFIG = {
  // SHADOW = all layers execute, events logged, NO penalties applied
  // LIVE = penalties applied according to enabledActions
  mode: 'SHADOW',

  // V5: Which actions are enabled for enforcement
  // Only NOTE and DAMPEN are available in V5 safe rollout
  // REVIEW, MUTE, BLOCK are reserved for future phases
  enabledActions: {
    NOTE: true,     // Always enabled - logging only
    DAMPEN: false   // Visibility dampening (non-punitive)
    // V5: REVIEW, MUTE, BLOCK removed from safe rollout
  },

  // Rollout tracking
  rollout: {
    startedAt: null,
    currentPhase: 0,  // 0 = shadow only, 1-2 = action phases
    phaseHistory: []  // Track when each phase was enabled
  }
};

/**
 * V5 Rollout phases - simplified to 3 phases only
 * Stop after DAMPEN and observe before considering future phases
 */
export const ROLLOUT_PHASES = [
  {
    phase: 0,
    name: 'Shadow Only',
    actions: ['NOTE'],
    description: 'All layers execute, no penalties. Observe for 7 days minimum.',
    minObservationDays: 7
  },
  {
    phase: 1,
    name: 'Logging',
    actions: ['NOTE'],
    description: 'NOTE action enabled in LIVE mode. Observe for 48-72 hours.',
    minObservationDays: 2
  },
  {
    phase: 2,
    name: 'Dampening',
    actions: ['NOTE', 'DAMPEN'],
    description: 'Visibility dampening enabled (non-punitive). STOP and observe before future phases.',
    minObservationDays: 7
  }
];

/**
 * V5 Max phase - stop at phase 2 for safe rollout
 */
export const MAX_PHASE = 2;

/**
 * Get the current moderation config from database or defaults
 * @param {Object} dbSettings - Settings from ModerationSettings model
 * @returns {Object} Merged configuration
 */
export function getModerationConfig(dbSettings = null) {
  const config = { ...DEFAULT_MODERATION_CONFIG };

  if (dbSettings?.moderationV2) {
    // Override mode from database
    if (dbSettings.moderationV2.moderationMode) {
      config.mode = dbSettings.moderationV2.moderationMode;
    }

    // Override enabled actions from database
    if (dbSettings.moderationV2.enabledActions) {
      config.enabledActions = {
        ...config.enabledActions,
        ...dbSettings.moderationV2.enabledActions
      };
    }

    // Override rollout tracking from database
    if (dbSettings.moderationV2.rollout) {
      config.rollout = {
        ...config.rollout,
        ...dbSettings.moderationV2.rollout
      };
    }
  }

  return config;
}

/**
 * V5: Get the current rollout phase based on enabled actions
 * Only NOTE and DAMPEN are tracked in V5 safe rollout
 * @param {Object} enabledActions - Map of action -> boolean
 * @returns {Object} Current phase info
 */
export function getCurrentPhase(enabledActions) {
  let currentPhase = 0;

  // V5: Only check NOTE and DAMPEN
  if (enabledActions.DAMPEN) currentPhase = 2;
  else if (enabledActions.NOTE) currentPhase = 1;

  // Clamp to max phase
  currentPhase = Math.min(currentPhase, MAX_PHASE);

  return ROLLOUT_PHASES[currentPhase] || ROLLOUT_PHASES[0];
}

/**
 * V5: Validate that a phase transition is safe (only one step at a time)
 * Max phase is 2 (DAMPEN) for safe rollout
 * @param {number} currentPhase - Current phase number
 * @param {number} targetPhase - Target phase number
 * @returns {Object} { valid: boolean, message: string }
 */
export function validatePhaseTransition(currentPhase, targetPhase) {
  if (targetPhase < 0 || targetPhase > MAX_PHASE) {
    return {
      valid: false,
      message: `Invalid phase number (must be 0-${MAX_PHASE}). V5 safe rollout is limited to NOTE and DAMPEN only.`
    };
  }

  if (targetPhase > currentPhase + 1) {
    return {
      valid: false,
      message: `Cannot skip phases. Current: ${currentPhase}, Target: ${targetPhase}. Enable one action at a time.`
    };
  }

  return { valid: true, message: 'Phase transition allowed' };
}

/**
 * V5: Check if an action is allowed in safe rollout
 * @param {string} action - Action to check
 * @returns {boolean} Whether action is allowed in V5
 */
export function isV5Action(action) {
  return ['NOTE', 'DAMPEN'].includes(action);
}

export default {
  DEFAULT_MODERATION_CONFIG,
  ROLLOUT_PHASES,
  MAX_PHASE,
  getModerationConfig,
  getCurrentPhase,
  validatePhaseTransition,
  isV5Action
};

