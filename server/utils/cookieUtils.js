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
 * @returns {Object} Cookie options
 */
export const getRefreshTokenCookieOptions = () => {
  const isProduction = config.nodeEnv === 'production';

  // 🔐 SECURITY: Cookie maxAge MUST match JWT refresh token expiry
  // This prevents cookie from outliving the token
  const maxAge = parseExpiryToMs(config.refreshTokenExpiry);

  // ROOT_DOMAIN should be set to your apex domain, e.g. 'prydesocial.com'
  // This allows the cookie to be shared between prydesocial.com (Vercel) and
  // api.prydesocial.com (Render), making it first-party so Safari ITP won't block it.
  const rootDomain = isProduction ? (process.env.ROOT_DOMAIN || null) : null;

  const options = {
    httpOnly: true,
    secure: isProduction,
    // 'lax' works when frontend and API share the same root domain (same-site)
    // Falls back to 'none' if ROOT_DOMAIN is not configured (cross-site, legacy behavior)
    sameSite: isProduction ? (rootDomain ? 'lax' : 'none') : 'lax',
    maxAge,
    path: '/',
    ...(rootDomain && { domain: `.${rootDomain}` })
  };

  logger.debug('Cookie options generated:', {
    ...options,
    environment: isProduction ? 'production' : 'development',
    refreshTokenExpiry: config.refreshTokenExpiry
  });

  return options;
};

