import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import User from '../models/User.js';
import Session from '../models/Session.js'; // 🔐 PHASE 3: Session collection is authoritative
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

const router = express.Router();

// Function to set Socket.IO instance (will be called from server.js)
let io;
export const setSocketIO = (socketIO) => {
  io = socketIO;
};

// Get all active sessions
// 🔐 PHASE 3: Query Session collection directly (authoritative source)
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Query Session collection - the SOLE source of truth
    const sessions = await Session.find({
      userId: req.user.id,
      isActive: true
    }).select('sessionId deviceInfo browser os ipAddress location createdAt lastActiveAt')
      .sort({ lastActiveAt: -1 }); // Most recent first

    // Mark current session
    const currentSessionId = req.sessionId;
    const sessionsWithCurrent = sessions.map(session => ({
      sessionId: session.sessionId,
      deviceInfo: session.deviceInfo || '',
      browser: session.browser || '',
      os: session.os || '',
      ipAddress: session.ipAddress || '',
      location: session.location || {},
      createdAt: session.createdAt,
      lastActive: session.lastActiveAt, // Alias for frontend compatibility
      lastActiveAt: session.lastActiveAt,
      isCurrent: session.sessionId === currentSessionId
    }));

    logger.debug(`[Sessions] Retrieved ${sessions.length} active sessions for user ${req.user.id}`);

    res.json({
      sessions: sessionsWithCurrent,
      total: sessions.length
    });
  } catch (error) {
    logger.error('Get sessions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout specific session
// 🔐 PHASE 3: Revoke in Session collection first (authoritative), then update User cache
router.delete('/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // 🔐 AUTHORITATIVE: Revoke in Session collection first
    const session = await Session.findOneAndUpdate(
      { sessionId, userId: req.user.id, isActive: true },
      { $set: { isActive: false, revokedAt: new Date() } },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // 🔥 CACHE SYNC: Also remove from User.activeSessions for backward compatibility
    await User.updateOne(
      { _id: req.user.id },
      { $pull: { activeSessions: { sessionId } } }
    );

    // Force disconnect Socket.IO connections for this session
    if (io) {
      const sockets = await io.fetchSockets();
      for (const socket of sockets) {
        if (socket.sessionId === sessionId) {
          socket.emit('force_logout', { reason: 'Session logged out from another device' });
          socket.disconnect(true);
        }
      }
    }

    // Clear refresh token cookie if this is the current session
    if (sessionId === req.sessionId) {
      const isProduction = process.env.NODE_ENV === 'production';
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/'
      });
    }

    logger.debug(`[Sessions] Session ${sessionId} revoked for user ${req.user.id}`);

    res.json({
      message: 'Session logged out successfully',
      sessionId
    });
  } catch (error) {
    logger.error('Logout session error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout all other sessions (keep current)
// 🔐 PHASE 3: Revoke in Session collection first (authoritative)
router.post('/logout-others', authenticateToken, async (req, res) => {
  try {
    const currentSessionId = req.sessionId;

    // 🔐 AUTHORITATIVE: Count and revoke other sessions in Session collection
    const otherSessions = await Session.find({
      userId: req.user.id,
      isActive: true,
      sessionId: { $ne: currentSessionId }
    });
    const otherSessionsCount = otherSessions.length;

    // Revoke all other sessions
    await Session.updateMany(
      { userId: req.user.id, isActive: true, sessionId: { $ne: currentSessionId } },
      { $set: { isActive: false, revokedAt: new Date() } }
    );

    // 🔥 CACHE SYNC: Also update User.activeSessions
    await User.updateOne(
      { _id: req.user.id },
      { $pull: { activeSessions: { sessionId: { $ne: currentSessionId } } } }
    );

    // Force disconnect Socket.IO connections for other sessions
    if (io) {
      const sockets = await io.fetchSockets();
      for (const socket of sockets) {
        if (socket.userId === req.user.id.toString() && socket.sessionId !== currentSessionId) {
          socket.emit('force_logout', { reason: 'Logged out from another device' });
          socket.disconnect(true);
        }
      }
    }

    logger.debug(`[Sessions] Revoked ${otherSessionsCount} other sessions for user ${req.user.id}`);

    // Get remaining count from Session collection
    const remainingSessions = await Session.countDocuments({
      userId: req.user.id,
      isActive: true
    });

    res.json({
      message: `Logged out ${otherSessionsCount} other session(s)`,
      remainingSessions
    });
  } catch (error) {
    logger.error('Logout others error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout all sessions (including current)
// 🔐 PHASE 4: Revoke ALL sessions in Session collection + emit force_logout
router.post('/logout-all', authenticateToken, async (req, res) => {
  try {
    // 🔐 AUTHORITATIVE: Count and revoke all sessions in Session collection
    const sessionCount = await Session.countDocuments({
      userId: req.user.id,
      isActive: true
    });

    // Revoke all sessions
    await Session.updateMany(
      { userId: req.user.id, isActive: true },
      { $set: { isActive: false, revokedAt: new Date() } }
    );

    // 🔥 CACHE SYNC: Also clear User.activeSessions
    await User.updateOne(
      { _id: req.user.id },
      { $set: { activeSessions: [] } }
    );

    // Force disconnect all Socket.IO connections for this user
    if (io) {
      const sockets = await io.fetchSockets();
      for (const socket of sockets) {
        if (socket.userId === req.user.id.toString()) {
          socket.emit('force_logout', { reason: 'All sessions logged out' });
          socket.disconnect(true);
        }
      }
    }

    // Clear refresh token cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/'
    });

    logger.info(`[Sessions] Revoked ALL ${sessionCount} sessions for user ${req.user.id}`);

    res.json({
      message: `Logged out all ${sessionCount} session(s)`,
      note: 'You will need to log in again'
    });
  } catch (error) {
    logger.error('Logout all error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update session activity (called periodically by frontend)
// 🔐 PHASE 3: Update Session collection (authoritative) and User cache
router.put('/activity', authenticateToken, async (req, res) => {
  try {
    const currentSessionId = req.sessionId;
    const now = new Date();

    // 🔐 AUTHORITATIVE: Update Session collection first
    await Session.updateOne(
      { sessionId: currentSessionId, userId: req.user.id, isActive: true },
      { $set: { lastActiveAt: now } }
    );

    // 🔥 CACHE SYNC: Also update User.activeSessions for compatibility
    await User.updateOne(
      { _id: req.user.id, 'activeSessions.sessionId': currentSessionId },
      { $set: { 'activeSessions.$.lastActive': now } }
    );

    res.json({ message: 'Session activity updated' });
  } catch (error) {
    logger.error('Update session activity error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

