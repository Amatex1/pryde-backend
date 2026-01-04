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
    // Return defaults if database fails
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
        violationThreshold: 3,
        minutesPerViolation: 30,
        maxMuteDuration: 1440,
        spamMuteDuration: 60
      },
      toxicity: {
        warningThreshold: 50,
        pointsPerBlockedWord: 10,
        pointsForSpam: 20
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

// Spam patterns with descriptions (these are not configurable via admin UI for security)
const spamPatterns = [
  { pattern: /\b(viagra|cialis|pharmacy)\b/i, description: 'Pharmacy spam' },
  { pattern: /\b(casino|poker|gambling)\b/i, description: 'Gambling spam' },
  { pattern: /\b(lottery|winner|prize)\b/i, description: 'Lottery/prize scam' },
  { pattern: /\b(click\s+here|buy\s+now)\b/i, description: 'Marketing spam' },
  { pattern: /(.)\1{10,}/, description: 'Repeated characters' },
  { pattern: /[A-Z]{20,}/, description: 'Excessive caps block' },
];

/**
 * Check if content contains blocked words (async - uses database settings)
 * @param {string} content - The content to check
 * @param {array} blockedWordsList - Optional pre-fetched list of blocked words
 * @returns {Promise<object>} - { isBlocked: boolean, blockedWords: array }
 */
export const checkBlockedWords = async (content, blockedWordsList = null) => {
  if (!content || typeof content !== 'string') {
    return { isBlocked: false, blockedWords: [] };
  }

  // Get blocked words from database or use provided list
  let wordsList = blockedWordsList;
  if (!wordsList) {
    const settings = await getSettings();
    wordsList = settings.getAllBlockedWords ? settings.getAllBlockedWords() : [];
  }

  const lowerContent = content.toLowerCase();
  const foundWords = [];

  for (const word of wordsList) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(lowerContent)) {
      foundWords.push(word);
    }
  }

  return {
    isBlocked: foundWords.length > 0,
    blockedWords: foundWords
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

  // Check for excessive caps (more than 70% of text)
  const capsCount = (content.match(/[A-Z]/g) || []).length;
  const letterCount = (content.match(/[A-Za-z]/g) || []).length;
  if (letterCount > 10 && capsCount / letterCount > 0.7) {
    const capsPercent = Math.round((capsCount / letterCount) * 100);
    const capsPreview = content.substring(0, 50);
    details.push(`${capsPercent}% capitalization`);
    return {
      isSpam: true,
      reason: `Excessive capitalization (${capsPercent}% caps)`,
      matchedText: capsPreview,
      details: details
    };
  }

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
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    sanitized = sanitized.replace(regex, (match) => {
      return '*'.repeat(match.length);
    });
  }

  return sanitized;
};

/**
 * Calculate content toxicity score (0-100) (async - uses database settings)
 * @param {string} content - The content to analyze
 * @returns {Promise<number>} - Toxicity score (0 = clean, 100 = very toxic)
 */
export const calculateToxicityScore = async (content) => {
  if (!content || typeof content !== 'string') {
    return 0;
  }

  const settings = await getSettings();
  const toxicityConfig = settings.toxicity || { pointsPerBlockedWord: 10, pointsForSpam: 20 };

  let score = 0;

  // Check blocked words (configurable points each)
  const { blockedWords: foundWords } = await checkBlockedWords(content);
  score += foundWords.length * toxicityConfig.pointsPerBlockedWord;

  // Check spam (configurable points)
  const { isSpam } = checkSpam(content);
  if (isSpam) {
    score += toxicityConfig.pointsForSpam;
  }

  // Cap at 100
  return Math.min(score, 100);
};

