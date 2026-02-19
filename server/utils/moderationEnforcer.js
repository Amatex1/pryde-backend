/**
 * PRYDE_MODERATION_ROLLOUT_V4 - Moderation Enforcer
 *
 * Enforcement gate that respects:
 * - Shadow mode (no penalties)
 * - Enabled actions (gradual rollout)
 * - V5-only enforcement authority (PRYDE_LEGACY_MODERATION_PASSIVE_MODE)
 *
 * RULES:
 * - If mode === SHADOW → no penalties applied, action = NOTE
 * - If action not enabled → downgrade to NOTE
 * - If event.system !== 'V5' → force action = NOTE (V5-only authority)
 * - All layers still execute and events are logged
 */

import { getModerationConfig, getCurrentPhase } from '../config/moderation.config.js';
import { ACTION_MAP_V2_TO_V4 } from '../contracts/moderation.contract.js';
import { isV5Primary } from '../config/moderationModes.js';
import ModerationSettings from '../models/ModerationSettings.js';
import User from '../models/User.js';
import logger from './logger.js';

/**
 * Enforce moderation decision based on current config
 * 
 * @param {Object} event - ModerationEvent or event-like object
 * @param {Object} options - Enforcement options
 * @param {Object} options.settings - Pre-fetched settings (optional)
 * @param {boolean} options.isSimulation - If true, always return shadowMode=true
 * @returns {Object} Enforced event with potentially modified action
 */
export async function enforceModeration(event, options = {}) {
  const { settings: preloadedSettings, isSimulation = false } = options;

  // Simulations are always shadow mode, no enforcement
  if (isSimulation) {
    return {
      ...event,
      shadowMode: true,
      response: {
        ...event.response,
        action: event.response?.action || 'NOTE'
      },
      _enforcement: {
        enforced: false,
        reason: 'SIMULATION',
        originalAction: event.response?.action
      }
    };
  }

  // PRYDE_LEGACY_MODERATION_PASSIVE_MODE: V5-only enforcement authority
  // If V5 is primary and event is from a non-V5 system, force NOTE
  if (isV5Primary() && event.system && event.system !== 'V5') {
    const originalAction = event.response?.action || 'ALLOW';
    logger.info('Non-V5 event downgraded to NOTE (V5 primary authority)', {
      eventSystem: event.system,
      originalAction,
      userId: event.userId
    });

    return {
      ...event,
      shadowMode: false,
      response: {
        ...event.response,
        action: 'NOTE',
        durationMinutes: 0
      },
      _enforcement: {
        enforced: false,
        reason: 'V5_PRIMARY_AUTHORITY',
        originalAction,
        nonV5System: event.system
      }
    };
  }

  // Get current config
  let settings = preloadedSettings;
  if (!settings) {
    try {
      settings = await ModerationSettings.findOne({});
    } catch (err) {
      logger.warn('Failed to fetch moderation settings for enforcement:', err);
    }
  }

  const config = getModerationConfig(settings);
  const originalAction = event.response?.action || 'ALLOW';

  // SHADOW MODE: No penalties, downgrade to NOTE
  if (config.mode === 'SHADOW') {
    return {
      ...event,
      shadowMode: true,
      response: {
        ...event.response,
        action: 'NOTE',
        durationMinutes: 0
      },
      _enforcement: {
        enforced: false,
        reason: 'SHADOW_MODE',
        originalAction,
        config: { mode: config.mode, phase: getCurrentPhase(config.enabledActions) }
      }
    };
  }

  // LIVE MODE: Check if action is enabled
  const actionEnabled = config.enabledActions[originalAction] === true;

  if (!actionEnabled) {
    // Downgrade to NOTE if action not enabled
    return {
      ...event,
      shadowMode: false,
      response: {
        ...event.response,
        action: 'NOTE',
        durationMinutes: 0
      },
      _enforcement: {
        enforced: false,
        reason: 'ACTION_NOT_ENABLED',
        originalAction,
        config: { mode: config.mode, phase: getCurrentPhase(config.enabledActions) }
      }
    };
  }

  // Action is enabled - enforce it
  return {
    ...event,
    shadowMode: false,
    _enforcement: {
      enforced: true,
      reason: 'ACTION_ENABLED',
      originalAction,
      config: { mode: config.mode, phase: getCurrentPhase(config.enabledActions) }
    }
  };
}

