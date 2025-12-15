import express from 'express';
const router = express.Router();
import User from '../models/User.js';
import { verifyRefreshToken, generateTokenPair, getRefreshTokenExpiry } from '../utils/tokenUtils.js';
import { getClientIp, parseUserAgent } from '../utils/sessionUtils.js';
import logger from '../utils/logger.js';

// @route   POST /api/refresh
// @desc    Refresh access token using refresh token
// @access  Public (but requires valid refresh token)
router.post('/', async (req, res) => {
  try {
    // Try to get refresh token from httpOnly cookie first, then fall back to body
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required' });
    }

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

    // Check if user is soft deleted
    if (user.isDeleted) {
      return res.status(401).json({ message: 'Account has been deleted' });
    }

    // Check if user is banned or suspended
    if (user.isBanned) {
      return res.status(403).json({ message: 'Your account has been banned' });
    }

    if (user.isSuspended && user.suspendedUntil > new Date()) {
      return res.status(403).json({ message: 'Your account is suspended' });
    }

    // Find the session with this refresh token
    const sessionIndex = user.activeSessions.findIndex(
      s => s.sessionId === decoded.sessionId && s.refreshToken === refreshToken
    );

    if (sessionIndex === -1) {
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

    // Generate new token pair (rotate refresh token)
    const { accessToken, refreshToken: newRefreshToken, sessionId } = generateTokenPair(user._id, decoded.sessionId);

    // Update session with new refresh token (rotation)
    user.activeSessions[sessionIndex].refreshToken = newRefreshToken;
    user.activeSessions[sessionIndex].refreshTokenExpiry = getRefreshTokenExpiry();
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
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.json({
      success: true,
      accessToken,
      // Don't send refresh token in response body when using cookies
      // refreshToken: newRefreshToken,
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

