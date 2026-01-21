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

  const options = {
    httpOnly: true,
    secure: isProduction, // Only use secure in production (HTTPS)
    sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-site in production, 'lax' for local dev
    maxAge,
    path: '/'
    // Note: We don't set domain to allow cookies to work across subdomains
  };

  logger.debug('Cookie options generated:', {
    ...options,
    environment: isProduction ? 'production' : 'development',
    refreshTokenExpiry: config.refreshTokenExpiry
  });

  return options;
};

