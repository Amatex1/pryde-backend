import express from 'express';
const router = express.Router();
import User from '../models/User.js';
import Session from '../models/Session.js'; // Phase 3B-A: First-class sessions
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
    const user = await User.findById(decoded.userId)
      .select('+activeSessions.refreshToken +activeSessions.refreshTokenHash');

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

    // 🔐 PHASE 3B-A: SESSION-BOUND REFRESH TOKEN VERIFICATION
    // Read from Session collection first (authoritative), fallback to User.activeSessions
    let session = await Session.findOne({
      sessionId: decoded.sessionId,
      userId: user._id,
      isActive: true
    }).select('+refreshTokenHash +previousRefreshTokenHash');

    let usingSessionCollection = !!session;

    // Fallback: Try User.activeSessions if Session not found (transitional)
    if (!session) {
      logger.debug('[Phase 3B-A] Session not in collection, falling back to User.activeSessions');
      const userSession = user.activeSessions?.find(
        s => s.sessionId === decoded.sessionId
      );
      if (userSession) {
        // Create wrapper object for compatibility
        session = {
          ...userSession,
          _isUserSession: true // Flag to identify fallback source
        };
      }
    }

    if (!session) {
      logger.warn('❌ Refresh failed: session not found', {
        userId: decoded.userId,
        sessionId: decoded.sessionId
      });
      return res.status(401).json({ message: 'Session not found' });
    }

    // Verify refresh token
    let tokenValid = false;
    if (usingSessionCollection) {
      // Use Session model's verification method
      tokenValid = session.verifyRefreshToken(refreshToken);
    } else {
      // Fallback to User model's verification method
      tokenValid = user.verifyRefreshToken(session, refreshToken);
    }

    if (!tokenValid) {
      logger.warn('❌ Refresh failed: token mismatch', {
        userId: decoded.userId,
        sessionId: decoded.sessionId,
        source: usingSessionCollection ? 'Session' : 'User.activeSessions'
      });
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    // 🔁 MIGRATE LEGACY PLAINTEXT TOKEN → HASHED (ONE-TIME, SAFE)
    // Only needed for User.activeSessions fallback
    if (!usingSessionCollection && session._isUserSession) {
      const userSessionObj = user.activeSessions?.find(
        s => s.sessionId === decoded.sessionId
      );
      if (userSessionObj) {
        user.migrateRefreshToken(userSessionObj, refreshToken);
        await user.save();
      }
    }

    // Update lastActiveAt on Session collection
    if (usingSessionCollection) {
      session.lastActiveAt = new Date();
      await session.save();
    }

    // Get session index for later use (we need this for User.activeSessions updates)
    const sessionIndex = user.activeSessions.findIndex(
      s => s.sessionId === decoded.sessionId
    );

    // Check if refresh token has expired
    if (session.refreshTokenExpiry && new Date() > session.refreshTokenExpiry) {
      // Remove expired session from both stores
      if (usingSessionCollection) {
        await Session.updateOne(
          { sessionId: decoded.sessionId, userId: user._id },
          { $set: { isActive: false, revokedAt: new Date() } }
        );
      }
      if (sessionIndex >= 0) {
        user.activeSessions.splice(sessionIndex, 1);
        await user.save();
      }
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

    if (shouldRotateToken) {
      // Full rotation - new access token AND new refresh token
      const tokens = generateTokenPair(user._id, decoded.sessionId);
      accessToken = tokens.accessToken;
      newRefreshToken = tokens.refreshToken;

      // Phase 3B-A: Update Session collection with rotated token
      if (usingSessionCollection) {
        session.rotateToken(newRefreshToken);
        session.refreshTokenExpiry = getRefreshTokenExpiry();
        await session.save();
      }

      // 🔥 GRACE PERIOD: Save the old token so it still works for 30 minutes
      // This handles cases where the frontend fails to save the new token
      if (sessionIndex >= 0) {
        user.activeSessions[sessionIndex].previousRefreshToken = user.activeSessions[sessionIndex].refreshToken;
        user.activeSessions[sessionIndex].previousTokenExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 min grace

        // Update session with new refresh token
        user.activeSessions[sessionIndex].refreshToken = newRefreshToken;
        user.activeSessions[sessionIndex].refreshTokenExpiry = getRefreshTokenExpiry();
        user.activeSessions[sessionIndex].lastTokenRotation = new Date();
      }

      logger.debug(`🔄 Rotated refresh token for user ${user.username} (${hoursSinceRotation.toFixed(1)}h since last rotation)`);
    } else {
      // Just issue new access token, keep existing refresh token
      accessToken = generateAccessToken(user._id, decoded.sessionId);
      // Return the refresh token from the request (unchanged)
      newRefreshToken = refreshToken;

      logger.debug(`🔑 Issued new access token for user ${user.username} (no rotation, ${hoursSinceRotation.toFixed(1)}h since last)`);
    }

    // Always update lastActive on User.activeSessions
    const deviceInfo = parseUserAgent(req.headers['user-agent']);
    const ipAddress = getClientIp(req);

    if (sessionIndex >= 0) {
      user.activeSessions[sessionIndex].lastActive = new Date();

      // Update device info if changed
      if (deviceInfo.browser) {
        user.activeSessions[sessionIndex].browser = deviceInfo.browser;
      }
      if (deviceInfo.os) {
        user.activeSessions[sessionIndex].os = deviceInfo.os;
      }
      if (ipAddress) {
        user.activeSessions[sessionIndex].ipAddress = ipAddress;
      }
    }

    await user.save();

    logger.debug(`Token refreshed for user: ${user.username} (${user.email})`);
    logger.info(`✅ Token refresh successful for ${user.username} - Rotated: ${shouldRotateToken}, Using previous: ${usingPreviousToken}`);

    // Set refresh token in httpOnly cookie
    const cookieOptions = getRefreshTokenCookieOptions();

    logger.debug('Setting refresh token cookie (refresh) with options:', cookieOptions);
    logger.debug(`Refresh token cookie maxAge: ${cookieOptions.maxAge}ms (${cookieOptions.maxAge / 1000 / 60 / 60 / 24} days)`);
    res.cookie('refreshToken', newRefreshToken, cookieOptions);

    // CRITICAL: Also set access token in cookie for cross-origin auth
    // Cookie maxAge should match refresh token (30 days) to persist across browser restarts
    // The JWT itself expires in 15 minutes, but the cookie stays to allow refresh
    const accessTokenCookieOptions = {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days (same as refresh token cookie)
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

