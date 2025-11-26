// Blocked words list (can be expanded)
const blockedWords = [
  // Profanity
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'damn', 'crap',
  // Slurs and hate speech (partial list for demonstration)
  'nigger', 'nigga', 'faggot', 'retard', 'tranny',
  // Sexual content
  'porn', 'xxx', 'sex', 'nude', 'naked',
  // Spam indicators
  'click here', 'buy now', 'limited time', 'act now', 'free money',
  'make money fast', 'work from home', 'lose weight fast'
];

// Spam patterns
const spamPatterns = [
  /\b(viagra|cialis|pharmacy)\b/i,
  /\b(casino|poker|gambling)\b/i,
  /\b(lottery|winner|prize)\b/i,
  /\b(click\s+here|buy\s+now)\b/i,
  /(http|https):\/\/[^\s]+/gi, // Multiple URLs
  /(.)\1{10,}/, // Repeated characters (10+ times)
  /[A-Z]{20,}/, // Excessive caps
];

/**
 * Check if content contains blocked words
 * @param {string} content - The content to check
 * @returns {object} - { isBlocked: boolean, blockedWords: array }
 */
export const checkBlockedWords = (content) => {
  if (!content || typeof content !== 'string') {
    return { isBlocked: false, blockedWords: [] };
  }

  const lowerContent = content.toLowerCase();
  const foundWords = [];

  for (const word of blockedWords) {
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
 * @returns {object} - { isSpam: boolean, reason: string }
 */
export const checkSpam = (content) => {
  if (!content || typeof content !== 'string') {
    return { isSpam: false, reason: '' };
  }

  // Check for spam patterns
  for (const pattern of spamPatterns) {
    if (pattern.test(content)) {
      return {
        isSpam: true,
        reason: 'Content matches spam pattern'
      };
    }
  }

  // Check for excessive URLs (more than 3)
  const urlMatches = content.match(/(http|https):\/\/[^\s]+/gi);
  if (urlMatches && urlMatches.length > 3) {
    return {
      isSpam: true,
      reason: 'Excessive URLs detected'
    };
  }

  // Check for excessive emojis (more than 20)
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  const emojiMatches = content.match(emojiRegex);
  if (emojiMatches && emojiMatches.length > 20) {
    return {
      isSpam: true,
      reason: 'Excessive emojis detected'
    };
  }

  // Check for excessive caps (more than 70% of text)
  const capsCount = (content.match(/[A-Z]/g) || []).length;
  const letterCount = (content.match(/[A-Za-z]/g) || []).length;
  if (letterCount > 10 && capsCount / letterCount > 0.7) {
    return {
      isSpam: true,
      reason: 'Excessive capitalization detected'
    };
  }

  return { isSpam: false, reason: '' };
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
 * Sanitize content by removing blocked words
 * @param {string} content - The content to sanitize
 * @returns {string} - Sanitized content with blocked words replaced
 */
export const sanitizeContent = (content) => {
  if (!content || typeof content !== 'string') {
    return content;
  }

  let sanitized = content;

  for (const word of blockedWords) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    sanitized = sanitized.replace(regex, (match) => {
      return '*'.repeat(match.length);
    });
  }

  return sanitized;
};

/**
 * Calculate content toxicity score (0-100)
 * @param {string} content - The content to analyze
 * @returns {number} - Toxicity score (0 = clean, 100 = very toxic)
 */
export const calculateToxicityScore = (content) => {
  if (!content || typeof content !== 'string') {
    return 0;
  }

  let score = 0;

  // Check blocked words (10 points each)
  const { blockedWords: foundWords } = checkBlockedWords(content);
  score += foundWords.length * 10;

  // Check spam (20 points)
  const { isSpam } = checkSpam(content);
  if (isSpam) {
    score += 20;
  }

  // Cap at 100
  return Math.min(score, 100);
};