/**
 * Convert V2 action to V4 action and enforce
 * 
 * @param {string} v2Action - Legacy V2 action (e.g., 'VISIBILITY_DAMPEN')
 * @param {Object} eventData - Event data to enforce
 * @param {Object} options - Enforcement options
 * @returns {Object} Enforced event with V4 action
 */
export async function enforceV2Action(v2Action, eventData, options = {}) {
  const v4Action = ACTION_MAP_V2_TO_V4[v2Action] || 'ALLOW';

  const event = {
    ...eventData,
    response: {
      ...eventData.response,
      action: v4Action
    }
  };

  return enforceModeration(event, options);
}

/**
 * Check if an action would be enforced under current config
 * (Dry run without modifying event)
 * 
 * @param {string} action - V4 action to check
 * @param {Object} settings - Pre-fetched settings (optional)
 * @returns {Object} { wouldEnforce: boolean, reason: string }
 */
export async function wouldEnforce(action, settings = null) {
  if (!settings) {
    try {
      settings = await ModerationSettings.findOne({});
    } catch (err) {
      logger.warn('Failed to fetch settings for wouldEnforce check:', err);
    }
  }

  const config = getModerationConfig(settings);

  if (config.mode === 'SHADOW') {
    return { wouldEnforce: false, reason: 'SHADOW_MODE' };
  }

  if (config.enabledActions[action] !== true) {
    return { wouldEnforce: false, reason: 'ACTION_NOT_ENABLED' };
  }

  return { wouldEnforce: true, reason: 'ACTION_ENABLED' };
}

/**
 * PRYDE_SAFETY_HARDENING_V1: Risk threshold enforcement
 *
 * Called after riskScore updates to apply escalating consequences:
 *   riskScore >= 10 → temporary 24h posting restriction (probationUntil)
 *   riskScore >= 20 → auto-suspend account + flag for admin review
 *
 * @param {string} userId - The user whose riskScore to check
 * @returns {Object} { action: 'none'|'restrict'|'suspend', riskScore, riskLevel }
 */
export async function enforceRiskThreshold(userId) {
  if (!userId) return { action: 'none' };

  try {
    const user = await User.findById(userId).select('moderation username');
    if (!user?.moderation) return { action: 'none' };

    const riskScore = user.moderation.riskScore || 0;

    if (riskScore >= 20) {
      // Auto-suspend: set isMuted indefinitely + flag for admin review
      await User.findByIdAndUpdate(userId, {
        'moderation.isMuted': true,
        'moderation.muteExpires': null, // indefinite until admin reviews
        'moderation.muteReason': 'Auto-suspended: risk score threshold exceeded (≥20). Admin review required.',
        'moderation.riskLevel': 'high'
      });

      logger.warn('RISK_THRESHOLD: User auto-suspended (riskScore >= 20)', {
        userId,
        username: user.username,
        riskScore
      });

      return { action: 'suspend', riskScore, riskLevel: 'high' };
    }

    if (riskScore >= 10) {
      // Temporary 24h posting restriction via probationUntil
      const probationUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await User.findByIdAndUpdate(userId, {
        'moderation.probationUntil': probationUntil,
        'moderation.riskLevel': 'moderate'
      });

      logger.info('RISK_THRESHOLD: User posting restricted 24h (riskScore >= 10)', {
        userId,
        username: user.username,
        riskScore,
        probationUntil
      });

      return { action: 'restrict', riskScore, riskLevel: 'moderate', probationUntil };
    }

    // Below threshold — ensure riskLevel stays 'low'
    if (user.moderation.riskLevel !== 'low') {
      await User.findByIdAndUpdate(userId, { 'moderation.riskLevel': 'low' });
    }

    return { action: 'none', riskScore, riskLevel: 'low' };

  } catch (err) {
    logger.error('enforceRiskThreshold error:', err);
    return { action: 'none' };
  }
}

export default {
  enforceModeration,
  enforceV2Action,
  wouldEnforce,
  enforceRiskThreshold
};

