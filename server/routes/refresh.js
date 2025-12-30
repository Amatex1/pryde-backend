import express from 'express';
const router = express.Router();
import User from '../models/User.js';
import { verifyRefreshToken, generateTokenPair, getRefreshTokenExpiry, generateAccessToken } from '../utils/tokenUtils.js';
import { getClientIp, parseUserAgent } from '../utils/sessionUtils.js';
import { getRefreshTokenCookieOptions } from '../utils/cookieUtils.js';
import logger from '../utils/logger.js';

// @route   POST /api/refresh
// @desc    Refresh access token using refresh token
// @access  Public (but requires valid refresh token)
router.post('/', async (req, res) => {
  try {
    // Debug: Log all cookies received
    logger.debug('Refresh endpoint - Cookies received:', req.cookies);
    logger.debug('Refresh endpoint - All cookies string:', req.headers.cookie);
    logger.debug('Refresh endpoint - Origin:', req.headers.origin);
    logger.debug('Refresh endpoint - Referer:', req.headers.referer);

    // Try to get refresh token from httpOnly cookie first, then fall back to body
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      logger.error('❌ Refresh token not found!');
      logger.error('📍 Cookies object:', req.cookies);
      logger.error('📍 Cookie header:', req.headers.cookie);
      logger.error('📍 Request body:', req.body);
      return res.status(401).json({ message: 'Refresh token required' });
    }

    logger.debug('Refresh token found, attempting to verify...');

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // CRITICAL: Check if user is deleted (hard block)
    if (user.isDeleted) {
      return res.status(401).json({
        message: 'Account deleted',
        code: 'ACCOUNT_DELETED'
      });
    }

    // CRITICAL: Check if user is deactivated (soft block)
    if (!user.isActive) {
      return res.status(403).json({
        message: 'Account deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    // Check if user is banned or suspended
    if (user.isBanned) {
      return res.status(403).json({ message: 'Your account has been banned' });
    }

    if (user.isSuspended && user.suspendedUntil > new Date()) {
      return res.status(403).json({ message: 'Your account is suspended' });
    }

    // Find the session with this refresh token (check current token OR previous token for grace period)
    let sessionIndex = user.activeSessions.findIndex(
      s => s.sessionId === decoded.sessionId && s.refreshToken === refreshToken
    );

    // 🔥 GRACE PERIOD: If current token doesn't match, check if it matches the previous token
    // This handles cases where the frontend didn't save the new token after rotation
    let usingPreviousToken = false;
    if (sessionIndex === -1) {
      sessionIndex = user.activeSessions.findIndex(
        s => s.sessionId === decoded.sessionId &&
             s.previousRefreshToken === refreshToken &&
             s.previousTokenExpiry && new Date() < s.previousTokenExpiry
      );
      if (sessionIndex !== -1) {
        usingPreviousToken = true;
        logger.info(`🔄 Using previous refresh token for user (within grace period)`);
      }
    }

    if (sessionIndex === -1) {
      // Enhanced debugging for session mismatch
      const sessionById = user.activeSessions.find(s => s.sessionId === decoded.sessionId);
      if (sessionById) {
        logger.warn(`❌ Refresh token mismatch for user ${user.username} - session exists but token differs`);
        logger.debug(`   Current token (first 20): ${sessionById.refreshToken?.substring(0, 20)}...`);
        logger.debug(`   Previous token (first 20): ${sessionById.previousRefreshToken?.substring(0, 20) || 'none'}...`);
        logger.debug(`   Received token (first 20): ${refreshToken?.substring(0, 20)}...`);
      } else {
        logger.warn(`❌ Session ${decoded.sessionId} not found for user ${user.username}`);
        logger.debug(`   Active sessions: ${user.activeSessions.length}`);
      }
      return res.status(401).json({ message: 'Invalid session or refresh token has been revoked' });
    }

    const session = user.activeSessions[sessionIndex];

    // Check if refresh token has expired
    if (session.refreshTokenExpiry && new Date() > session.refreshTokenExpiry) {
      // Remove expired session
      user.activeSessions.splice(sessionIndex, 1);
      await user.save();
      return res.status(401).json({ message: 'Refresh token has expired. Please log in again.' });
    }

    // 🔥 STABILITY FIX: Only rotate refresh token every 4 hours
    // This prevents issues where the frontend doesn't save the new token
    // (e.g., network issues, race conditions, page refresh during save)
    const lastRotation = session.lastTokenRotation || session.createdAt || new Date(0);
    const hoursSinceRotation = (Date.now() - new Date(lastRotation).getTime()) / (1000 * 60 * 60);
    const shouldRotateToken = hoursSinceRotation >= 4;

    // Generate new access token (always) and optionally rotate refresh token
    let newRefreshToken;
    let accessToken;

    if (shouldRotateToken && !usingPreviousToken) {
      // Full rotation - new access token AND new refresh token
      const tokens = generateTokenPair(user._id, decoded.sessionId);
      accessToken = tokens.accessToken;
      newRefreshToken = tokens.refreshToken;

      // 🔥 GRACE PERIOD: Save the old token so it still works for 30 minutes
      // This handles cases where the frontend fails to save the new token
      user.activeSessions[sessionIndex].previousRefreshToken = session.refreshToken;
      user.activeSessions[sessionIndex].previousTokenExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 min grace

      // Update session with new refresh token
      user.activeSessions[sessionIndex].refreshToken = newRefreshToken;
      user.activeSessions[sessionIndex].refreshTokenExpiry = getRefreshTokenExpiry();
      user.activeSessions[sessionIndex].lastTokenRotation = new Date();

      logger.debug(`🔄 Rotated refresh token for user ${user.username} (${hoursSinceRotation.toFixed(1)}h since last rotation)`);
    } else {
      // Just issue new access token, keep existing refresh token
      accessToken = generateAccessToken(user._id, decoded.sessionId);
      newRefreshToken = session.refreshToken; // Return the CURRENT token from DB (not the one sent)

      logger.debug(`🔑 Issued new access token for user ${user.username} (no rotation, ${hoursSinceRotation.toFixed(1)}h since last)`);
    }

    // Always update lastActive
    user.activeSessions[sessionIndex].lastActive = new Date();

    // Update device info if changed
    const deviceInfo = parseUserAgent(req.headers['user-agent']);
    const ipAddress = getClientIp(req);
    
    if (deviceInfo.browser) {
      user.activeSessions[sessionIndex].browser = deviceInfo.browser;
    }
    if (deviceInfo.os) {
      user.activeSessions[sessionIndex].os = deviceInfo.os;
    }
    if (ipAddress) {
      user.activeSessions[sessionIndex].ipAddress = ipAddress;
    }

    await user.save();

    logger.debug(`Token refreshed for user: ${user.username} (${user.email})`);

    // Set refresh token in httpOnly cookie
    const cookieOptions = getRefreshTokenCookieOptions();

    logger.debug('Setting refresh token cookie (refresh) with options:', cookieOptions);
    res.cookie('refreshToken', newRefreshToken, cookieOptions);

    // CRITICAL: Also set access token in cookie for cross-origin auth
    const accessTokenCookieOptions = {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000 // 15 minutes (access token expiry)
    };
    logger.debug('Setting access token cookie (refresh) with options:', accessTokenCookieOptions);
    res.cookie('token', accessToken, accessTokenCookieOptions);

    res.json({
      success: true,
      accessToken,
      // Send new refresh token for cross-domain setups
      refreshToken: newRefreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        displayName: user.displayName,
        nickname: user.nickname,
        pronouns: user.pronouns,
        customPronouns: user.customPronouns,
        gender: user.gender,
        customGender: user.customGender,
        relationshipStatus: user.relationshipStatus,
        profilePhoto: user.profilePhoto,
        coverPhoto: user.coverPhoto,
        bio: user.bio,
        location: user.location,
        website: user.website,
        socialLinks: user.socialLinks,
        role: user.role,
        permissions: user.permissions
      }
    });
  } catch (error) {
    logger.error('Token refresh error:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Server error during token refresh',
      error: error.message 
    });
  }
});

export default router;

