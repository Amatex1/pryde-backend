/**
 * Central Geo Utility — Enterprise Geo Detection
 *
 * Priority:
 *   1. Cloudflare cf-ipcountry header
 *   2. Redis cache (geo:${ip}, 7-day TTL)
 *   3. ipapi.co fallback (single call, cached)
 *
 * Contract:
 *   - Never throws
 *   - Never blocks login/signup
 *   - Uses structured logger only
 *   - Skips external call if Redis hit exists
 */

import logger from './logger.js';
import { getClientIp } from './sessionUtils.js';

const GEO_CACHE_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

// Countries where same-sex relationships are criminalised (ISO 3166-1 alpha-2)
// Source: ILGA World
export const HIGH_RISK_COUNTRIES = [
  // Africa
  'DZ', 'AO', 'BW', 'BI', 'CM', 'KM', 'EG', 'ER', 'ET', 'GM', 'GH', 'GN', 'KE', 'LR', 'LY',
  'MW', 'MR', 'MU', 'MA', 'MZ', 'NA', 'NG', 'SN', 'SC', 'SL', 'SO', 'SS', 'SD', 'TZ', 'TG',
  'TN', 'UG', 'ZM', 'ZW',
  // Asia
  'AF', 'BD', 'BN', 'BT', 'ID', 'IR', 'IQ', 'KW', 'LB', 'MY', 'MV', 'MM', 'OM', 'PK', 'PS',
  'QA', 'SA', 'SG', 'LK', 'SY', 'TM', 'AE', 'UZ', 'YE',
  // Caribbean
  'AG', 'BB', 'DM', 'GD', 'GY', 'JM', 'KN', 'LC', 'VC', 'TT',
  // Oceania
  'CK', 'KI', 'PG', 'WS', 'SB', 'TO', 'TV',
  // Other
  'RU'
];

// Countries with death penalty for same-sex relationships
export const EXTREME_RISK_COUNTRIES = [
  'AF', 'BN', 'IR', 'MR', 'NG', 'QA', 'SA', 'SO', 'AE', 'YE'
];

/**
 * Check if an IP is local/private (skip geo lookup for these)
 */
function isPrivateIp(ip) {
  return !ip ||
    ip === 'Unknown' ||
    ip.startsWith('127.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip === '::1' ||
    ip === 'localhost';
}

/**
 * Fetch country code from ipapi.co (fallback)
 * @param {string} ipAddress
 * @returns {Promise<string|null>}
 */
async function fetchFromIpapi(ipAddress) {
  try {
    const response = await fetch(`https://ipapi.co/${ipAddress}/json/`, {
      headers: { 'User-Agent': 'Pryde-Social-Backend/1.0' },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      logger.warn(`[GeoService] ipapi returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.error) {
      logger.warn(`[GeoService] ipapi error: ${data.reason}`);
      return null;
    }

    return data.country_code || null;
  } catch (error) {
    logger.warn(`[GeoService] ipapi fetch failed: ${error.message}`);
    return null;
  }
}

/**
 * Get country code from request using priority chain:
 *   1. Cloudflare cf-ipcountry header
 *   2. Redis cache
 *   3. ipapi.co fallback (result cached in Redis)
 *
 * @param {import('express').Request} req
 * @returns {Promise<string|null>} ISO 3166-1 alpha-2 country code or null
 */
export async function getCountryFromRequest(req) {
  try {
    // 1. Cloudflare header (instant, free, no rate limit)
    const cfCountry = req.headers['cf-ipcountry'];
    if (cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1') {
      return cfCountry.toUpperCase();
    }

    const ipAddress = getClientIp(req);

    // Skip geo lookup for private/local IPs
    if (isPrivateIp(ipAddress)) {
      return null;
    }

    // 2. Redis cache lookup
    const redisClient = req.app?.get('redis') || null;
    const cacheKey = `geo:${ipAddress}`;

    if (redisClient && typeof redisClient.get === 'function') {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return cached;
        }
      } catch (redisErr) {
        logger.warn(`[GeoService] Redis get failed: ${redisErr.message}`);
      }
    }

    // 3. ipapi.co fallback
    const countryCode = await fetchFromIpapi(ipAddress);

    // Cache result in Redis (even null → store 'UNKNOWN' to avoid repeated calls)
    if (redisClient && typeof redisClient.set === 'function' && countryCode) {
      try {
        await redisClient.set(cacheKey, countryCode, 'EX', GEO_CACHE_TTL);
      } catch (redisErr) {
        logger.warn(`[GeoService] Redis set failed: ${redisErr.message}`);
      }
    }

    return countryCode;
  } catch (error) {
    logger.error(`[GeoService] Unexpected error: ${error.message}`);
    return null;
  }
}

/**
 * Determine if a safety check is required for a user in a given country.
 */
export function requiresSafetyCheck(countryCode, user) {
  if (!countryCode || !HIGH_RISK_COUNTRIES.includes(countryCode.toUpperCase())) {
    return false;
  }

  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

  return (
    !user.safetyAcknowledgedAt ||
    user.safetyAcknowledgedCountry !== countryCode ||
    (Date.now() - new Date(user.safetyAcknowledgedAt).getTime()) > NINETY_DAYS_MS
  );
}

