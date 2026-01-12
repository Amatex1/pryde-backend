/**
 * RTL (Right-to-Left) Detection Utility
 * 
 * Detects if text is RTL (Arabic, Hebrew, etc.) and provides helpers
 * for proper text direction handling.
 * 
 * Frontend should use dir="auto" on content elements.
 */

/**
 * RTL language codes
 */
const RTL_LANGUAGES = [
  'ar', // Arabic
  'he', // Hebrew
  'fa', // Persian/Farsi
  'ur', // Urdu
  'yi', // Yiddish
  'ji', // Yiddish (alternative)
  'iw', // Hebrew (alternative)
  'ps', // Pashto
  'sd', // Sindhi
  'ug', // Uyghur
  'ku', // Kurdish (Sorani)
];

/**
 * RTL Unicode ranges
 */
const RTL_UNICODE_RANGES = [
  [0x0590, 0x05FF], // Hebrew
  [0x0600, 0x06FF], // Arabic
  [0x0700, 0x074F], // Syriac
  [0x0750, 0x077F], // Arabic Supplement
  [0x0780, 0x07BF], // Thaana
  [0x07C0, 0x07FF], // N'Ko
  [0x0800, 0x083F], // Samaritan
  [0x08A0, 0x08FF], // Arabic Extended-A
  [0xFB1D, 0xFB4F], // Hebrew Presentation Forms
  [0xFB50, 0xFDFF], // Arabic Presentation Forms-A
  [0xFE70, 0xFEFF], // Arabic Presentation Forms-B
];

/**
 * Check if a character is RTL
 * 
 * @param {string} char - Single character
 * @returns {boolean} Is RTL character
 */
export const isRtlChar = (char) => {
  const code = char.charCodeAt(0);
  
  return RTL_UNICODE_RANGES.some(([start, end]) => 
    code >= start && code <= end
  );
};

/**
 * Detect if text is primarily RTL
 * 
 * @param {string} text - Text to analyze
 * @returns {boolean} Is RTL text
 */
export const isRtlText = (text) => {
  if (!text || text.length === 0) return false;
  
  let rtlCount = 0;
  let ltrCount = 0;
  
  // Sample first 100 characters for performance
  const sample = text.substring(0, 100);
  
  for (const char of sample) {
    if (isRtlChar(char)) {
      rtlCount++;
    } else if (/[a-zA-Z]/.test(char)) {
      ltrCount++;
    }
  }
  
  // If more than 30% of characters are RTL, consider it RTL text
  const totalDirectional = rtlCount + ltrCount;
  if (totalDirectional === 0) return false;
  
  return rtlCount / totalDirectional > 0.3;
};

/**
 * Detect text direction
 * 
 * @param {string} text - Text to analyze
 * @returns {'rtl'|'ltr'} Text direction
 */
export const detectTextDirection = (text) => {
  return isRtlText(text) ? 'rtl' : 'ltr';
};

/**
 * Check if language code is RTL
 * 
 * @param {string} langCode - Language code (e.g., 'ar', 'en')
 * @returns {boolean} Is RTL language
 */
export const isRtlLanguage = (langCode) => {
  return RTL_LANGUAGES.includes(langCode.toLowerCase());
};

/**
 * Add text direction metadata to content
 * 
 * @param {Object} content - Content object
 * @returns {Object} Content with direction metadata
 */
export const addDirectionMetadata = (content) => {
  if (!content || typeof content !== 'object') return content;
  
  // Add direction for text fields
  const textFields = ['content', 'text', 'body', 'description', 'bio'];
  
  for (const field of textFields) {
    if (content[field] && typeof content[field] === 'string') {
      const direction = detectTextDirection(content[field]);
      content[`${field}Direction`] = direction;
    }
  }
  
  return content;
};

/**
 * Format text for display with direction hint
 * 
 * @param {string} text - Text to format
 * @returns {Object} Formatted text with direction
 */
export const formatTextWithDirection = (text) => {
  return {
    text,
    direction: detectTextDirection(text),
    isRtl: isRtlText(text)
  };
};

/**
 * Sanitize mixed-direction text
 * Prevents RTL/LTR injection attacks
 * 
 * @param {string} text - Text to sanitize
 * @returns {string} Sanitized text
 */
export const sanitizeMixedDirectionText = (text) => {
  if (!text) return text;
  
  // Remove Unicode direction override characters
  // These can be used for spoofing attacks
  const directionOverrides = [
    '\u202A', // LEFT-TO-RIGHT EMBEDDING
    '\u202B', // RIGHT-TO-LEFT EMBEDDING
    '\u202C', // POP DIRECTIONAL FORMATTING
    '\u202D', // LEFT-TO-RIGHT OVERRIDE
    '\u202E', // RIGHT-TO-LEFT OVERRIDE
    '\u2066', // LEFT-TO-RIGHT ISOLATE
    '\u2067', // RIGHT-TO-LEFT ISOLATE
    '\u2068', // FIRST STRONG ISOLATE
    '\u2069', // POP DIRECTIONAL ISOLATE
  ];
  
  let sanitized = text;
  for (const char of directionOverrides) {
    sanitized = sanitized.replace(new RegExp(char, 'g'), '');
  }
  
  return sanitized;
};

