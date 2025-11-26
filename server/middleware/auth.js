import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import User from '../models/User.js';
import SecurityLog from '../models/SecurityLog.js';
import { getClientIp } from '../utils/sessionUtils.js';

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    console.log('🔐 Auth middleware - Path:', req.path);
    console.log('🔑 Token received:', token ? 'Yes (' + token.substring(0, 20) + '...)' : 'No');

    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({ message: 'No authentication token, access denied' });
    }

    // Verify token
    console.log('🔐 Verifying token with secret:', config.jwtSecret ? 'Set' : 'Not set');
    const decoded = jwt.verify(token, config.jwtSecret);
    console.log('✅ Token decoded successfully. UserID:', decoded.userId);

    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      console.log('❌ User not found in database:', decoded.userId);
      return res.status(401).json({ message: 'User not found' });
    }

    console.log('✅ User found:', user.username);

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
    console.log('✅ Auth successful for:', user.username);
    next();
  } catch (error) {
    console.log('❌ Auth error:', error.message);
    res.status(401).json({ message: 'Token is not valid', error: error.message });
  }
};

// Named export for consistency
export const authenticateToken = auth;

export default auth;
