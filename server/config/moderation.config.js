/**
 * PRYDE_MODERATION_ROLLOUT_V4 - Moderation Configuration
 * 
 * SHADOW MODE BY DEFAULT for safe rollout.
 * Gradual enablement of enforcement actions.
 * 
 * ROLLOUT ORDER:
 * 1. NOTE (enabled by default - logging only)
 * 2. DAMPEN (enable after 48-72h observation)
 * 3. REVIEW (enable after DAMPEN is stable)
 * 4. MUTE (enable after REVIEW is stable)
 * 5. BLOCK (enable last, after all others stable)
 * 
 * NO BULK ENABLES. NO SILENT CHANGES.
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

  // Which actions are enabled for enforcement
  // In SHADOW mode, all actions downgrade to NOTE
  // In LIVE mode, disabled actions downgrade to NOTE
  enabledActions: {
    NOTE: true,     // Always enabled - logging only
    DAMPEN: false,  // Visibility dampening (non-punitive)
    REVIEW: false,  // Queue for human review
    MUTE: false,    // Temporary mute
    BLOCK: false    // Hard block content
  },

  // Rollout tracking
  rollout: {
    startedAt: null,
    currentPhase: 0,  // 0 = shadow only, 1-5 = action phases
    phaseHistory: []  // Track when each phase was enabled
  }
};

/**
 * Rollout phases for gradual enablement
 */
export const ROLLOUT_PHASES = [
  { phase: 0, name: 'Shadow Only', actions: ['NOTE'], description: 'All layers execute, no penalties' },
  { phase: 1, name: 'Logging', actions: ['NOTE'], description: 'NOTE action enabled in LIVE mode' },
  { phase: 2, name: 'Dampening', actions: ['NOTE', 'DAMPEN'], description: 'Visibility dampening enabled' },
  { phase: 3, name: 'Review Queue', actions: ['NOTE', 'DAMPEN', 'REVIEW'], description: 'Human review queue enabled' },
  { phase: 4, name: 'Muting', actions: ['NOTE', 'DAMPEN', 'REVIEW', 'MUTE'], description: 'Temporary muting enabled' },
  { phase: 5, name: 'Full Enforcement', actions: ['NOTE', 'DAMPEN', 'REVIEW', 'MUTE', 'BLOCK'], description: 'All actions enabled' }
];

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
 * Get the current rollout phase based on enabled actions
 * @param {Object} enabledActions - Map of action -> boolean
 * @returns {Object} Current phase info
 */
export function getCurrentPhase(enabledActions) {
  let currentPhase = 0;

  if (enabledActions.BLOCK) currentPhase = 5;
  else if (enabledActions.MUTE) currentPhase = 4;
  else if (enabledActions.REVIEW) currentPhase = 3;
  else if (enabledActions.DAMPEN) currentPhase = 2;
  else if (enabledActions.NOTE) currentPhase = 1;

  return ROLLOUT_PHASES[currentPhase];
}

/**
 * Validate that a phase transition is safe (only one step at a time)
 * @param {number} currentPhase - Current phase number
 * @param {number} targetPhase - Target phase number
 * @returns {Object} { valid: boolean, message: string }
 */
export function validatePhaseTransition(currentPhase, targetPhase) {
  if (targetPhase < 0 || targetPhase > 5) {
    return { valid: false, message: 'Invalid phase number (must be 0-5)' };
  }

  if (targetPhase > currentPhase + 1) {
    return { valid: false, message: `Cannot skip phases. Current: ${currentPhase}, Target: ${targetPhase}. Enable one action at a time.` };
  }

  return { valid: true, message: 'Phase transition allowed' };
}

export default {
  DEFAULT_MODERATION_CONFIG,
  ROLLOUT_PHASES,
  getModerationConfig,
  getCurrentPhase,
  validatePhaseTransition
};

