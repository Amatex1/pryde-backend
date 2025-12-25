/**
 * Session State Inspector Routes
 * 
 * Provides read-only inspection of user session state
 * 
 * Features:
 * - Auth state (authLoading, authReady, isAuthenticated)
 * - Token presence & expiry
 * - Active sockets
 * - Service worker state
 * - Cache version
 * - Frontend/backend versions
 * - Mutation queue state
 * - Safe mode state
 * - Online/offline status
 * 
 * Access:
 * - Dev mode: All users
 * - Production: Admin only
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import auth from '../middleware/auth.js';
import adminAuth from '../middleware/adminAuth.js';
import config from '../config/config.js';
import { getAllMutations, getMutationsByStatus, MutationStatus } from '../utils/mutationTracker.js';
import { getSessionTimeline } from '../utils/sessionTimeline.js';
import User from '../models/User.js';

const router = express.Router();

// In dev mode, allow all authenticated users
// In production, require admin
const inspectorAuth = process.env.NODE_ENV === 'development' 
  ? [auth] 
  : [auth, adminAuth];

// @route   GET /api/session-inspector/state
// @desc    Get current session state
// @access  Private (dev) or Admin (production)
router.get('/state', ...inspectorAuth, async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    const sessionId = req.sessionId || `user-${userId}`;
    
    // Get user
    const user = await User.findById(userId).select('privacySettings.safeModeEnabled');
    
    // Get token info
    let tokenInfo = null;
    const token = req.cookies?.token || req.cookies?.accessToken || req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwtSecret);
        tokenInfo = {
          present: true,
          valid: true,
          expiresAt: decoded.exp * 1000,
          issuedAt: decoded.iat * 1000,
          timeUntilExpiry: (decoded.exp * 1000) - Date.now()
        };
      } catch (error) {
        tokenInfo = {
          present: true,
          valid: false,
          error: error.message
        };
      }
    } else {
      tokenInfo = {
        present: false,
        valid: false
      };
    }
    
    // Get mutation queue state
    const mutations = {
      total: getAllMutations().length,
      pending: getMutationsByStatus(MutationStatus.PENDING).length,
      confirmed: getMutationsByStatus(MutationStatus.CONFIRMED).length,
      failed: getMutationsByStatus(MutationStatus.FAILED).length
    };
    
    // Get timeline
    const timeline = getSessionTimeline(sessionId);
    
    res.json({
      sessionId,
      auth: {
        isAuthenticated: !!userId,
        userId: userId?.toString(),
        tokenInfo
      },
      safeMode: {
        enabled: user?.privacySettings?.safeModeEnabled || false
      },
      mutations,
      timeline: {
        eventCount: timeline.events.length,
        lastEvent: timeline.events[timeline.events.length - 1] || null,
        createdAt: timeline.createdAt,
        lastUpdated: timeline.lastUpdated
      },
      versions: {
        backend: process.env.BUILD_VERSION || '1.0.0',
        minFrontend: process.env.MIN_FRONTEND_VERSION || '1.0.0'
      },
      environment: process.env.NODE_ENV || 'development',
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Session inspector error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/session-inspector/timeline
// @desc    Get session timeline
// @access  Private (dev) or Admin (production)
router.get('/timeline', ...inspectorAuth, async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    const sessionId = req.sessionId || `user-${userId}`;
    
    const timeline = getSessionTimeline(sessionId);
    
    res.json(timeline);
  } catch (error) {
    console.error('Get timeline error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/session-inspector/mutations
// @desc    Get mutation queue state
// @access  Private (dev) or Admin (production)
router.get('/mutations', ...inspectorAuth, async (req, res) => {
  try {
    const mutations = getAllMutations();
    
    res.json({
      mutations,
      summary: {
        total: mutations.length,
        pending: getMutationsByStatus(MutationStatus.PENDING).length,
        confirmed: getMutationsByStatus(MutationStatus.CONFIRMED).length,
        failed: getMutationsByStatus(MutationStatus.FAILED).length,
        rolledBack: getMutationsByStatus(MutationStatus.ROLLED_BACK).length
      }
    });
  } catch (error) {
    console.error('Get mutations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

