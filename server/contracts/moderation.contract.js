/**
 * PRYDE_MODERATION_SAFE_ROLLOUT_V5 - Data Contracts
 *
 * SOURCE OF TRUTH for moderation data shapes.
 * Used by API responses and frontend consumption.
 *
 * V5 SAFE ROLLOUT:
 * - Limited to ALLOW, NOTE, DAMPEN only
 * - No REVIEW, MUTE, BLOCK in initial rollout
 * - Shadow mode first, always
 *
 * RULE: Frontend never recalculates moderation logic.
 * All display values come directly from these contracts.
 */

/**
 * V5 Content Types
 * @typedef {'post' | 'comment' | 'message' | 'global_chat'} ContentType
 */
export const CONTENT_TYPES = ['post', 'comment', 'message', 'global_chat'];

/**
 * V5 Expression Classifications
 * @typedef {'normal' | 'emphatic'} ExpressionClassification
 */
export const EXPRESSION_CLASSIFICATIONS = ['normal', 'emphatic'];

/**
 * V5 Intent Categories
 * @typedef {'expressive' | 'neutral' | 'disruptive' | 'hostile' | 'dangerous'} IntentCategory
 */
export const INTENT_CATEGORIES = ['expressive', 'neutral', 'disruptive', 'hostile', 'dangerous'];

/**
 * V5 Behavior Trends
 * @typedef {'stable' | 'rising' | 'falling'} BehaviorTrend
 */
export const BEHAVIOR_TRENDS = ['stable', 'rising', 'falling'];

/**
 * V5 Response Actions (SAFE ROLLOUT - NOTE and DAMPEN only)
 * REVIEW, MUTE, BLOCK are reserved for future phases
 * @typedef {'ALLOW' | 'NOTE' | 'DAMPEN'} ResponseAction
 */
export const RESPONSE_ACTIONS = ['ALLOW', 'NOTE', 'DAMPEN'];

/**
 * V5 Reserved Actions (not enabled in safe rollout)
 * These will be enabled in future phases after observation
 */
export const RESERVED_ACTIONS = ['REVIEW', 'MUTE', 'BLOCK'];

/**
 * All possible actions (for reference/mapping)
 */
export const ALL_ACTIONS = ['ALLOW', 'NOTE', 'DAMPEN', 'REVIEW', 'MUTE', 'BLOCK'];

/**
 * V5 Explanation Codes
 * Human-first language codes for moderation explanations
 * V5 Safe Rollout: Only codes for ALLOW, NOTE, DAMPEN are active
 */
export const EXPLANATION_CODES = {
  ALLOWED: 'ALLOWED',
  EXPRESSIVE_ALLOWED: 'EXPRESSIVE_ALLOWED',
  NOTE_APPLIED: 'NOTE_APPLIED',
  FLAGGED_FOR_MONITORING: 'FLAGGED_FOR_MONITORING',
  VISIBILITY_DAMPENED: 'VISIBILITY_DAMPENED',
  FREQUENCY_DAMPENED: 'FREQUENCY_DAMPENED'
  // RESERVED: QUEUED_FOR_REVIEW, TEMPORARILY_MUTED, CONTENT_BLOCKED, etc.
};

/**
 * Map legacy V2 actions to V5 actions
 * V5: Reserved actions (REVIEW, MUTE, BLOCK) are downgraded to NOTE
 */
export const ACTION_MAP_V2_TO_V5 = {
  'ALLOW': 'ALLOW',
  'ALLOW_WITH_INTERNAL_NOTE': 'NOTE',
  'VISIBILITY_DAMPEN': 'DAMPEN',
  // V5: Reserved actions downgrade to NOTE
  'QUEUE_FOR_REVIEW': 'NOTE',
  'TEMP_MUTE': 'NOTE',
  'HARD_BLOCK': 'NOTE'
};

// Legacy alias for compatibility
export const ACTION_MAP_V2_TO_V4 = ACTION_MAP_V2_TO_V5;

/**
 * Map V5 actions to explanation codes
 * V5: Only ALLOW, NOTE, DAMPEN are active
 */
export const ACTION_TO_EXPLANATION = {
  'ALLOW': 'ALLOWED',
  'NOTE': 'NOTE_APPLIED',
  'DAMPEN': 'VISIBILITY_DAMPENED'
};

/**
 * Build a V5 ModerationEvent contract shape
 * @param {Object} data - Raw moderation data
 * @returns {Object} V5 ModerationEvent contract
 */
export function buildModerationEventContract(data) {
  // V5: Ensure action is within safe rollout scope
  let action = data.response?.action || 'ALLOW';
  if (!RESPONSE_ACTIONS.includes(action)) {
    // V5: Downgrade reserved actions to NOTE
    action = 'NOTE';
  }

  return {
    id: data.id || data._id?.toString() || 'SIMULATION',
    contentId: data.contentId?.toString() || null,
    contentType: data.contentType || 'post',
    contentPreview: data.contentPreview || '',
    userId: data.userId?.toString() || null,
    createdAt: data.createdAt?.toISOString?.() || data.createdAt || null,

    expression: {
      classification: data.expression?.classification || 'normal',
      expressiveRatio: data.expression?.expressiveRatio || 0,
      realWordRatio: data.expression?.realWordRatio || 0
    },

    intent: {
      category: data.intent?.category || 'neutral',
      score: data.intent?.score || 0,
      targetDetected: data.intent?.targetDetected || false
    },

    behavior: {
      score: data.behavior?.score || 0,
      trend: data.behavior?.trend || 'stable',
      accountAgeDays: data.behavior?.accountAgeDays || 0
    },

    response: {
      action: action,
      durationMinutes: data.response?.durationMinutes || 0,
      automated: data.response?.automated !== false
    },

    confidence: data.confidence || 0,
    explanationCode: data.explanationCode || 'ALLOWED',
    shadowMode: data.shadowMode || false,
    overridden: data.overridden || false
  };
}

export default {
  CONTENT_TYPES,
  EXPRESSION_CLASSIFICATIONS,
  INTENT_CATEGORIES,
  BEHAVIOR_TRENDS,
  RESPONSE_ACTIONS,
  RESERVED_ACTIONS,
  ALL_ACTIONS,
  EXPLANATION_CODES,
  ACTION_MAP_V2_TO_V5,
  ACTION_MAP_V2_TO_V4,
  ACTION_TO_EXPLANATION,
  buildModerationEventContract
};

