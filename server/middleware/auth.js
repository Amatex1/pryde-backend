import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import User from '../models/User.js';
import SecurityLog from '../models/SecurityLog.js';
import { getClientIp } from '../utils/sessionUtils.js';
import { verifyAccessToken } from '../utils/tokenUtils.js';
import { sendUnauthorizedError, ErrorCodes } from '../utils/errorResponse.js';

const auth = async (req, res, next) => {
  try {
    // Try to get token from cookies or headers
    let token = req.cookies?.token || req.cookies?.accessToken;
    if (!token) {
      token = req.header('Authorization')?.replace('Bearer ', '') || req.header('x-auth-token');
    }

    // Debug logging
    if (config.nodeEnv === 'development') {
      console.log('🔐 Auth middleware - Path:', req.path);
      console.log('🍪 Cookies:', req.cookies);
      console.log('🔑 Final token:', token ? 'Yes' : 'No');

      // Log token age if present
      if (token) {
        try {
          const decoded = jwt.decode(token);
          if (decoded && decoded.exp) {
            const expiresIn = decoded.exp * 1000 - Date.now();
            const minutesLeft = Math.floor(expiresIn / 1000 / 60);
            console.log(`⏰ Token expires in: ${minutesLeft} minutes`);
          }
        } catch (e) {
          // Ignore decode errors
        }
      }
    }

    if (!token) {
      if (config.nodeEnv === 'development') {
        console.log('❌ No token provided in cookies or headers');
        console.log('📍 Cookie names present:', Object.keys(req.cookies || {}));
        console.log('📍 Authorization header:', req.header('Authorization') ? 'Present' : 'Missing');
        console.log('📍 x-auth-token header:', req.header('x-auth-token') ? 'Present' : 'Missing');

        // DIAGNOSTIC: Special warning for upload routes
        if (req.path.includes('/upload')) {
          console.warn('[UPLOAD BLOCKED] Auth middleware returned 401');
          console.warn('[UPLOAD BLOCKED] Reason: No authentication token');
          console.warn('[UPLOAD BLOCKED] Path:', req.path);
          console.warn('[UPLOAD BLOCKED] This is the exact cause of the auth failure');
        }
      }
      return sendUnauthorizedError(res, 'No authentication token, access denied', ErrorCodes.UNAUTHORIZED);
    }

    // Verify token
    const decoded = verifyAccessToken(token);
    if (config.nodeEnv === 'development') {
      console.log('✅ Token decoded successfully');
    }

    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      if (config.nodeEnv === 'development') {
        console.log('❌ User not found in database');
      }
      return sendUnauthorizedError(res, 'User not found', ErrorCodes.UNAUTHORIZED);
    }

    // PHASE B: Lock System Accounts
    // System accounts can NEVER authenticate
    // They can only be used by admins via "Post As" functionality
    if (user.isSystemAccount === true) {
      if (config.nodeEnv === 'development') {
        console.log('❌ System account cannot authenticate');
        console.log('🤖 System account:', user.username);
      }

      // Log security event
      await SecurityLog.create({
        userId: user._id,
        action: 'SYSTEM_ACCOUNT_LOGIN_ATTEMPT',
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        success: false,
        details: {
          username: user.username,
          systemRole: user.systemRole,
          reason: 'System accounts cannot authenticate'
        }
      });

      return res.status(403).json({
        message: 'System accounts cannot authenticate',
        code: 'SYSTEM_ACCOUNT_LOGIN_DENIED'
      });
    }

    // Check if user account is deleted
    if (user.isDeleted) {
      if (config.nodeEnv === 'development') {
        console.log('❌ Account has been deleted');
      }
      return sendUnauthorizedError(res, 'Account deleted', ErrorCodes.ACCOUNT_DELETED);
    }

    // Check if session still exists
    if (decoded.sessionId && user.activeSessions) {
      const sessionExists = user.activeSessions.some(
        s => s.sessionId === decoded.sessionId
      );
      if (!sessionExists) {
        if (config.nodeEnv === 'development') {
          console.log('❌ Session has been logged out');
        }
        return sendUnauthorizedError(res, 'Session has been logged out. Please log in again.', ErrorCodes.UNAUTHORIZED);
      }
    }

    if (config.nodeEnv === 'development') {
      console.log('✅ User authenticated:', user.username);
    }

    // Check age if birthday exists
    if (user.birthday) {
      const birthDate = new Date(user.birthday);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age < 18) {
        // Auto-ban underage user
        user.isBanned = true;
        user.bannedReason = 'Underage - Platform is strictly 18+ only';
        await user.save();
        // Log underage access attempt
        try {
          await SecurityLog.create({
            type: 'underage_access',
            severity: 'critical',
            username: user.username,
            email: user.email,
            userId: user._id,
            birthday: user.birthday,
            calculatedAge: age,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'],
            details: `Underage user attempted to access ${req.path} and was auto-banned. Age: ${age} years old.`,
            action: 'banned'
          });
        } catch (logError) {
          console.error('Failed to log underage access attempt:', logError);
        }
        if (config.nodeEnv === 'development') {
          console.log('❌ User is underage and has been banned:', user.username);
        }
        return res.status(403).json({
          message: 'Your account has been banned. This platform is strictly 18+ only.',
          reason: 'underage'
        });
      }
    }

    // Check if user is banned
    if (user.isBanned) {
      if (config.nodeEnv === 'development') {
        console.log('❌ User is banned:', user.username);
      }
      return res.status(403).json({ message: 'Your account has been banned' });
    }

    // Check if user is suspended
    if (user.isSuspended && user.suspendedUntil > new Date()) {
      if (config.nodeEnv === 'development') {
        console.log('❌ User is suspended:', user.username);
      }
      return res.status(403).json({ message: 'Your account is suspended' });
    }

    req.user = user;
    req.userId = decoded.userId;
    req.sessionId = decoded.sessionId; // Extract session ID from token
    next();
  } catch (error) {
    // 🔥 CRITICAL FIX: NEVER return 500 on auth failures - always return 401
    if (config.nodeEnv === 'development') {
      console.log('❌ Auth error:', error.message);
    }

    // Determine specific error message
    let errorMessage = 'Token is not valid';
    let errorCode = 'INVALID_TOKEN';

    if (error.name === 'TokenExpiredError') {
      errorMessage = 'Token has expired';
      errorCode = 'TOKEN_EXPIRED';
    } else if (error.name === 'JsonWebTokenError') {
      errorMessage = 'Invalid token format';
      errorCode = 'MALFORMED_TOKEN';
    } else if (error.name === 'NotBeforeError') {
      errorMessage = 'Token not yet valid';
      errorCode = 'TOKEN_NOT_ACTIVE';
    }

    // ALWAYS return 401, NEVER 500
    res.status(401).json({
      message: errorMessage,
      code: errorCode,
      error: config.nodeEnv === 'development' ? error.message : undefined
    });
  }
};

// Named export for consistency
export const authenticateToken = auth;

/**
 * Optional authentication middleware
 * Sets req.user and req.userId if valid token present, but doesn't reject if missing
 * Useful for endpoints that work for both authenticated and unauthenticated users
 */
export const optionalAuth = async (req, res, next) => {
  try {
    // Try to get token from cookies or headers
    let token = req.cookies?.token || req.cookies?.accessToken;
    if (!token) {
      token = req.header('Authorization')?.replace('Bearer ', '') || req.header('x-auth-token');
    }

    // No token - continue without authentication
    if (!token) {
      return next();
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');

    // Only set user if account is active and not deleted
    if (user && !user.isDeleted && user.isActive !== false) {
      req.user = user;
      req.userId = user._id;
    }
    next();
  } catch (error) {
    // Token invalid or expired - continue without authentication
    next();
  }
};

export default auth;

