/**
 * PRYDE_MODERATION_PLATFORM_V3: Human-First Moderation Language
 * 
 * Maps explanation codes to user-friendly, non-accusatory language.
 * 
 * RULES:
 * - Never use words like "spam", "toxic", "violation" for expressive content
 * - No accusatory language
 * - Always reversible framing
 * - Emphasize that actions are temporary and reviewable
 */

// ═══════════════════════════════════════════════════════════════════════════
// EXPLANATION CODE MAPPINGS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Admin-facing explanation codes with full context
 * Used in admin dashboard for detailed understanding
 */
export const ADMIN_EXPLANATIONS = {
  // ALLOW actions
  ALLOWED: {
    short: 'Content allowed',
    long: 'Content passed all moderation layers without requiring action.',
    category: 'allow'
  },
  EXPRESSIVE_ALLOWED: {
    short: 'Expressive formatting detected',
    long: 'Expressive formatting was detected but no action was taken. Expression is welcome.',
    category: 'allow'
  },
  FLAGGED_FOR_MONITORING: {
    short: 'Flagged for monitoring',
    long: 'Content was allowed but internally flagged for pattern monitoring.',
    category: 'note'
  },
  
  // DAMPEN actions
  VISIBILITY_DAMPENED: {
    short: 'Visibility briefly reduced',
    long: 'Visibility was briefly reduced to prevent feed flooding. This is non-punitive and temporary.',
    category: 'dampen'
  },
  FREQUENCY_DAMPENED: {
    short: 'Posting frequency noticed',
    long: 'High posting frequency detected. Visibility briefly reduced to balance feed distribution.',
    category: 'dampen'
  },
  
  // REVIEW actions
  QUEUED_FOR_REVIEW: {
    short: 'Queued for human review',
    long: 'This content has been queued for a quick human review. No penalties applied yet.',
    category: 'review'
  },
  NEEDS_CONTEXT_CHECK: {
    short: 'Context check needed',
    long: 'Automated system needs human context. Content queued for review.',
    category: 'review'
  },
  
  // MUTE actions
  TEMPORARILY_MUTED: {
    short: 'Temporary pause',
    long: 'A brief pause was applied. This will expire automatically and can be appealed.',
    category: 'mute'
  },
  COOLDOWN_APPLIED: {
    short: 'Cooldown active',
    long: 'A short cooldown was applied to help de-escalate. This expires soon.',
    category: 'mute'
  },
  
  // BLOCK actions
  CONTENT_BLOCKED: {
    short: 'Content not posted',
    long: 'This content was not posted. You can appeal this decision for human review.',
    category: 'block'
  },
  SAFETY_TRIGGERED: {
    short: 'Safety check triggered',
    long: 'Our safety system was triggered. A human moderator will review this promptly.',
    category: 'block'
  }
};

/**
 * User-facing explanations - simplified, empathetic, non-accusatory
 * Used when showing moderation reasons to users
 */
export const USER_EXPLANATIONS = {
  ALLOWED: null, // No message shown for allowed content
  EXPRESSIVE_ALLOWED: null,
  FLAGGED_FOR_MONITORING: null, // Internal only
  
  VISIBILITY_DAMPENED: {
    title: 'Visibility temporarily adjusted',
    message: 'Your post visibility was briefly adjusted to keep the feed balanced. This happens automatically and will resolve on its own.',
    canAppeal: false
  },
  FREQUENCY_DAMPENED: {
    title: 'Taking a quick breather',
    message: 'We noticed you\'re posting quickly! Your recent post visibility was briefly adjusted to keep the feed balanced for everyone.',
    canAppeal: false
  },
  
  QUEUED_FOR_REVIEW: {
    title: 'Under review',
    message: 'Your content is being reviewed by our team. We\'ll update you soon.',
    canAppeal: false
  },
  NEEDS_CONTEXT_CHECK: {
    title: 'Quick check needed',
    message: 'We\'re doing a quick review to make sure we understand your message correctly.',
    canAppeal: false
  },
  
  TEMPORARILY_MUTED: {
    title: 'Brief pause',
    message: 'We\'ve applied a brief pause to help things cool down. This will expire automatically.',
    canAppeal: true
  },
  COOLDOWN_APPLIED: {
    title: 'Short cooldown',
    message: 'A short cooldown is in effect. Take a moment and you\'ll be back soon.',
    canAppeal: true
  },
  
  CONTENT_BLOCKED: {
    title: 'Content not posted',
    message: 'This content couldn\'t be posted. If you believe this is a mistake, you can request a review.',
    canAppeal: true
  },
  SAFETY_TRIGGERED: {
    title: 'Safety check',
    message: 'Our safety system flagged this content. A team member will review it shortly.',
    canAppeal: true
  }
};

/**
 * Get admin explanation for a code
 */
export function getAdminExplanation(code) {
  return ADMIN_EXPLANATIONS[code] || ADMIN_EXPLANATIONS.ALLOWED;
}

/**
 * Get user-facing explanation for a code
 */
export function getUserExplanation(code) {
  return USER_EXPLANATIONS[code] || null;
}

/**
 * Map legacy action to explanation code
 */
export function actionToExplanationCode(action, context = {}) {
  const baseMap = {
    'ALLOW': 'ALLOWED',
    'ALLOW_WITH_INTERNAL_NOTE': 'FLAGGED_FOR_MONITORING',
    'VISIBILITY_DAMPEN': 'VISIBILITY_DAMPENED',
    'QUEUE_FOR_REVIEW': 'QUEUED_FOR_REVIEW',
    'TEMP_MUTE': 'TEMPORARILY_MUTED',
    'HARD_BLOCK': 'CONTENT_BLOCKED'
  };
  
  return baseMap[action] || 'ALLOWED';
}

export default {
  ADMIN_EXPLANATIONS,
  USER_EXPLANATIONS,
  getAdminExplanation,
  getUserExplanation,
  actionToExplanationCode
};

