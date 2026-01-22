import express from 'express';
const router = express.Router();
import crypto from 'crypto';
import User from '../models/User.js';
import Session from '../models/Session.js'; // Phase 3B-A: First-class sessions
import { verifyRefreshToken, generateTokenPair, getRefreshTokenExpiry } from '../utils/tokenUtils.js';
import { getClientIp, parseUserAgent } from '../utils/sessionUtils.js';
import { getRefreshTokenCookieOptions } from '../utils/cookieUtils.js';
import logger from '../utils/logger.js';
import { incCounter, logRefreshFailure, logRevokedSessionAccess } from '../utils/authMetrics.js'; // Phase 4A

// @route   POST /api/refresh
// @desc    Refresh access token using refresh token
// @access  Public (but requires valid refresh token)
router.post('/', async (req, res) => {
  try {
    // Debug: Log all cookies received
    logger.debug('Refresh endpoint - Cookies received:', req.cookies);
    logger.debug('Refresh endpoint - Origin:', req.headers.origin);

    // 🔐 SECURITY: Refresh token ONLY from httpOnly cookie
    // NO fallback to req.body - cookie is the SOLE source of truth
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      logger.warn('❌ Refresh token not found in cookies');
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
    // Try Session collection first (authoritative), fallback to User.activeSessions
    let session = await Session.findOne({
      sessionId: decoded.sessionId,
      userId: user._id,
      isActive: true
    }).select('+refreshTokenHash +previousRefreshTokenHash');

    // Get legacy session from User.activeSessions for fallback/cache updates
    const sessionIndex = user.activeSessions.findIndex(
      s => s.sessionId === decoded.sessionId
    );
    const legacySession = sessionIndex >= 0 ? user.activeSessions[sessionIndex] : null;

    // Phase 4A: Check for revoked session access attempt
    if (!session) {
      const revokedSession = await Session.findOne({
        sessionId: decoded.sessionId,
        userId: user._id,
        isActive: false
      });
      if (revokedSession) {
        logRevokedSessionAccess({
          userId: decoded.userId,
          sessionId: decoded.sessionId
        });
        return res.status(401).json({ message: 'Session has been revoked' });
      }

      // 🔐 FALLBACK: Session not in collection - check User.activeSessions
      if (!legacySession) {
        incCounter('auth.session.not_found');
        logRefreshFailure({
          userId: decoded.userId,
          sessionId: decoded.sessionId,
          reason: 'session_not_found'
        });
        return res.status(401).json({ message: 'Session not found' });
      }

      // Verify token against legacy session
      logger.info(`[LegacyFallback] Using User.activeSessions for session ${decoded.sessionId}`);
      const legacyTokenValid = user.verifyRefreshToken(legacySession, refreshToken);

      if (!legacyTokenValid) {
        // 🔍 DEBUG: Log detailed info about legacy token mismatch
        const providedHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        logger.warn(`🔴 Legacy token mismatch for session ${decoded.sessionId}:`, {
          providedHashPrefix: providedHash.substring(0, 16) + '...',
          currentHashPrefix: legacySession.refreshTokenHash ? legacySession.refreshTokenHash.substring(0, 16) + '...' : 'null',
          previousHashPrefix: legacySession.previousRefreshTokenHash ? legacySession.previousRefreshTokenHash.substring(0, 16) + '...' : 'null',
          hasPlaintextToken: !!legacySession.refreshToken,
          previousTokenExpiry: legacySession.previousTokenExpiry,
          graceStillValid: legacySession.previousTokenExpiry ? new Date() < legacySession.previousTokenExpiry : 'no expiry'
        });

        logRefreshFailure({
          userId: decoded.userId,
          sessionId: decoded.sessionId,
          reason: 'legacy_token_mismatch'
        });
        return res.status(401).json({ message: 'Invalid refresh token' });
      }

      // Try to create Session document for future requests
      try {
        session = await Session.create({
          userId: user._id,
          sessionId: decoded.sessionId,
          refreshTokenHash: legacySession.refreshTokenHash || Session.hashToken(refreshToken),
          previousRefreshTokenHash: legacySession.previousRefreshTokenHash,
          previousTokenExpiry: legacySession.previousTokenExpiry,
          refreshTokenExpiry: legacySession.refreshTokenExpiry || getRefreshTokenExpiry(),
          deviceInfo: legacySession.deviceInfo || 'Unknown Device',
          browser: legacySession.browser || 'Unknown Browser',
          os: legacySession.os || 'Unknown OS',
          ipAddress: legacySession.ipAddress,
          location: legacySession.location,
          createdAt: legacySession.createdAt || new Date(),
          lastActiveAt: legacySession.lastActive || new Date(),
          isActive: true
        });
        logger.info(`[LegacyMigration] Created Session document for ${decoded.sessionId}`);
        incCounter('auth.session.legacy_migrated');
      } catch (migrationError) {
        // If duplicate key, try to fetch it (race condition)
        if (migrationError.code === 11000) {
          session = await Session.findOne({
            sessionId: decoded.sessionId,
            userId: user._id,
            isActive: true
          }).select('+refreshTokenHash +previousRefreshTokenHash');
        }
        if (!session) {
          logger.warn('[LegacyMigration] Could not create Session document:', migrationError.message);
          // Continue anyway - we verified against legacy session
        }
      }
    } else {
      // Session found in collection - verify token
      const tokenValid = session.verifyRefreshToken(refreshToken);
      if (!tokenValid) {
        // 🔍 DEBUG: Log detailed info about token mismatch
        const providedHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        logger.warn(`🔴 Token mismatch for session ${decoded.sessionId}:`, {
          providedHashPrefix: providedHash.substring(0, 16) + '...',
          currentHashPrefix: session.refreshTokenHash ? session.refreshTokenHash.substring(0, 16) + '...' : 'null',
          previousHashPrefix: session.previousRefreshTokenHash ? session.previousRefreshTokenHash.substring(0, 16) + '...' : 'null',
          previousTokenExpiry: session.previousTokenExpiry,
          graceStillValid: session.previousTokenExpiry ? new Date() < session.previousTokenExpiry : 'no expiry',
          lastRotation: session.lastTokenRotation
        });

        logRefreshFailure({
          userId: decoded.userId,
          sessionId: decoded.sessionId,
          reason: 'token_mismatch'
        });
        return res.status(401).json({ message: 'Invalid refresh token' });
      }
    }

    // Check if refresh token has expired (use session or legacy data)
    const tokenExpiry = session?.refreshTokenExpiry || legacySession?.refreshTokenExpiry;
    if (tokenExpiry && new Date() > tokenExpiry) {
      incCounter('auth.session.expired');
      logRefreshFailure({
        userId: decoded.userId,
        sessionId: decoded.sessionId,
        reason: 'token_expired'
      });

      // Remove expired session from both stores
      if (session) {
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

    // 🔐 Generate new tokens
    const tokens = generateTokenPair(user._id, decoded.sessionId);
    const accessToken = tokens.accessToken;
    const newRefreshToken = tokens.refreshToken;

    // Update Session collection if we have a session document
    if (session) {
      // 🔧 FIX: Pass the current token so grace period works for legacy sessions
      session.rotateToken(newRefreshToken, refreshToken);
      session.refreshTokenExpiry = getRefreshTokenExpiry();
      session.lastActiveAt = new Date();
      await session.save();
    }

    // Update User.activeSessions cache (non-authoritative, for compatibility)
    if (sessionIndex >= 0) {
      const activeSession = user.activeSessions[sessionIndex];

      // 🔧 FIX: Move current hash to previous (30-minute grace period)
      // If refreshTokenHash is null (legacy session), hash the CURRENT token being presented
      // This ensures grace period works even for sessions that haven't been migrated yet
      const currentHash = activeSession.refreshTokenHash ||
                          crypto.createHash('sha256').update(refreshToken).digest('hex');
      activeSession.previousRefreshTokenHash = currentHash;
      activeSession.previousTokenExpiry = new Date(Date.now() + 30 * 60 * 1000);

      // Clear legacy plaintext fields
      activeSession.previousRefreshToken = null;
      activeSession.refreshToken = null;

      // Hash the new token for storage
      activeSession.refreshTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
      activeSession.refreshTokenExpiry = getRefreshTokenExpiry();
      activeSession.lastTokenRotation = new Date();
    }

    logger.debug(`🔄 Rotated refresh token for user ${user.username}`);

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

    logger.info(`✅ Token refresh successful for ${user.username}`);

    // Set refresh token in httpOnly cookie (ONLY source of truth)
    const cookieOptions = getRefreshTokenCookieOptions();
    res.cookie('refreshToken', newRefreshToken, cookieOptions);

    // 🔐 SECURITY: Access token returned ONLY in JSON body, NOT as cookie
    // 🔐 SECURITY: refreshToken NOT returned in body - cookie is sole source

    // Phase 4A: Track successful refresh
    incCounter('auth.refresh.success');

    res.json({
      success: true,
      accessToken,
      // 🔐 SECURITY: refreshToken no longer returned in body - cookie is sole source
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

