import config from '../config/config.js';

/**
 * Get cookie options for refresh token
 * Automatically adjusts secure flag based on environment
 * @returns {Object} Cookie options
 */
export const getRefreshTokenCookieOptions = () => {
  const isProduction = config.nodeEnv === 'production';
  
  return {
    httpOnly: true,
    secure: isProduction, // Only use secure in production (HTTPS)
    sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-site in production, 'lax' for local dev
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/'
  };
};

