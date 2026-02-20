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
 * @param {Object} req - Optional express request object to determine cookie options based on request
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
  const rootDomain = isProduction ? (process.env.ROOT_DOMAIN || null) : null;

  // API_DOMAIN is the custom domain for the backend (e.g., api.prydeapp.com)
  // This should be set on the backend as API_DOMAIN
  const apiDomain = isProduction ? (process.env.API_DOMAIN || null) : null;

  // Check the request origin/host to determine if this is a same-site request
  let requestHost = null;
  let isSameSite = false;
  
  if (req) {
    requestHost = req.get('host') || req.get('origin') || '';
    // If using custom domain (api.prydeapp.com) and request is from that domain, use sameSite 'lax'
    // Otherwise use 'none' for cross-origin (required for Safari ITP to work with third-party cookies)
    if (apiDomain) {
      const cleanApiDomain = apiDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      isSameSite = requestHost.includes(cleanApiDomain);
    }
  }

  // Determine if we should set a domain
  // Only set domain if:
  // 1. We're using same-site custom domain
  // 2. The rootDomain is properly configured
  const shouldSetDomain = isSameSite && rootDomain;

  const options = {
    httpOnly: true,
    secure: isProduction,
    // Use 'lax' only when using same-site custom domain
    // Otherwise use 'none' for cross-origin (Safari ITP will handle this with secure flag)
    sameSite: isSameSite ? 'lax' : 'none',
    maxAge,
    path: '/',
    // Only set domain if we're using same-site custom domain
    ...(shouldSetDomain && { domain: `.${rootDomain}` })
  };

  logger.debug('Cookie options generated:', {
    ...options,
    isSameSite,
    shouldSetDomain,
    rootDomain,
    apiDomain,
    requestHost,
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
 * @param {Object} req - Optional express request object
 * @returns {Object} Cookie options for clearing
 */
export const getClearCookieOptions = (req = null) => {
  const isProduction = config.nodeEnv === 'production';

  // ROOT_DOMAIN should be set to your apex domain, e.g. 'prydeapp.com'
  // This must match what's used when setting the cookie
  const rootDomain = isProduction ? (process.env.ROOT_DOMAIN || null) : null;

  // API_DOMAIN is the custom domain for the backend (e.g., api.prydeapp.com)
  const apiDomain = isProduction ? (process.env.API_DOMAIN || null) : null;

  // Check the request origin/host to determine if this is a same-site request
  let requestHost = null;
  let isSameSite = false;
  
  if (req) {
    requestHost = req.get('host') || req.get('origin') || '';
    if (apiDomain) {
      const cleanApiDomain = apiDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      isSameSite = requestHost.includes(cleanApiDomain);
    }
  }

  const shouldSetDomain = isSameSite && rootDomain;

  // SameSite must match what was used when setting the cookie
  const sameSite = isSameSite ? 'lax' : 'none';

  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite,
    path: '/',
    ...(shouldSetDomain && { domain: `.${rootDomain}` })
  };

  logger.debug('Clear cookie options generated:', {
    ...options,
    isSameSite,
    shouldSetDomain,
    requestHost,
    environment: isProduction ? 'production' : 'development'
  });

  return options;
};
