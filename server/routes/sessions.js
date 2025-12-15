import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Function to set Socket.IO instance (will be called from server.js)
let io;
export const setSocketIO = (socketIO) => {
  io = socketIO;
};

// Get all active sessions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('activeSessions');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Sort sessions by last active (most recent first)
    const sessions = user.activeSessions.sort((a, b) => 
      new Date(b.lastActive) - new Date(a.lastActive)
    );

    // Mark current session
    const currentSessionId = req.sessionId; // This will be set by auth middleware
    const sessionsWithCurrent = sessions.map(session => ({
      ...session.toObject(),
      isCurrent: session.sessionId === currentSessionId
    }));

    res.json({
      sessions: sessionsWithCurrent,
      total: sessions.length
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout specific session
router.delete('/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find and remove the session
    const sessionIndex = user.activeSessions.findIndex(
      s => s.sessionId === sessionId
    );

    if (sessionIndex === -1) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const removedSession = user.activeSessions[sessionIndex];
    user.activeSessions.splice(sessionIndex, 1);
    await user.save();

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
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });
    }

    res.json({
      message: 'Session logged out successfully',
      session: removedSession
    });
  } catch (error) {
    console.error('Logout session error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout all other sessions (keep current)
router.post('/logout-others', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentSessionId = req.sessionId;
    const otherSessions = user.activeSessions.filter(
      s => s.sessionId !== currentSessionId
    );
    const otherSessionsCount = otherSessions.length;

    // Keep only the current session
    user.activeSessions = user.activeSessions.filter(
      s => s.sessionId === currentSessionId
    );

    await user.save();

    // Force disconnect Socket.IO connections for other sessions
    if (io) {
      const sockets = await io.fetchSockets();
      for (const socket of sockets) {
        if (socket.userId === user._id.toString() && socket.sessionId !== currentSessionId) {
          socket.emit('force_logout', { reason: 'Logged out from another device' });
          socket.disconnect(true);
        }
      }
    }

    res.json({
      message: `Logged out ${otherSessionsCount} other session(s)`,
      remainingSessions: user.activeSessions.length
    });
  } catch (error) {
    console.error('Logout others error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout all sessions (including current)
router.post('/logout-all', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const sessionCount = user.activeSessions.length;
    user.activeSessions = [];
    await user.save();

    // Force disconnect all Socket.IO connections for this user
    if (io) {
      const sockets = await io.fetchSockets();
      for (const socket of sockets) {
        if (socket.userId === user._id.toString()) {
          socket.emit('force_logout', { reason: 'All sessions logged out' });
          socket.disconnect(true);
        }
      }
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.json({
      message: `Logged out all ${sessionCount} session(s)`,
      note: 'You will need to log in again'
    });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update session activity (called periodically by frontend)
router.put('/activity', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentSessionId = req.sessionId;
    const session = user.activeSessions.find(s => s.sessionId === currentSessionId);

    if (session) {
      session.lastActive = new Date();
      await user.save();
    }

    res.json({ message: 'Session activity updated' });
  } catch (error) {
    console.error('Update session activity error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

