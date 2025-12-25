/**
 * Bug Report Routes
 * 
 * User-facing bug reporting with state snapshots
 */

import express from 'express';
import auth from '../middleware/auth.js';
import adminAuth from '../middleware/adminAuth.js';
import requireActiveUser from '../middleware/requireActiveUser.js';
import BugReport from '../models/BugReport.js';
import { getTimelineSnapshot } from '../utils/sessionTimeline.js';
import { getAllMutations, getMutationsByStatus, MutationStatus } from '../utils/mutationTracker.js';

const router = express.Router();

// @route   POST /api/bug-reports
// @desc    Submit a bug report with state snapshot
// @access  Private
router.post('/', auth, requireActiveUser, async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    const sessionId = req.sessionId || `user-${userId}`;
    
    const {
      description,
      device,
      serviceWorker,
      currentRoute,
      frontendVersion
    } = req.body;
    
    // Validate description
    if (!description || description.trim().length === 0) {
      return res.status(400).json({ message: 'Description is required' });
    }
    
    if (description.length > 2000) {
      return res.status(400).json({ message: 'Description too long (max 2000 characters)' });
    }
    
    // Get timeline snapshot
    const timeline = getTimelineSnapshot(sessionId);
    
    // Get mutation queue state
    const mutations = {
      total: getAllMutations().length,
      pending: getMutationsByStatus(MutationStatus.PENDING).length,
      confirmed: getMutationsByStatus(MutationStatus.CONFIRMED).length,
      failed: getMutationsByStatus(MutationStatus.FAILED).length
    };
    
    // Create bug report
    const bugReport = new BugReport({
      userId,
      description,
      sessionSnapshot: {
        sessionId,
        auth: {
          isAuthenticated: true,
          userId: userId.toString(),
          tokenInfo: {
            present: true
            // Don't include actual token
          }
        },
        safeMode: {
          enabled: req.user?.privacySettings?.safeModeEnabled || false
        },
        mutations,
        timeline: {
          eventCount: timeline.eventCount,
          events: timeline.events
        },
        versions: {
          frontend: frontendVersion || 'unknown',
          backend: process.env.BUILD_VERSION || '1.0.0',
          minFrontend: process.env.MIN_FRONTEND_VERSION || '1.0.0'
        },
        device: device || {},
        serviceWorker: serviceWorker || {},
        currentRoute: currentRoute || 'unknown',
        environment: process.env.NODE_ENV || 'development',
        capturedAt: new Date()
      }
    });
    
    await bugReport.save();
    
    console.log(`🐛 [Bug Report] New report from user ${userId}: ${bugReport._id}`);
    
    res.status(201).json({
      message: 'Bug report submitted successfully',
      reportId: bugReport._id
    });
  } catch (error) {
    console.error('Submit bug report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/bug-reports
// @desc    Get all bug reports (admin only)
// @access  Admin
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 20 } = req.query;
    
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (priority) {
      query.priority = priority;
    }
    
    const reports = await BugReport.find(query)
      .populate('userId', 'username displayName email')
      .populate('assignedTo', 'username displayName')
      .sort({ priority: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await BugReport.countDocuments(query);
    
    res.json({
      reports,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Get bug reports error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/bug-reports/:id
// @desc    Get a specific bug report
// @access  Admin or report author
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId || req.user._id;
    
    const report = await BugReport.findById(id)
      .populate('userId', 'username displayName email')
      .populate('assignedTo', 'username displayName');
    
    if (!report) {
      return res.status(404).json({ message: 'Bug report not found' });
    }
    
    // Check if user is admin or report author
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
    const isAuthor = report.userId._id.toString() === userId.toString();
    
    if (!isAdmin && !isAuthor) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    res.json(report);
  } catch (error) {
    console.error('Get bug report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

