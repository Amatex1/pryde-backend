/**
 * Admin-Only PWA Debug Tools
 * 
 * Emergency recovery endpoints for broken PWA deployments
 * Only accessible to admin and super_admin roles
 * 
 * Features:
 * - Force unregister service worker
 * - Clear all caches
 * - Force auth re-bootstrap
 * - Trigger safe reload
 * - View version compatibility state
 * - Control PWA kill-switch
 */

import express from 'express';
import auth from '../middleware/auth.js';
import adminAuth from '../middleware/adminAuth.js';
import { pwaControlState, updatePWAControlState } from './version.js';
import {
  getAllMutations,
  getMutationsByStatus,
  getStuckMutations,
  getHighRetryMutations,
  MutationStatus
} from '../utils/mutationTracker.js';
import {
  getSessionTimeline,
  getTimelineSnapshot,
  getActiveSessions,
  getTimelineSummary
} from '../utils/sessionTimeline.js';

const router = express.Router();

// All debug routes require authentication + admin role
router.use(auth);
router.use(adminAuth);

// Admin control metadata (separate from PWA state)
let adminMetadata = {
  lastUpdated: new Date(),
  updatedBy: null
};

// @route   GET /api/admin/debug/pwa/status
// @desc    Get current PWA control state
// @access  Admin only
router.get('/pwa/status', (req, res) => {
  res.json({
    ...pwaControlState,
    ...adminMetadata,
    backendVersion: process.env.BUILD_VERSION || '1.0.0',
    minFrontendVersion: process.env.MIN_FRONTEND_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// @route   POST /api/admin/debug/pwa/disable
// @desc    Disable PWA (kill-switch)
// @access  Admin only
router.post('/pwa/disable', (req, res) => {
  const { message } = req.body;

  updatePWAControlState({
    pwaEnabled: false,
    maintenanceMessage: message || 'PWA temporarily disabled for maintenance'
  });

  adminMetadata = {
    lastUpdated: new Date(),
    updatedBy: req.user.username
  };

  console.log(`🔥 [Admin Debug] PWA disabled by ${req.user.username}`);
  console.log(`   Message: ${pwaControlState.maintenanceMessage}`);

  res.json({
    success: true,
    message: 'PWA disabled successfully',
    state: { ...pwaControlState, ...adminMetadata }
  });
});

// @route   POST /api/admin/debug/pwa/enable
// @desc    Enable PWA (restore from kill-switch)
// @access  Admin only
router.post('/pwa/enable', (req, res) => {
  updatePWAControlState({
    pwaEnabled: true,
    maintenanceMessage: null
  });

  adminMetadata = {
    lastUpdated: new Date(),
    updatedBy: req.user.username
  };

  console.log(`✅ [Admin Debug] PWA enabled by ${req.user.username}`);

  res.json({
    success: true,
    message: 'PWA enabled successfully',
    state: { ...pwaControlState, ...adminMetadata }
  });
});

// @route   POST /api/admin/debug/pwa/force-reload
// @desc    Force all clients to reload and clear caches
// @access  Admin only
router.post('/pwa/force-reload', (req, res) => {
  const { message } = req.body;

  updatePWAControlState({
    forceReload: true,
    maintenanceMessage: message || 'App update required - reloading...'
  });

  adminMetadata = {
    lastUpdated: new Date(),
    updatedBy: req.user.username
  };

  console.log(`🔄 [Admin Debug] Force reload triggered by ${req.user.username}`);
  console.log(`   Message: ${pwaControlState.maintenanceMessage}`);

  res.json({
    success: true,
    message: 'Force reload triggered - all clients will reload on next request',
    state: { ...pwaControlState, ...adminMetadata }
  });
});

// @route   POST /api/admin/debug/pwa/cancel-force-reload
// @desc    Cancel force reload
// @access  Admin only
router.post('/pwa/cancel-force-reload', (req, res) => {
  updatePWAControlState({
    forceReload: false,
    maintenanceMessage: null
  });

  adminMetadata = {
    lastUpdated: new Date(),
    updatedBy: req.user.username
  };

  console.log(`✅ [Admin Debug] Force reload cancelled by ${req.user.username}`);

  res.json({
    success: true,
    message: 'Force reload cancelled',
    state: { ...pwaControlState, ...adminMetadata }
  });
});

// @route   GET /api/admin/debug/version/compatibility
// @desc    View version compatibility state
// @access  Admin only
router.get('/version/compatibility', (req, res) => {
  res.json({
    backendVersion: process.env.BUILD_VERSION || '1.0.0',
    minFrontendVersion: process.env.MIN_FRONTEND_VERSION || '1.0.0',
    buildTime: process.env.BUILD_TIME || new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    pwaControlState: { ...pwaControlState, ...adminMetadata }
  });
});

// @route   GET /api/admin/debug/mutations
// @desc    Get all tracked mutations
// @access  Admin only
router.get('/mutations', (req, res) => {
  const { status, stuck, highRetry } = req.query;

  let mutations;

  if (stuck === 'true') {
    mutations = getStuckMutations();
  } else if (highRetry === 'true') {
    mutations = getHighRetryMutations();
  } else if (status) {
    mutations = getMutationsByStatus(status);
  } else {
    mutations = getAllMutations();
  }

  res.json({
    mutations,
    count: mutations.length,
    summary: {
      total: getAllMutations().length,
      pending: getMutationsByStatus(MutationStatus.PENDING).length,
      confirmed: getMutationsByStatus(MutationStatus.CONFIRMED).length,
      failed: getMutationsByStatus(MutationStatus.FAILED).length,
      rolledBack: getMutationsByStatus(MutationStatus.ROLLED_BACK).length,
      stuck: getStuckMutations().length,
      highRetry: getHighRetryMutations().length
    }
  });
});

// @route   GET /api/admin/debug/mutations/summary
// @desc    Get mutation queue summary
// @access  Admin only
router.get('/mutations/summary', (req, res) => {
  const stuckMutations = getStuckMutations();
  const highRetryMutations = getHighRetryMutations();

  res.json({
    total: getAllMutations().length,
    pending: getMutationsByStatus(MutationStatus.PENDING).length,
    confirmed: getMutationsByStatus(MutationStatus.CONFIRMED).length,
    failed: getMutationsByStatus(MutationStatus.FAILED).length,
    rolledBack: getMutationsByStatus(MutationStatus.ROLLED_BACK).length,
    stuck: stuckMutations.length,
    highRetry: highRetryMutations.length,
    warnings: [
      ...stuckMutations.map(m => ({
        type: 'stuck',
        mutationId: m.id,
        entity: m.entity,
        age: Date.now() - m.createdAt
      })),
      ...highRetryMutations.map(m => ({
        type: 'high_retry',
        mutationId: m.id,
        entity: m.entity,
        retryCount: m.retryCount
      }))
    ]
  });
});

// @route   GET /api/admin/debug/timelines
// @desc    Get all active session timelines
// @access  Admin only
router.get('/timelines', (req, res) => {
  const summary = getTimelineSummary();
  res.json(summary);
});

// @route   GET /api/admin/debug/timelines/:sessionId
// @desc    Get timeline for a specific session
// @access  Admin only
router.get('/timelines/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const timeline = getSessionTimeline(sessionId);
  res.json(timeline);
});

// @route   GET /api/admin/debug/timelines/:sessionId/snapshot
// @desc    Get timeline snapshot for error reporting
// @access  Admin only
router.get('/timelines/:sessionId/snapshot', (req, res) => {
  const { sessionId } = req.params;
  const snapshot = getTimelineSnapshot(sessionId);
  res.json(snapshot);
});

export default router;

