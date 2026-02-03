import User from '../models/User.js';
import logger from './logger.js';

/**
 * PRYDE_MODERATION_V2 - 5-Layer Intent-Driven Moderation System
 *
 * CONSTRAINTS:
 * - Layer 1: CLASSIFICATION ONLY - never triggers blocks/mutes/decay
 * - Intent: Categorical (expressive/neutral/disruptive/hostile/dangerous) - not toxicity score
 * - Behavior score outweighs formatting signals
 * - Visibility dampening: Non-punitive, temporary, reversible
 * - Admin override: Full undo/restore/remove history/manual actions
 */

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 1: EXPRESSION FILTER (CLASSIFICATION ONLY)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * LAYER_1: Expression Filter - Classifies content expression patterns
 * CONSTRAINT: CLASSIFICATION ONLY - NEVER triggers blocks, mutes, decay, or penalties
 * Output used for logging and context only
 */
function layer1_expressionFilter(content) {
  if (!content || typeof content !== 'string') {
    return {
      expressive_ratio: 0,
      real_word_ratio: 0,
      formatting_signals: [],
      classification: 'neutral'
    };
  }

  const words = content.split(/\s+/).filter(w => w.length > 0);
  const totalChars = content.length;

  // Expressive ratio: proportion of expressive punctuation
  const expressiveChars = (content.match(/[!?]{2,}|\.{3,}|💥|🔥|😡|🤬|❤️|💔|✨|🌟|💯/g) || []).length;
  const expressive_ratio = totalChars > 0 ? expressiveChars / totalChars : 0;

  // Real word ratio: proportion of dictionary words vs total words
  const realWords = words.filter(word => {
    const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
    return cleanWord.length >= 3 && /^[a-zA-Z]+$/.test(cleanWord);
  });
  const real_word_ratio = words.length > 0 ? realWords.length / words.length : 0;

  // Formatting signals (for context, not penalties)
  const formatting_signals = [];
  if (content.includes('!!!') || content.includes('???')) formatting_signals.push('multiple_exclamation');
  if (content.match(/[A-Z]{5,}/)) formatting_signals.push('caps_streak');
  if ((content.match(/[\u{1F600}-\u{1F64F}]/gu) || []).length > 3) formatting_signals.push('emoji_rich');
  if (content.match(/(.)\1{4,}/)) formatting_signals.push('repeated_chars');

  // Classification (context only)
  let classification = 'neutral';
  if (expressive_ratio > 0.1 || formatting_signals.length > 2) {
    classification = 'expressive';
  } else if (real_word_ratio < 0.3) {
    classification = 'symbolic';
  }

  return {
    expressive_ratio: Math.round(expressive_ratio * 100) / 100,
    real_word_ratio: Math.round(real_word_ratio * 100) / 100,
    formatting_signals,
    classification
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 2: INTENT ANALYSIS (CATEGORICAL)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * LAYER_2: Intent Analysis - Categorizes intent as expressive/neutral/disruptive/hostile/dangerous
 * CONSTRAINT: Categorical, NOT a toxicity score. Hostile requires target + harm direction.
 */
function layer2_intentAnalysis(content, userContext = {}) {
  if (!content || typeof content !== 'string') {
    return {
      intent_category: 'neutral',
      intent_score: 0,
      targets: [],
      hostility_markers: [],
      threat_patterns: [],
      confidence: 0,
      explanation: 'No content to analyze'
    };
  }

  const lowerContent = content.toLowerCase();
  let intent_category = 'neutral';
  let intent_score = 0; // 0-100 scale for internal use
  const targets = [];
  const hostility_markers = [];
  const threat_patterns = [];
  let confidence = 50;

  // Target detection (who is being addressed or threatened?)
  const targetPatterns = [
    /\b(you|u|your|ur|urs)\b/i,  // direct address
    /\b(them|him|her|their|his|hers)\b/i,  // third person references
    /\b(everyone|everybody|anyone|anybody|someone|somebody)\b/i,  // group references
    /\b(go)?\s*(kill|die|hurt)\s*(yourself|urself)\b/i,  // self-harm directed
    /\b(i\s+)?\b(hope|wish)\b.*\b(die|dead|hurt)\b.*\b(you|u)\b/i,  // death wishes directed
    /\b(fuck|shit|damn|crap)\b.*\b(you|u|your|ur)\b/i,  // directed profanity
    /\b(you|u)\b.*\b(fucking|shitty|damn|stupid|worthless|idiot)\b/i  // insults directed
  ];

  for (const pattern of targetPatterns) {
    if (pattern.test(lowerContent)) {
      targets.push(pattern.source);
    }
  }

  // Hostility markers (aggressive language)
  const hostilityPatterns = [
    /\b(hate|despise|loathe)\b.*\b(you|u|them|him|her)\b/i,
    /\b(fuck|shit|damn|crap)\b.*\b(off|you|u)\b/i,
    /\b(go\s+to\s+hell|burn\s+in\s+hell|rot\s+in\s+hell)\b/i,
    /\b(wish|hope)\b.*\b(would|you|u)\b.*\b(die|dead|hurt)\b/i,
    /\b(i\s+)?\b(want|wish)\b.*\b(to\s+)?\b(kill|hurt|hit)\b/i
  ];

  for (const pattern of hostilityPatterns) {
    if (pattern.test(lowerContent)) {
      hostility_markers.push(pattern.source);
    }
  }

  // Threat patterns (direct harm indicators)
  const threatPatterns = [
    /\b(i\s+will|im\s+gonna|gonna)\b.*\b(kill|hurt|hit|beat|rape|attack)\b/i,
    /\b(you|u)\b.*\b(will|are\s+gonna)\b.*\b(die|dead|hurt)\b/i,
    /\b(ill|im\s+gonna)\b.*\b(find|come\s+to|get)\b.*\b(you|u)\b/i,
    /\b(threat|warning|danger)\b.*\b(to|for)\b.*\b(you|u|life)\b/i
  ];

  for (const pattern of threatPatterns) {
    if (pattern.test(lowerContent)) {
      threat_patterns.push(pattern.source);
    }
  }

  // Intent categorization logic
  const hasTargets = targets.length > 0;
  const hasHostility = hostility_markers.length > 0;
  const hasThreats = threat_patterns.length > 0;

  if (hasThreats && hasTargets) {
    intent_category = 'dangerous';
    intent_score = 90;
    confidence = 85;
  } else if (hasHostility && hasTargets) {
    intent_category = 'hostile';
    intent_score = 75;
    confidence = 80;
  } else if (hasHostility || hasThreats) {
    intent_category = 'disruptive';
    intent_score = 60;
    confidence = 70;
  } else if (targets.length > 0) {
    intent_category = 'disruptive';
    intent_score = 45;
    confidence = 65;
  } else {
    // Check for expressive patterns
    const expressiveWords = /\b(fuck|shit|damn|crap|hell)\b.*\b(yes|no|really|so|very|totally|absolutely)\b/i;
    const emphasis = /\b(so|very|really|totally|absolutely|definitely)\b.*\b(much|many|good|bad|stupid|crazy)\b/i;

    if (expressiveWords.test(lowerContent) || emphasis.test(lowerContent)) {
      intent_category = 'expressive';
      intent_score = 20;
      confidence = 60;
    } else {
      intent_category = 'neutral';
      intent_score = 0;
      confidence = 90;
    }
  }

  // Context adjustment (user history, etc.)
  if (userContext.recentHostileContent) {
    intent_score += 10;
    confidence += 5;
  }

  // Cap scores
  intent_score = Math.min(100, Math.max(0, intent_score));
  confidence = Math.min(100, Math.max(0, confidence));

  const explanation = `${intent_category} intent detected (${intent_score} score, ${confidence}% confidence)`;

  return {
    intent_category,
    intent_score,
    targets,
    hostility_markers,
    threat_patterns,
    confidence,
    explanation
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 3: BEHAVIOR ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * LAYER_3: Behavior Analysis - Analyzes user behavior patterns
 * CONSTRAINT: Behavior score outweighs formatting signals for escalation
 */
async function layer3_behaviorAnalysis(userId, content, recentContent = []) {
  if (!userId) {
    return {
      behavior_score: 0,
      frequency_score: 0,
      duplicate_score: 0,
      account_age_score: 0,
      history_score: 0,
      explanation: 'No user context available'
    };
  }

  try {
    const user = await User.findById(userId).select('createdAt moderation moderationHistory');

    if (!user) {
      return {
        behavior_score: 0,
        frequency_score: 0,
        duplicate_score: 0,
        account_age_score: 0,
        history_score: 0,
        explanation: 'User not found'
      };
    }

    let behavior_score = 0;
    let frequency_score = 0;
    let duplicate_score = 0;
    let account_age_score = 0;
    let history_score = 0;

    // Account age score (newer accounts = higher scrutiny)
    const accountAgeDays = Math.floor((Date.now() - user.createdAt) / (1000 * 60 * 60 * 24));
    if (accountAgeDays < 1) account_age_score = 50;      // < 1 day
    else if (accountAgeDays < 7) account_age_score = 30;  // < 1 week
    else if (accountAgeDays < 30) account_age_score = 15; // < 1 month
    else account_age_score = 0;                           // > 1 month

    // History score (past violations increase scrutiny)
    if (user.moderation) {
      const violationCount = user.moderation.violationCount || 0;
      const spamCount = user.moderation.spamViolationCount || 0;
      const slurCount = user.moderation.slurViolationCount || 0;

      history_score = Math.min(50, (violationCount + spamCount + slurCount) * 5);
    }

    // Frequency score (recent activity patterns)
    if (recentContent && recentContent.length > 0) {
      const now = Date.now();
      const recentWindow = 5 * 60 * 1000; // 5 minutes
      const veryRecent = recentContent.filter(item =>
        (now - new Date(item.timestamp || item.createdAt)) < recentWindow
      );

      if (veryRecent.length >= 5) frequency_score = 40;      // 5+ in 5 min
      else if (veryRecent.length >= 3) frequency_score = 25; // 3-4 in 5 min
      else if (veryRecent.length >= 2) frequency_score = 10; // 2 in 5 min
    }

    // Duplicate score (similar content)
    if (recentContent && recentContent.length > 0) {
      const similarContent = recentContent.filter(item => {
        if (!item.content) return false;
        // Simple similarity check (could be enhanced with better algorithms)
        const similarity = calculateSimilarity(content, item.content);
        return similarity > 0.8; // 80% similar
      });

      if (similarContent.length >= 3) duplicate_score = 35;
      else if (similarContent.length >= 2) duplicate_score = 20;
      else if (similarContent.length >= 1) duplicate_score = 5;
    }

    // Combine scores (behavior score is weighted average)
    behavior_score = Math.round(
      (frequency_score * 0.3) +
      (duplicate_score * 0.25) +
      (account_age_score * 0.2) +
      (history_score * 0.25)
    );

    behavior_score = Math.min(100, Math.max(0, behavior_score));

    const explanation = `Behavior score: ${behavior_score} (frequency: ${frequency_score}, duplicates: ${duplicate_score}, age: ${account_age_score}, history: ${history_score})`;

    return {
      behavior_score,
      frequency_score,
      duplicate_score,
      account_age_score,
      history_score,
      explanation
    };

  } catch (error) {
    logger.error('Behavior analysis error:', error);
    return {
      behavior_score: 0,
      frequency_score: 0,
      duplicate_score: 0,
      account_age_score: 0,
      history_score: 0,
      explanation: 'Error analyzing behavior'
    };
  }
}

/**
 * Simple content similarity calculation (0-1 scale)
 */
function calculateSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;

  const words1 = text1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const words2 = text2.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  if (words1.length === 0 || words2.length === 0) return 0;

  const set1 = new Set(words1);
  const set2 = new Set(words2);

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 4: RESPONSE ENGINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * LAYER_4: Response Engine - Combines scores and determines action
 * CONSTRAINT: Visibility dampening is non-punitive, temporary, reversible
 */
function layer4_responseEngine(layer1, layer2, layer3) {
  const { intent_category, intent_score } = layer2;
  const { behavior_score } = layer3;

  // Combined risk score (weighted)
  const combined_score = Math.round(
    (intent_score * 0.6) + (behavior_score * 0.4)
  );

  let action = 'ALLOW';
  let action_reason = '';
  let confidence = 0;
  let dampening_duration = 0; // minutes
  let queue_priority = 'normal';

  // Decision logic based on intent + behavior
  if (intent_category === 'dangerous') {
    if (combined_score >= 80) {
      action = 'HARD_BLOCK';
      action_reason = 'Dangerous content with high risk indicators';
      confidence = 95;
    } else if (combined_score >= 60) {
      action = 'TEMP_MUTE';
      action_reason = 'Dangerous content requiring immediate intervention';
      confidence = 90;
      dampening_duration = 60; // 1 hour
    } else {
      action = 'QUEUE_FOR_REVIEW';
      action_reason = 'Potentially dangerous content needs human review';
      confidence = 85;
      queue_priority = 'high';
    }
  } else if (intent_category === 'hostile') {
    if (combined_score >= 70) {
      action = 'TEMP_MUTE';
      action_reason = 'Hostile content with concerning behavior patterns';
      confidence = 85;
      dampening_duration = 30; // 30 minutes
    } else if (combined_score >= 50) {
      action = 'VISIBILITY_DAMPEN';
      action_reason = 'Hostile content - temporarily reduced visibility';
      confidence = 80;
      dampening_duration = 15; // 15 minutes
    } else {
      action = 'ALLOW_WITH_INTERNAL_NOTE';
      action_reason = 'Hostile content flagged for monitoring';
      confidence = 75;
    }
  } else if (intent_category === 'disruptive') {
    if (behavior_score >= 60) {
      action = 'VISIBILITY_DAMPEN';
      action_reason = 'Disruptive behavior pattern detected';
      confidence = 75;
      dampening_duration = 10; // 10 minutes
    } else if (behavior_score >= 40) {
      action = 'ALLOW_WITH_INTERNAL_NOTE';
      action_reason = 'Disruptive content flagged for monitoring';
      confidence = 70;
    } else {
      action = 'ALLOW';
      action_reason = 'Disruptive but within acceptable bounds';
      confidence = 65;
    }
  } else if (intent_category === 'expressive') {
    if (behavior_score >= 70) {
      action = 'ALLOW_WITH_INTERNAL_NOTE';
      action_reason = 'High-expression content with elevated behavior score';
      confidence = 70;
    } else {
      action = 'ALLOW';
      action_reason = 'Expressive content permitted';
      confidence = 80;
    }
  } else { // neutral
    if (behavior_score >= 80) {
      action = 'VISIBILITY_DAMPEN';
      action_reason = 'Neutral content but extreme behavior patterns';
      confidence = 75;
      dampening_duration = 5; // 5 minutes
    } else {
      action = 'ALLOW';
      action_reason = 'Neutral content with acceptable behavior';
      confidence = 90;
    }
  }

  return {
    action,
    action_reason,
    combined_score,
    confidence,
    dampening_duration,
    queue_priority,
    layer_breakdown: {
      intent_category,
      intent_score,
      behavior_score,
      combined_score
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 5: HUMAN OVERRIDE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * LAYER_5: Human Override - Admin tools for reversal and manual actions
 * CONSTRAINT: Full undo/restore/remove history/manual actions
 */
async function layer5_humanOverride(userId, action, overrideReason, adminId) {
  if (!userId || !adminId) {
    throw new Error('User ID and admin ID required for override');
  }

  try {
    const user = await User.findById(userId).select('moderation moderationHistory');

    if (!user) {
      throw new Error('User not found');
    }

    // Ensure moderationHistory exists
    if (!user.moderationHistory) {
      user.moderationHistory = [];
    }

    // Record the override action
    const overrideEntry = {
      action: `admin_override_${action}`,
      reason: overrideReason,
      contentType: 'admin_action',
      moderatorId: adminId,
      timestamp: new Date(),
      automated: false,
      override: true,
      layer_outputs: {
        override_action: action,
        override_reason: overrideReason
      }
    };

    user.moderationHistory.push(overrideEntry);
    await user.save();

    return {
      success: true,
      override_action: action,
      override_reason: overrideReason,
      timestamp: overrideEntry.timestamp
    };

  } catch (error) {
    logger.error('Human override error:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN MODERATION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Main moderation function - processes content through all 5 layers
 */
export async function moderateContentV2(content, userId, options = {}) {
  const {
    recentContent = [],
    userContext = {},
    skipLayers = [],
    returnAllLayers = false
  } = options;

  try {
    // LAYER 1: Expression Filter (always runs, classification only)
    const layer1 = layer1_expressionFilter(content);

    // LAYER 2: Intent Analysis
    const layer2 = layer2_intentAnalysis(content, userContext);

    // LAYER 3: Behavior Analysis
    const layer3 = await layer3_behaviorAnalysis(userId, content, recentContent);

    // LAYER 4: Response Engine
    const layer4 = layer4_responseEngine(layer1, layer2, layer3);

    // Prepare result
    const result = {
      action: layer4.action,
      blocked: ['TEMP_MUTE', 'HARD_BLOCK'].includes(layer4.action),
      reason: layer4.action_reason,
      confidence: layer4.confidence,
      dampening_duration: layer4.dampening_duration,
      queue_priority: layer4.queue_priority,
      layer_outputs: {
        layer1,
        layer2,
        layer3,
        layer4: {
          action: layer4.action,
          action_reason: layer4.action_reason,
          combined_score: layer4.combined_score,
          confidence: layer4.confidence,
          dampening_duration: layer4.dampening_duration,
          queue_priority: layer4.queue_priority
        }
      }
    };

    // Include all layer details if requested
    if (returnAllLayers) {
      result.layer_breakdown = {
        layer1,
        layer2,
        layer3,
        layer4
      };
    }

    return result;

  } catch (error) {
    logger.error('Moderation V2 error:', error);

    // Fallback to allow on error
    return {
      action: 'ALLOW',
      blocked: false,
      reason: 'Moderation system error - content allowed',
      confidence: 0,
      dampening_duration: 0,
      queue_priority: 'normal',
      layer_outputs: {
        error: error.message
      }
    };
  }
}

/**
 * Admin override function
 */
export async function adminOverride(userId, action, reason, adminId) {
  return await layer5_humanOverride(userId, action, reason, adminId);
}

/**
 * Get moderation history with layer details
 */
export async function getModerationHistory(userId, limit = 50) {
  try {
    const user = await User.findById(userId).select('moderationHistory');

    if (!user || !user.moderationHistory) {
      return [];
    }

    // Return most recent entries with layer outputs
    return user.moderationHistory
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit)
      .map(entry => ({
        ...entry.toObject(),
        has_layer_outputs: !!entry.layer_outputs,
        is_override: !!entry.override
      }));

  } catch (error) {
    logger.error('Get moderation history error:', error);
    return [];
  }
}

export default {
  moderateContentV2,
  adminOverride,
  getModerationHistory
};
