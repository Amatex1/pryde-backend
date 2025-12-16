import config from '../config/config.js';
import logger from './logger.js';

/**
 * Get cookie options for refresh token
 * Automatically adjusts secure flag based on environment
 * @returns {Object} Cookie options
 */
export const getRefreshTokenCookieOptions = () => {
  const isProduction = config.nodeEnv === 'production';

  const options = {
    httpOnly: true,
    secure: isProduction, // Only use secure in production (HTTPS)
    sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-site in production, 'lax' for local dev
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/'
    // Note: We don't set domain to allow cookies to work across subdomains
  };

  logger.debug('Cookie options generated:', {
    ...options,
    environment: isProduction ? 'production' : 'development'
  });

  return options;
};

