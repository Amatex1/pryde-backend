/**
 * Trust Level Helper
 * 
 * Provides user-friendly trust level labels based on trust scores.
 * Used throughout the frontend and moderation system.
 */

/**
 * Get trust level from score
 * @param {number} score - Trust score (0-100)
 * @returns {string} Trust level
 */
export const getTrustLevel = (score) => {
  if (score >= 90) return 'trusted';
  if (score >= 70) return 'regular';
  if (score >= 50) return 'new';
  if (score >= 30) return 'caution';
  return 'restricted';
};

/**
 * Trust level labels for UI display
 */
export const TRUST_LEVEL_LABELS = {
  trusted: 'Trusted Member',
  regular: 'Regular Member',
  new: 'New Member',
  caution: 'Caution',
  restricted: 'Restricted'
};

/**
 * Trust level colors for UI
 */
export const TRUST_LEVEL_COLORS = {
  trusted: '#8B5CF6',   // Purple
  regular: '#3B82F6',   // Blue
  new: '#6B7280',       // Gray
  caution: '#F59E0B',   // Orange
  restricted: '#EF4444' // Red
};

/**
 * Trust level icons (Lucide icon names)
 */
export const TRUST_LEVEL_ICONS = {
  trusted: 'ShieldCheck',
  regular: 'Shield',
  new: 'Sparkles',
  caution: 'AlertTriangle',
  restricted: 'Ban'
};

/**
 * Trust level descriptions
 */
export const TRUST_LEVEL_DESCRIPTIONS = {
  trusted: 'You are a trusted member of our community with a proven track record.',
  regular: 'You are an active community member in good standing.',
  new: 'You are a new member. Build trust by engaging positively!',
  caution: 'Some activity has raised flags. Contact support if you believe this is an error.',
  restricted: 'Your account has restrictions due to policy violations.'
};

/**
 * Trust level progress thresholds
 */
export const TRUST_LEVEL_THRESHOLDS = {
  trusted: 90,
  regular: 70,
  new: 50,
  caution: 30,
  restricted: 0
};

/**
 * Get progress percentage to next level
 * @param {number} score - Trust score
 * @returns {object} Progress info
 */
export const getTrustProgress = (score) => {
  const currentLevel = getTrustLevel(score);
  
  const thresholds = [
    { level: 'trusted', threshold: 90 },
    { level: 'regular', threshold: 70 },
    { level: 'new', threshold: 50 },
    { level: 'caution', threshold: 30 },
    { level: 'restricted', threshold: 0 }
  ];
  
  const currentIndex = thresholds.findIndex(t => t.level === currentLevel);
  const nextThreshold = thresholds[currentIndex - 1]?.threshold ?? 100;
  const currentThreshold = thresholds[currentIndex].threshold;
  
  const progress = ((score - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
  
  return {
    currentLevel,
    nextLevel: thresholds[currentIndex - 1]?.level || currentLevel,
    progressToNext: Math.min(100, Math.max(0, progress)),
    pointsToNext: Math.max(0, nextThreshold - score)
  };
};

export default {
  getTrustLevel,
  TRUST_LEVEL_LABELS,
  TRUST_LEVEL_COLORS,
  TRUST_LEVEL_ICONS,
  TRUST_LEVEL_DESCRIPTIONS,
  TRUST_LEVEL_THRESHOLDS,
  getTrustProgress
};
