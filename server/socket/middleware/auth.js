/**
 * Socket.IO Authentication Middleware
 *
 * Extracted from server.js — behaviour is identical.
 * Validates JWT, checks session existence, and blocks deleted/deactivated accounts.
 */

import jwt from 'jsonwebtoken';
import User from '../../models/User.js';
import config from '../../config/config.js';
import logger from '../../utils/logger.js';

/**
 * io.use() compatible middleware that authenticates every socket connection.
 * Attaches socket.userId and socket.sessionId on success.
 */
export const socketAuthMiddleware = async (socket, next) => {
  const authStart = Date.now();

  // Timeout guard — prevent hanging connections from blocking the middleware queue
  const authTimeout = setTimeout(() => {
    logger.error('Socket auth timeout after 5 seconds');
    next(new Error('Authentication timeout'));
  }, 5000);

  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1];

    if (config.nodeEnv === 'development') {
      logger.debug('Socket.IO authentication attempt');
      logger.debug(`Token present: ${token ? 'yes' : 'no'} | source: ${
        socket.handshake.auth?.token ? 'auth.token' :
        socket.handshake.headers?.authorization ? 'Authorization header' : 'none'
      }`);
    }

    if (!token) {
      clearTimeout(authTimeout);
      logger.warn('Socket auth failed: no token provided');
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, config.jwtSecret);

    if (config.nodeEnv === 'development') {
      logger.debug('Socket token verified successfully');
    }

    // Session existence check — only when the token embeds a sessionId
    if (decoded.sessionId) {
      const user = await User.findById(decoded.userId)
        .select('activeSessions isActive isDeleted')
        .maxTimeMS(3000);

      if (!user) {
        clearTimeout(authTimeout);
        return next(new Error('User not found'));
      }

      if (user.isDeleted) {
        clearTimeout(authTimeout);
        return next(new Error('Account deleted'));
      }

      if (!user.isActive) {
        clearTimeout(authTimeout);
        return next(new Error('Account deactivated'));
      }

      const sessionExists = user.activeSessions.some(
        s => s.sessionId === decoded.sessionId
      );

      if (!sessionExists) {
        clearTimeout(authTimeout);
        return next(new Error('Session has been logged out'));
      }
    }

    socket.userId = decoded.userId;
    socket.sessionId = decoded.sessionId;

    clearTimeout(authTimeout);
    logger.debug(`Socket auth completed in ${Date.now() - authStart}ms`);
    next();
  } catch (error) {
    clearTimeout(authTimeout);
    logger.error('Socket auth failed:', error.message);
    next(new Error('Authentication error'));
  }
};
