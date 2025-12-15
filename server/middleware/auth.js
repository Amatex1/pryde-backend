import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import User from '../models/User.js';
import SecurityLog from '../models/SecurityLog.js';
import { getClientIp } from '../utils/sessionUtils.js';
import { verifyAccessToken } from '../utils/tokenUtils.js';

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    // Only log in development mode
    if (config.nodeEnv === 'development') {
      console.log('🔐 Auth middleware - Path:', req.path);
      console.log('🔑 Token received:', token ? 'Yes' : 'No');
    }

    if (!token) {
      if (config.nodeEnv === 'development') {
        console.log('❌ No token provided');
      }
      return res.status(401).json({ message: 'No authentication token, access denied' });
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    if (config.nodeEnv === 'development') {
      console.log('✅ Token decoded successfully');
    }

    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');

    // Check if user is soft deleted
    if (user && user.isDeleted) {
      return res.status(401).json({ message: 'Account has been deleted' });
    }

    if (!user) {
      if (config.nodeEnv === 'development') {
        console.log('❌ User not found in database');
      }
      return res.status(401).json({ message: 'User not found' });
    }

    // Check if session still exists (session logout validation)
    if (decoded.sessionId) {
      const sessionExists = user.activeSessions.some(
        s => s.sessionId === decoded.sessionId
      );

      if (!sessionExists) {
        if (config.nodeEnv === 'development') {
          console.log('❌ Session has been logged out');
        }
        return res.status(401).json({ message: 'Session has been logged out. Please log in again.' });
      }
    }

    if (config.nodeEnv === 'development') {
      console.log('✅ User authenticated:', user.username);
    }

    // Check age if birthday exists (auto-ban underage users)
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

        console.log('❌ User is underage and has been banned:', user.username);
        return res.status(403).json({
          message: 'Your account has been banned. This platform is strictly 18+ only.',
          reason: 'underage'
        });
      }
    }

    // Check if user is banned
    if (user.isBanned) {
      console.log('❌ User is banned:', user.username);
      return res.status(403).json({ message: 'Your account has been banned' });
    }

    // Check if user is suspended
    if (user.isSuspended && user.suspendedUntil > new Date()) {
      console.log('❌ User is suspended:', user.username);
      return res.status(403).json({ message: 'Your account is suspended' });
    }

    req.user = user;
    req.userId = decoded.userId;
    req.sessionId = decoded.sessionId; // Extract session ID from token
    next();
  } catch (error) {
    if (config.nodeEnv === 'development') {
      console.log('❌ Auth error:', error.message);
    }
    res.status(401).json({ message: 'Token is not valid', error: config.nodeEnv === 'development' ? error.message : undefined });
  }
};

// Named export for consistency
export const authenticateToken = auth;

export default auth;
