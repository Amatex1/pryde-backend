import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import { getClearCookieOptions } from '../utils/cookieUtils.js';
import {
  listActiveSessionsForUser,
  revokeSession,
  revokeOtherSessions,
  revokeAllSessions,
  touchSessionActivity
} from '../services/sessionService.js';

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
    const result = await listActiveSessionsForUser({
      userId: req.user.id,
      currentSessionId: req.sessionId
    });

    logger.debug(`[Sessions] Retrieved ${result.total} active sessions for user ${req.user.id}`);

    res.json(result);
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

    const session = await revokeSession({
      userId: req.user.id,
      sessionId,
      requireActive: true
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

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

    // Clear refresh token cookie if this is the current session - use helper to match set cookie options
    if (sessionId === req.sessionId) {
      res.clearCookie('refreshToken', getClearCookieOptions(req));
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
    const result = await revokeOtherSessions({
      userId: req.user.id,
      currentSessionId
    });

    // Force disconnect Socket.IO connections for other sessions
    if (io) {
      const sockets = await io.fetchSockets();
      for (const socket of sockets) {
        if (result.revokedSessionIds.includes(socket.sessionId)) {
          socket.emit('force_logout', { reason: 'Logged out from another device' });
          socket.disconnect(true);
        }
      }
    }

    logger.debug(`[Sessions] Revoked ${result.otherSessionsCount} other sessions for user ${req.user.id}`);

    res.json({
      message: `Logged out ${result.otherSessionsCount} other session(s)`,
      remainingSessions: result.remainingSessions
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
    const result = await revokeAllSessions({ userId: req.user.id });

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

    // Clear refresh token cookie - use helper to match set cookie options
    res.clearCookie('refreshToken', getClearCookieOptions(req));

    logger.info(`[Sessions] Revoked ALL ${result.sessionCount} sessions for user ${req.user.id}`);

    res.json({
      message: `Logged out all ${result.sessionCount} session(s)`,
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
    await touchSessionActivity({
      userId: req.user.id,
      sessionId: req.sessionId,
      now: new Date()
    });

    res.json({ message: 'Session activity updated' });
  } catch (error) {
    logger.error('Update session activity error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
