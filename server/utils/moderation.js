import ModerationSettings from '../models/ModerationSettings.js';

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS CACHE
// ═══════════════════════════════════════════════════════════════════════════
// Cache settings in memory for performance (refreshed every 5 minutes)
let cachedSettings = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get moderation settings (from cache or database)
 */
async function getSettings() {
  const now = Date.now();
  if (cachedSettings && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedSettings;
  }

  try {
    cachedSettings = await ModerationSettings.getSettings();
    cacheTimestamp = now;
    return cachedSettings;
  } catch (error) {
    console.error('Failed to load moderation settings:', error);
    // Return defaults if database fails (Phase 2B: gentler defaults)
    return {
      blockedWords: {
        profanity: ['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'damn', 'crap'],
        slurs: [],
        sexual: ['porn', 'xxx', 'nude', 'naked'],
        spam: ['click here', 'buy now', 'limited time', 'act now', 'free money'],
        custom: []
      },
      autoMute: {
        enabled: true,
        violationThreshold: 5, // Phase 2B: Increased from 3
        minutesPerViolation: 15, // Phase 2B: Reduced from 30
        maxMuteDuration: 360, // Phase 2B: Reduced from 1440 (6h instead of 24h)
        spamMuteDuration: 60,
        slurMuteDuration: 120,
        slurEscalationMultiplier: 2
      },
      violationDecay: {
        enabled: true,
        cleanPeriodDays: 7,
        decayAmount: 1,
        spamCleanPeriodDays: 7,
        slurCleanPeriodDays: 30,
        slurDecayEnabled: false
      },
      toxicity: {
        warningThreshold: 65, // Phase 2B: Increased from 50
        pointsPerProfanity: 0, // Phase 2B: Set to 0 - profanity allowed
        pointsPerBlockedWord: 10,
        pointsForSpam: 20
      },
      enforcement: {
        profanityTriggersViolation: false,
        slursZeroTolerance: true
      },
      warningMessages: {
        tier1: "Hey — this conversation's getting intense. You're allowed to express yourself here, just try to keep it from turning personal.",
        tier2: "Strong opinions are fine — attacks on people aren't. Please adjust how you're engaging.",
        tier3: "This is a final warning. Continued personal attacks will result in a temporary mute.",
        slur: "This content targets identity and isn't allowed on Pryde. The content has been removed and your account is temporarily restricted.",
        spam: "This content has been flagged as spam. Repeated spam will result in account restrictions."
      },
      getAllBlockedWords() {
        const { profanity, slurs, sexual, spam, custom } = this.blockedWords;
        return [...profanity, ...slurs, ...sexual, ...spam, ...custom];
      }
    };
  }
}

/**
 * Force refresh the settings cache
 */
export async function refreshSettingsCache() {
  cachedSettings = await ModerationSettings.getSettings();
  cacheTimestamp = Date.now();
  return cachedSettings;
}

/**
 * Get the current auto-mute settings
 */
export async function getAutoMuteSettings() {
  const settings = await getSettings();
  return settings.autoMute;
}

/**
 * Get violation decay settings
 */
export async function getViolationDecaySettings() {
  const settings = await getSettings();
  return settings.violationDecay || { enabled: true, cleanPeriodDays: 7, decayAmount: 1 };
}

/**
 * Get enforcement behavior settings
 */
export async function getEnforcementSettings() {
  const settings = await getSettings();
  return settings.enforcement || { profanityTriggersViolation: false, slursZeroTolerance: true };
}

/**
 * Get warning messages configuration
 */
export async function getWarningMessages() {
  const settings = await getSettings();
  return settings.warningMessages || {
    tier1: "Hey — this conversation's getting intense. You're allowed to express yourself here, just try to keep it from turning personal.",
    tier2: "Strong opinions are fine — attacks on people aren't. Please adjust how you're engaging.",
    tier3: "This is a final warning. Continued personal attacks will result in a temporary mute.",
    slur: "This content targets identity and isn't allowed on Pryde. The content has been removed and your account is temporarily restricted.",
    spam: "This content has been flagged as spam. Repeated spam will result in account restrictions."
  };
}

/**
 * Determine warning tier based on violation count
 * @param {number} violationCount - Current violation count
 * @param {number} threshold - Mute threshold
 * @returns {number} - Warning tier (1, 2, or 3)
 */
export function getWarningTier(violationCount, threshold = 5) {
  if (violationCount >= threshold - 1) {
    return 3; // Final warning (1 more violation = mute)
  } else if (violationCount >= Math.floor(threshold / 2)) {
    return 2; // Clear boundary
  }
  return 1; // Soft signal
}

/**
 * Apply violation decay to a user if eligible.
 * Called during content moderation checks.
 * Handles separate decay timelines for speech, spam, and slur violations.
 * @param {object} user - User document with moderation field
 * @param {object} decaySettings - Violation decay settings
 * @returns {object} - { decayApplied: boolean, amountDecayed: number, decayDetails: object }
 */
export function applyViolationDecay(user, decaySettings) {
  if (!decaySettings?.enabled || !user?.moderation) {
    return { decayApplied: false, amountDecayed: 0, decayDetails: {} };
  }

  const {
    cleanPeriodDays = 7,
    decayAmount = 1,
    spamCleanPeriodDays = 7,
    slurCleanPeriodDays = 30,
    slurDecayEnabled = false
  } = decaySettings;
  const now = new Date();

  // Check if user has any violations to decay
  const hasViolations = user.moderation.violationCount > 0 ||
                        user.moderation.spamViolationCount > 0 ||
                        (slurDecayEnabled && user.moderation.slurViolationCount > 0);

  if (!hasViolations) {
    return { decayApplied: false, amountDecayed: 0, decayDetails: {} };
  }

  // Check if enough time has passed since last violation
  const lastViolation = user.moderation.lastViolation;
  if (!lastViolation) {
    return { decayApplied: false, amountDecayed: 0, decayDetails: {} };
  }

  const daysSinceViolation = (now - new Date(lastViolation)) / (1000 * 60 * 60 * 24);

  // Check if we already decayed recently (prevent multiple decays in same period)
  const lastDecay = user.moderation.lastDecayApplied;
  const minCleanPeriod = Math.min(cleanPeriodDays, spamCleanPeriodDays);
  if (lastDecay) {
    const daysSinceDecay = (now - new Date(lastDecay)) / (1000 * 60 * 60 * 24);
    if (daysSinceDecay < minCleanPeriod) {
      return { decayApplied: false, amountDecayed: 0, decayDetails: {} };
    }
  }

  // Apply decay for each violation type with their own timelines
  let totalDecayed = 0;
  const decayDetails = { speech: 0, spam: 0, slur: 0 };

  // Decay speech violations (uses cleanPeriodDays)
  if (user.moderation.violationCount > 0 && daysSinceViolation >= cleanPeriodDays) {
    const speechDecay = Math.min(decayAmount, user.moderation.violationCount);
    user.moderation.violationCount -= speechDecay;
    totalDecayed += speechDecay;
    decayDetails.speech = speechDecay;
  }

  // Decay spam violations independently (uses spamCleanPeriodDays)
  if (user.moderation.spamViolationCount > 0 && daysSinceViolation >= spamCleanPeriodDays) {
    const spamDecay = Math.min(decayAmount, user.moderation.spamViolationCount);
    user.moderation.spamViolationCount -= spamDecay;
    totalDecayed += spamDecay;
    decayDetails.spam = spamDecay;
  }

  // Decay slur violations ONLY if enabled (slow decay, or no decay by default)
  if (slurDecayEnabled &&
      user.moderation.slurViolationCount > 0 &&
      daysSinceViolation >= slurCleanPeriodDays) {
    const slurDecay = Math.min(decayAmount, user.moderation.slurViolationCount);
    user.moderation.slurViolationCount -= slurDecay;
    totalDecayed += slurDecay;
    decayDetails.slur = slurDecay;
  }

  if (totalDecayed > 0) {
    user.moderation.lastDecayApplied = now;
  }

  return { decayApplied: totalDecayed > 0, amountDecayed: totalDecayed, decayDetails };
}

// Spam patterns with descriptions (these are not configurable via admin UI for security)
const spamPatterns = [
  { pattern: /\b(viagra|cialis|pharmacy)\b/i, description: 'Pharmacy spam' },
  { pattern: /\b(casino|poker|gambling)\b/i, description: 'Gambling spam' },
  { pattern: /\b(lottery|winner|prize)\b/i, description: 'Lottery/prize scam' },
  { pattern: /\b(click\s+here|buy\s+now)\b/i, description: 'Marketing spam' },
  { pattern: /(.)\1{10,}/, description: 'Repeated characters' },
  // REMOVED: All-caps block - users should be allowed to express themselves how they want
  // { pattern: /[A-Z]{20,}/, description: 'Excessive caps block' },
];

/**
 * Check if content contains blocked words (async - uses database settings)
 * Returns categorized results for enforcement logic.
 * @param {string} content - The content to check
 * @returns {Promise<object>} - { isBlocked, blockedWords, categories }
 */
export const checkBlockedWords = async (content) => {
  if (!content || typeof content !== 'string') {
    return {
      isBlocked: false,
      blockedWords: [],
      categories: { profanity: [], slurs: [], sexual: [], spam: [], custom: [] }
    };
  }

  const settings = await getSettings();
  const blockedWordsConfig = settings.blockedWords || {
    profanity: [], slurs: [], sexual: [], spam: [], custom: []
  };

  const lowerContent = content.toLowerCase();
  const foundWords = [];
  const categories = { profanity: [], slurs: [], sexual: [], spam: [], custom: [] };

  // Check each category separately
  for (const category of ['profanity', 'slurs', 'sexual', 'spam', 'custom']) {
    const wordsList = blockedWordsConfig[category] || [];
    for (const word of wordsList) {
      // Escape regex special characters in the word
      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedWord}\\b`, 'i');
      if (regex.test(lowerContent)) {
        foundWords.push(word);
        categories[category].push(word);
      }
    }
  }

  return {
    isBlocked: foundWords.length > 0,
    blockedWords: foundWords,
    categories
  };
};

/**
 * Check if content is spam
 * @param {string} content - The content to check
 * @returns {object} - { isSpam: boolean, reason: string, matchedText: string, details: array }
 */
export const checkSpam = (content) => {
  if (!content || typeof content !== 'string') {
    return { isSpam: false, reason: '', matchedText: '', details: [] };
  }

  const details = [];

  // Check for spam patterns
  for (const { pattern, description } of spamPatterns) {
    const match = content.match(pattern);
    if (match) {
      const matchedText = match[0].substring(0, 50); // Limit matched text length
      details.push(`${description}: "${matchedText}"`);
      return {
        isSpam: true,
        reason: description,
        matchedText: matchedText,
        details: details
      };
    }
  }

  // Check for excessive URLs (more than 3)
  const urlMatches = content.match(/(http|https):\/\/[^\s]+/gi);
  if (urlMatches && urlMatches.length > 3) {
    const urlPreview = urlMatches.slice(0, 3).map(u => u.substring(0, 30)).join(', ');
    details.push(`Found ${urlMatches.length} URLs: ${urlPreview}...`);
    return {
      isSpam: true,
      reason: `Excessive URLs detected (${urlMatches.length} links)`,
      matchedText: urlPreview,
      details: details
    };
  }

  // Check for excessive emojis (more than 20)
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  const emojiMatches = content.match(emojiRegex);
  if (emojiMatches && emojiMatches.length > 20) {
    const emojiPreview = emojiMatches.slice(0, 10).join('');
    details.push(`Found ${emojiMatches.length} emojis`);
    return {
      isSpam: true,
      reason: `Excessive emojis detected (${emojiMatches.length} emojis)`,
      matchedText: emojiPreview + '...',
      details: details
    };
  }

  // REMOVED: Excessive caps check - users should be allowed to express themselves how they want
  // People should be free to type in all caps if they choose to
  // const capsCount = (content.match(/[A-Z]/g) || []).length;
  // const letterCount = (content.match(/[A-Za-z]/g) || []).length;
  // if (letterCount > 10 && capsCount / letterCount > 0.7) {
  //   const capsPercent = Math.round((capsCount / letterCount) * 100);
  //   const capsPreview = content.substring(0, 50);
  //   details.push(`${capsPercent}% capitalization`);
  //   return {
  //     isSpam: true,
  //     reason: `Excessive capitalization (${capsPercent}% caps)`,
  //     matchedText: capsPreview,
  //     details: details
  //   };
  // }

  return { isSpam: false, reason: '', matchedText: '', details: [] };
};

/**
 * Check if user is posting too frequently (rate limiting)
 * @param {array} recentPosts - Array of recent post timestamps
 * @param {number} timeWindow - Time window in minutes (default: 5)
 * @param {number} maxPosts - Maximum posts allowed in time window (default: 10)
 * @returns {boolean} - True if user is spamming
 */
export const checkPostingFrequency = (recentPosts, timeWindow = 5, maxPosts = 10) => {
  if (!recentPosts || recentPosts.length === 0) {
    return false;
  }

  const now = Date.now();
  const windowMs = timeWindow * 60 * 1000;

  const recentCount = recentPosts.filter(timestamp => {
    return (now - new Date(timestamp).getTime()) < windowMs;
  }).length;

  return recentCount >= maxPosts;
};

/**
 * Sanitize content by removing blocked words (async - uses database settings)
 * @param {string} content - The content to sanitize
 * @param {array} blockedWordsList - Optional pre-fetched list of blocked words
 * @returns {Promise<string>} - Sanitized content with blocked words replaced
 */
export const sanitizeContent = async (content, blockedWordsList = null) => {
  if (!content || typeof content !== 'string') {
    return content;
  }

  // Get blocked words from database or use provided list
  let wordsList = blockedWordsList;
  if (!wordsList) {
    const settings = await getSettings();
    wordsList = settings.getAllBlockedWords ? settings.getAllBlockedWords() : [];
  }

  let sanitized = content;

  for (const word of wordsList) {
    // Escape regex special characters in the word
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
    sanitized = sanitized.replace(regex, (match) => {
      return '*'.repeat(match.length);
    });
  }

  return sanitized;
};

/**
 * Calculate content toxicity score (0-100) (async - uses database settings)
 * Toxicity is used for soft warnings and moderator review prioritisation only.
 * It MUST NOT trigger auto-mute or auto-ban.
 * @param {string} content - The content to analyze
 * @returns {Promise<number>} - Toxicity score (0 = clean, 100 = very toxic)
 */
export const calculateToxicityScore = async (content) => {
  if (!content || typeof content !== 'string') {
    return 0;
  }

  const settings = await getSettings();
  const toxicityConfig = settings.toxicity || {
    pointsPerProfanity: 5,
    pointsPerBlockedWord: 10,
    pointsForSpam: 20
  };

  let score = 0;

  // Check blocked words with category breakdown
  const { categories } = await checkBlockedWords(content);

  // Profanity uses lower points (contributes to toxicity but less severely)
  score += categories.profanity.length * (toxicityConfig.pointsPerProfanity || 5);

  // Other categories use standard blocked word points
  const otherCategoryCount = categories.slurs.length +
                             categories.sexual.length +
                             categories.spam.length +
                             categories.custom.length;
  score += otherCategoryCount * toxicityConfig.pointsPerBlockedWord;

  // Check spam (configurable points)
  const { isSpam } = checkSpam(content);
  if (isSpam) {
    score += toxicityConfig.pointsForSpam;
  }

  // Cap at 100
  return Math.min(score, 100);
};

