import config from '../config/config.js';
import logger from './logger.js';

const DOMAIN_LABEL_REGEX = /^[a-z0-9-]+$/i;

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
 * Normalize a configured cookie domain.
 * Accepts either a bare domain (prydeapp.com) or a full URL
 * (https://prydeapp.com) and returns a safe hostname for cookie usage.
 * Returns null if the value is invalid or unsafe.
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
export const normalizeCookieDomain = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  let candidate = value.trim();
  if (!candidate) {
    return null;
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    try {
      candidate = new URL(candidate).hostname;
    } catch {
      return null;
    }
  }

  candidate = candidate
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .replace(/^[.]+/, '')
    .replace(/[.]+$/, '')
    .trim()
    .toLowerCase();

  if (!candidate || candidate === 'localhost') {
    return null;
  }

  // Avoid setting a Domain attribute for IP addresses or malformed hostnames.
  if (/^[0-9.]+$/.test(candidate) || candidate.includes(':')) {
    return null;
  }

  const labels = candidate.split('.');
  if (labels.length < 2) {
    return null;
  }

  const isValid = labels.every(label => (
    label &&
    label.length <= 63 &&
    DOMAIN_LABEL_REGEX.test(label) &&
    !label.startsWith('-') &&
    !label.endsWith('-')
  ));

  return isValid ? candidate : null;
};

const getCookieDomainAttribute = (isProduction) => {
  if (!isProduction || !config.rootDomain) {
    return null;
  }

  const normalizedRootDomain = normalizeCookieDomain(config.rootDomain);
  if (!normalizedRootDomain) {
    logger.warn('Invalid ROOT_DOMAIN configuration for refresh-token cookies; omitting domain attribute.', {
      configuredRootDomain: config.rootDomain
    });
    return null;
  }

  return `.${normalizedRootDomain}`;
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
  const cookieDomain = getCookieDomainAttribute(isProduction);

  // Always use sameSite: 'none' in production because:
  // - Frontend is on prydeapp.com
  // - Backend is on api.prydeapp.com
  // - This is cross-origin from browser perspective, so we need 'none' for cookies to work
  // In development, use 'lax' for easier testing
  const sameSite = isProduction ? 'none' : 'lax';
  
  const shouldSetDomain = !!cookieDomain;

  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite,
    maxAge,
    path: '/',
    // Set domain for cookie sharing across subdomains
    ...(shouldSetDomain && { domain: cookieDomain })
  };

  logger.debug('Cookie options generated:', {
    ...options,
    shouldSetDomain,
    configuredRootDomain: config.rootDomain || null,
    cookieDomain,
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
  const cookieDomain = getCookieDomainAttribute(isProduction);

  // SameSite must match what was used when setting the cookie
  const sameSite = isProduction ? 'none' : 'lax';
  
  const shouldSetDomain = !!cookieDomain;

  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite,
    path: '/',
    ...(shouldSetDomain && { domain: cookieDomain })
  };

  logger.debug('Clear cookie options generated:', {
    ...options,
    shouldSetDomain,
    configuredRootDomain: config.rootDomain || null,
    cookieDomain,
    environment: isProduction ? 'production' : 'development'
  });

  return options;
};
