import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config/config.js';

/**
 * Generate access token (short-lived)
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 * @returns {string} Access token
 */
export const generateAccessToken = (userId, sessionId) => {
  return jwt.sign(
    { userId, sessionId, type: 'access' },
    config.jwtSecret,
    { expiresIn: config.accessTokenExpiry }
  );
};

/**
 * Generate refresh token (long-lived)
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 * @returns {string} Refresh token
 */
export const generateRefreshToken = (userId, sessionId) => {
  return jwt.sign(
    { userId, sessionId, type: 'refresh' },
    config.jwtRefreshSecret,
    { expiresIn: config.refreshTokenExpiry }
  );
};

/**
 * Generate both access and refresh tokens
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID (optional, will generate if not provided)
 * @returns {Object} { accessToken, refreshToken, sessionId }
 */
export const generateTokenPair = (userId, sessionId = null) => {
  const sid = sessionId || crypto.randomBytes(32).toString('hex');
  
  return {
    accessToken: generateAccessToken(userId, sid),
    refreshToken: generateRefreshToken(userId, sid),
    sessionId: sid
  };
};

/**
 * Verify access token
 * @param {string} token - Access token
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
export const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    throw error;
  }
};

/**
 * Verify refresh token
 * @param {string} token - Refresh token
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
export const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, config.jwtRefreshSecret);
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    throw error;
  }
};

/**
 * Calculate refresh token expiry date
 * @returns {Date} Expiry date
 */
export const getRefreshTokenExpiry = () => {
  const expiry = config.refreshTokenExpiry;
  const match = expiry.match(/^(\d+)([dhm])$/);
  
  if (!match) {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days
  }
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  let milliseconds;
  switch (unit) {
    case 'd':
      milliseconds = value * 24 * 60 * 60 * 1000;
      break;
    case 'h':
      milliseconds = value * 60 * 60 * 1000;
      break;
    case 'm':
      milliseconds = value * 60 * 1000;
      break;
    default:
      milliseconds = 30 * 24 * 60 * 60 * 1000; // Default 30 days
  }
  
  return new Date(Date.now() + milliseconds);
};

/**
 * Generate session ID
 * @returns {string} Session ID
 */
export const generateSessionId = () => {
  return crypto.randomBytes(32).toString('hex');
};

