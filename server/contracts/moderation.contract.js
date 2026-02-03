/**
 * PRYDE_MODERATION_ROLLOUT_V4 - Data Contracts
 * 
 * SOURCE OF TRUTH for moderation data shapes.
 * Used by API responses and frontend consumption.
 * 
 * RULE: Frontend never recalculates moderation logic.
 * All display values come directly from these contracts.
 */

/**
 * V4 Content Types
 * @typedef {'post' | 'comment' | 'message' | 'global_chat'} ContentType
 */
export const CONTENT_TYPES = ['post', 'comment', 'message', 'global_chat'];

/**
 * V4 Expression Classifications
 * @typedef {'normal' | 'emphatic'} ExpressionClassification
 */
export const EXPRESSION_CLASSIFICATIONS = ['normal', 'emphatic'];

/**
 * V4 Intent Categories
 * @typedef {'expressive' | 'neutral' | 'disruptive' | 'hostile' | 'dangerous'} IntentCategory
 */
export const INTENT_CATEGORIES = ['expressive', 'neutral', 'disruptive', 'hostile', 'dangerous'];

/**
 * V4 Behavior Trends
 * @typedef {'stable' | 'rising' | 'falling'} BehaviorTrend
 */
export const BEHAVIOR_TRENDS = ['stable', 'rising', 'falling'];

/**
 * V4 Response Actions (simplified from V2)
 * @typedef {'ALLOW' | 'NOTE' | 'DAMPEN' | 'REVIEW' | 'MUTE' | 'BLOCK'} ResponseAction
 */
export const RESPONSE_ACTIONS = ['ALLOW', 'NOTE', 'DAMPEN', 'REVIEW', 'MUTE', 'BLOCK'];

/**
 * V4 Explanation Codes
 * Human-first language codes for moderation explanations
 */
export const EXPLANATION_CODES = {
  ALLOWED: 'ALLOWED',
  EXPRESSIVE_ALLOWED: 'EXPRESSIVE_ALLOWED',
  NOTE_APPLIED: 'NOTE_APPLIED',
  FLAGGED_FOR_MONITORING: 'FLAGGED_FOR_MONITORING',
  VISIBILITY_DAMPENED: 'VISIBILITY_DAMPENED',
  FREQUENCY_DAMPENED: 'FREQUENCY_DAMPENED',
  QUEUED_FOR_REVIEW: 'QUEUED_FOR_REVIEW',
  NEEDS_CONTEXT_CHECK: 'NEEDS_CONTEXT_CHECK',
  TEMPORARILY_MUTED: 'TEMPORARILY_MUTED',
  COOLDOWN_APPLIED: 'COOLDOWN_APPLIED',
  CONTENT_BLOCKED: 'CONTENT_BLOCKED',
  SAFETY_TRIGGERED: 'SAFETY_TRIGGERED'
};

/**
 * Map legacy V2 actions to V4 actions
 */
export const ACTION_MAP_V2_TO_V4 = {
  'ALLOW': 'ALLOW',
  'ALLOW_WITH_INTERNAL_NOTE': 'NOTE',
  'VISIBILITY_DAMPEN': 'DAMPEN',
  'QUEUE_FOR_REVIEW': 'REVIEW',
  'TEMP_MUTE': 'MUTE',
  'HARD_BLOCK': 'BLOCK'
};

/**
 * Map V4 actions to explanation codes
 */
export const ACTION_TO_EXPLANATION = {
  'ALLOW': 'ALLOWED',
  'NOTE': 'NOTE_APPLIED',
  'DAMPEN': 'VISIBILITY_DAMPENED',
  'REVIEW': 'QUEUED_FOR_REVIEW',
  'MUTE': 'TEMPORARILY_MUTED',
  'BLOCK': 'CONTENT_BLOCKED'
};

/**
 * Build a V4 ModerationEvent contract shape
 * @param {Object} data - Raw moderation data
 * @returns {Object} V4 ModerationEvent contract
 */
export function buildModerationEventContract(data) {
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
      action: data.response?.action || 'ALLOW',
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
  EXPLANATION_CODES,
  ACTION_MAP_V2_TO_V4,
  ACTION_TO_EXPLANATION,
  buildModerationEventContract
};

