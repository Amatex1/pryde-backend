import config from '../config/config.js';
import logger from './logger.js';

/**
 * Parse token expiry string (e.g., '30d', '24h', '60m') to milliseconds
 * @param {string} expiry - Token expiry string from config
 * @returns {number} Milliseconds
 */
const parseExpiryToMs = (expiry) => {
  const match = expiry.match(/^(\d+)([dhm])$/);
  if (!match) {
    return 30 * 24 * 60 * 60 * 1000; // Default 30 days
  }

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'm':
      return value * 60 * 1000;
    default:
      return 30 * 24 * 60 * 60 * 1000;
  }
};

/**
 * Get cookie options for refresh token
 * Automatically adjusts secure flag based on environment
 * Cookie maxAge is aligned with JWT refresh token expiry
 * @param {Object} req - Optional express request object (kept for compatibility but not used)
 * @returns {Object} Cookie options
 */
export const getRefreshTokenCookieOptions = (req = null) => {
  const isProduction = config.nodeEnv === 'production';

  // 🔐 SECURITY: Cookie maxAge MUST match JWT refresh token expiry
  // This prevents cookie from outliving the token
  const maxAge = parseExpiryToMs(config.refreshTokenExpiry);

  // ROOT_DOMAIN should be set to your apex domain, e.g. 'prydeapp.com'
  // This allows the cookie to be shared between prydeapp.com (Vercel) and
  // api.prydeapp.com (Render), making it first-party so Safari ITP won't block it.
  const rootDomain = isProduction ? (config.rootDomain || null) : null;

  // Always use sameSite: 'none' in production because:
  // - Frontend is on prydeapp.com
  // - Backend is on api.prydeapp.com
  // - This is cross-origin from browser perspective, so we need 'none' for cookies to work
  // In development, use 'lax' for easier testing
  const sameSite = isProduction ? 'none' : 'lax';
  
  const shouldSetDomain = !!rootDomain;

  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite,
    maxAge,
    path: '/',
    // Set domain for cookie sharing across subdomains
    ...(shouldSetDomain && { domain: `.${rootDomain}` })
  };

  logger.debug('Cookie options generated:', {
    ...options,
    shouldSetDomain,
    rootDomain,
    environment: isProduction ? 'production' : 'development',
    refreshTokenExpiry: config.refreshTokenExpiry
  });

  return options;
};

/**
 * Get cookie options for clearing refresh token
 * CRITICAL: Must match the options used when setting the cookie
 * including the domain attribute, otherwise browsers (especially Safari)
 * may not properly clear the cookie
 * @param {Object} req - Optional express request object (kept for compatibility but not used)
 * @returns {Object} Cookie options for clearing
 */
export const getClearCookieOptions = (req = null) => {
  const isProduction = config.nodeEnv === 'production';

  // ROOT_DOMAIN should be set to your apex domain, e.g. 'prydeapp.com'
  // This must match what's used when setting the cookie
  const rootDomain = isProduction ? (config.rootDomain || null) : null;

  // SameSite must match what was used when setting the cookie
  const sameSite = isProduction ? 'none' : 'lax';
  
  const shouldSetDomain = !!rootDomain;

  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite,
    path: '/',
    ...(shouldSetDomain && { domain: `.${rootDomain}` })
  };

  logger.debug('Clear cookie options generated:', {
    ...options,
    shouldSetDomain,
    environment: isProduction ? 'production' : 'development'
  });

  return options;
};
