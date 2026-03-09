import express from 'express';
const router = express.Router();
import User from '../models/User.js';
import { verifyRefreshToken } from '../utils/tokenUtils.js';
import { getClientIp, parseUserAgent } from '../utils/sessionUtils.js';
import { getRefreshTokenCookieOptions } from '../utils/cookieUtils.js';
import { SESSION_ROTATION_CONFLICT } from '../utils/refreshRotation.js';
import { rotateRefreshSession, SESSION_SERVICE_STATUS } from '../services/sessionService.js';
import logger from '../utils/logger.js';
import { incCounter, logRefreshFailure, logRevokedSessionAccess } from '../utils/authMetrics.js'; // Phase 4A
import { refreshLimiter } from '../middleware/rateLimiter.js';
import config from '../config/config.js';

// @route   POST /api/refresh
// @desc    Refresh access token using refresh token
// @access  Public (but requires valid refresh token)
router.post('/', refreshLimiter, async (req, res) => {
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

    const { browser, os } = parseUserAgent(req.headers['user-agent']);
    const ipAddress = getClientIp(req);
    const rotation = await rotateRefreshSession({
      user,
      sessionId: decoded.sessionId,
      refreshToken,
      browser,
      os,
      ipAddress
    });

    if (rotation.status === SESSION_SERVICE_STATUS.REVOKED) {
      logRevokedSessionAccess({
        userId: decoded.userId,
        sessionId: decoded.sessionId
      });
      return res.status(401).json({ message: 'Session has been revoked' });
    }

    if (rotation.status === SESSION_SERVICE_STATUS.NOT_FOUND) {
      incCounter('auth.session.not_found');
      logRefreshFailure({
        userId: decoded.userId,
        sessionId: decoded.sessionId,
        reason: rotation.reason
      });
      return res.status(401).json({ message: 'Session not found' });
    }

    if (rotation.status === SESSION_SERVICE_STATUS.INVALID) {
      logRefreshFailure({
        userId: decoded.userId,
        sessionId: decoded.sessionId,
        reason: rotation.reason
      });
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    if (rotation.status === SESSION_SERVICE_STATUS.EXPIRED) {
      incCounter('auth.session.expired');
      logRefreshFailure({
        userId: decoded.userId,
        sessionId: decoded.sessionId,
        reason: rotation.reason
      });
      return res.status(401).json({ message: 'Refresh token has expired. Please log in again.' });
    }

    if (rotation.legacyMigrated) {
      incCounter('auth.session.legacy_migrated');
    }

    logger.debug(`🔄 Rotated refresh token for user ${user.username}`);

    logger.info(`✅ Token refresh successful for ${user.username}`);

    // Set refresh token in httpOnly cookie (ONLY source of truth)
    // 🔧 FIX: Pass request to determine sameSite based on request origin
    const cookieOptions = getRefreshTokenCookieOptions(req);
    
    // 🔥 CRITICAL: Also clear any old cookie without domain attribute
    // This handles the migration from api.prydeapp.com to .prydeapp.com
    const isProd = config.nodeEnv === 'production';
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/'
    });
    
    // Set new cookie with domain attribute
    res.cookie('refreshToken', rotation.refreshToken, cookieOptions);

    // 🔐 SECURITY: Access token returned ONLY in JSON body, NOT as cookie
    // 🔐 SECURITY: refreshToken NOT returned in body - cookie is sole source

    // Phase 4A: Track successful refresh
    incCounter('auth.refresh.success');

    res.json({
      success: true,
      accessToken: rotation.accessToken,
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
    if (error.code === SESSION_ROTATION_CONFLICT) {
      logger.warn(`⚠️ Refresh rotation conflict for session ${req.cookies?.refreshToken ? 'present-cookie' : 'missing-cookie'}`);
      return res.status(409).json({
        success: false,
        message: 'Refresh already completed elsewhere. Please retry.'
      });
    }

    logger.error('Token refresh error:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Server error during token refresh',
      error: error.message 
    });
  }
});

export default router;
