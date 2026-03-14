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
import { pwaControlState, updatePWAControlState, setMaintenanceMode, getMaintenanceMode } from './version.js';
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
import {
  getAllClusters,
  getClustersByFrequency,
  getClustersByVersion,
  getRecurringClusters,
  getClusterSummary,
  getCluster
} from '../utils/bugClustering.js';
import {
  captureSessionSnapshot,
  compareSessionSnapshots,
  analyzeSessionDiff
} from '../utils/sessionDiff.js';
import {
  generateRootCauseSuggestions,
  formatSuggestions
} from '../utils/rootCauseSuggestions.js';
import {
  getRollbackStatus,
  resetMetrics
} from '../utils/rollbackTriggers.js';
import {
  getSessionMetricsDebug,
  getAllActiveSessions,
  getSafeModeSummary
} from '../utils/autoSafeMode.js';
import {
  getAllDeploys,
  getCanaryConfig,
  promoteToStable,
  isCanaryUser
} from '../utils/canaryDeploy.js';
import {
  getUserStabilityReport,
  getAllUserStabilityReports,
  getStabilitySummary
} from '../utils/stabilityScore.js';
import {
  getDeployHealthDashboard,
  getDeployComparison,
  getRollbackEvents
} from '../utils/deployHealthDashboard.js';
import {
  getDebugOverlayData,
  canAccessDebugOverlay,
  logDebugOverlayAccess
} from '../utils/debugOverlay.js';
import logger from '../utils/logger.js';

const router = express.Router();

const getActorId = (req) => req.user?._id?.toString?.() || req.user?.id || null;

// Debug routes require admin or super_admin — NOT accessible to moderators
// (system state, session timelines, deploy data are ops-level, not moderation-level)
router.use(auth);
router.use(adminAuth(['admin', 'super_admin']));

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

  logger.warn('Admin debug PWA disabled', {
    adminUserId: getActorId(req),
    maintenanceMessage: pwaControlState.maintenanceMessage
  });

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

  logger.warn('Admin debug PWA enabled', { adminUserId: getActorId(req) });

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
    forceReloadTimestamp: Date.now(), // 🔥 Set timestamp for auto-expiry
    maintenanceMessage: message || 'App update required - reloading...'
  });

  adminMetadata = {
    lastUpdated: new Date(),
    updatedBy: req.user.username
  };

  logger.warn('Admin debug force reload triggered', {
    adminUserId: getActorId(req),
    maintenanceMessage: pwaControlState.maintenanceMessage,
    autoExpiresInMinutes: 5
  });

  res.json({
    success: true,
    message: 'Force reload triggered - all clients will reload on next request (expires in 5 minutes)',
    state: { ...pwaControlState, ...adminMetadata }
  });
});

// @route   POST /api/admin/debug/pwa/cancel-force-reload
// @desc    Cancel force reload
// @access  Admin only
router.post('/pwa/cancel-force-reload', (req, res) => {
  updatePWAControlState({
    forceReload: false,
    forceReloadTimestamp: null, // 🔥 Clear timestamp
    maintenanceMessage: null
  });

  adminMetadata = {
    lastUpdated: new Date(),
    updatedBy: req.user.username
  };

  logger.warn('Admin debug force reload cancelled', { adminUserId: getActorId(req) });

  res.json({
    success: true,
    message: 'Force reload cancelled',
    state: { ...pwaControlState, ...adminMetadata }
  });
});

// ===========================================
// MAINTENANCE MODE ENDPOINTS
// ===========================================

// @route   GET /api/admin/debug/maintenance/status
// @desc    Get current maintenance mode status
// @access  Admin only
router.get('/maintenance/status', (req, res) => {
  const maintenanceStatus = getMaintenanceMode();
  
  res.json({
    ...maintenanceStatus,
    ...adminMetadata,
    state: { ...pwaControlState }
  });
});

// @route   POST /api/admin/debug/maintenance/enable
// @desc    Enable maintenance mode (shows maintenance page to all users)
// @access  Admin only
router.post('/maintenance/enable', (req, res) => {
  const { message, eta } = req.body;

  setMaintenanceMode(true, message, eta);

  adminMetadata = {
    lastUpdated: new Date(),
    updatedBy: req.user.username
  };

  logger.warn('Admin debug maintenance mode enabled', {
    adminUserId: getActorId(req),
    maintenanceMessage: message || 'Site is under maintenance',
    eta: eta || null
  });

  res.json({
    success: true,
    message: 'Maintenance mode enabled',
    maintenanceMode: true,
    state: { ...pwaControlState, ...adminMetadata }
  });
});

// @route   POST /api/admin/debug/maintenance/disable
// @desc    Disable maintenance mode (restore normal operation)
// @access  Admin only
router.post('/maintenance/disable', (req, res) => {
  setMaintenanceMode(false);

  adminMetadata = {
    lastUpdated: new Date(),
    updatedBy: req.user.username
  };

  logger.warn('Admin debug maintenance mode disabled', { adminUserId: getActorId(req) });

  res.json({
    success: true,
    message: 'Maintenance mode disabled',
    maintenanceMode: false,
    state: { ...pwaControlState, ...adminMetadata }
  });
});

// @route   POST /api/admin/debug/maintenance/toggle
// @desc    Toggle maintenance mode
// @access  Admin only
router.post('/maintenance/toggle', (req, res) => {
  const { message, eta } = req.body;
  const currentStatus = getMaintenanceMode();
  const newStatus = !currentStatus.enabled;

  setMaintenanceMode(newStatus, message, eta);

  adminMetadata = {
    lastUpdated: new Date(),
    updatedBy: req.user.username
  };

  logger.warn('Admin debug maintenance mode toggled', {
    adminUserId: getActorId(req),
    enabled: newStatus,
    maintenanceMessage: newStatus ? (message || null) : null,
    eta: eta || null
  });

  res.json({
    success: true,
    message: newStatus ? 'Maintenance mode enabled' : 'Maintenance mode disabled',
    maintenanceMode: newStatus,
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

// @route   GET /api/admin/debug/clusters
// @desc    Get all error clusters
// @access  Admin only
router.get('/clusters', (req, res) => {
  const { sortBy = 'frequency', version, minCount } = req.query;

  let clusters;

  if (version) {
    clusters = getClustersByVersion(version);
  } else if (minCount) {
    clusters = getRecurringClusters(parseInt(minCount));
  } else if (sortBy === 'frequency') {
    clusters = getClustersByFrequency();
  } else {
    clusters = getAllClusters();
  }

  res.json({
    clusters,
    total: clusters.length
  });
});

// @route   GET /api/admin/debug/clusters/summary
// @desc    Get cluster summary
// @access  Admin only
router.get('/clusters/summary', (req, res) => {
  const summary = getClusterSummary();
  res.json(summary);
});

// @route   GET /api/admin/debug/clusters/:clusterId
// @desc    Get specific cluster with analysis
// @access  Admin only
router.get('/clusters/:clusterId', (req, res) => {
  const { clusterId } = req.params;
  const cluster = getCluster(clusterId);

  if (!cluster) {
    return res.status(404).json({ message: 'Cluster not found' });
  }

  // Get session snapshots for failing sessions
  const failingSnapshots = cluster.errors.slice(0, 10).map(error =>
    captureSessionSnapshot(error.error)
  );

  // Generate root cause suggestions
  const suggestions = generateRootCauseSuggestions(cluster, [], {});
  const formattedSuggestions = formatSuggestions(suggestions);

  res.json({
    cluster,
    failingSnapshots,
    suggestions: formattedSuggestions
  });
});

// @route   GET /api/admin/debug/rollback/status
// @desc    Get rollback trigger status
// @access  Admin only
router.get('/rollback/status', (req, res) => {
  const status = getRollbackStatus();
  res.json(status);
});

// @route   POST /api/admin/debug/rollback/reset
// @desc    Reset rollback metrics
// @access  Admin only
router.post('/rollback/reset', (req, res) => {
  resetMetrics();
  res.json({ message: 'Rollback metrics reset successfully' });
});

// @route   GET /api/admin/debug/safe-mode/sessions
// @desc    Get all active sessions with Safe Mode metrics
// @access  Admin only
router.get('/safe-mode/sessions', (req, res) => {
  const sessions = getAllActiveSessions();
  res.json({
    sessions,
    total: sessions.length
  });
});

// @route   GET /api/admin/debug/safe-mode/sessions/:sessionId
// @desc    Get Safe Mode metrics for specific session
// @access  Admin only
router.get('/safe-mode/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const metrics = getSessionMetricsDebug(sessionId);
  res.json(metrics);
});

// @route   GET /api/admin/debug/safe-mode/summary
// @desc    Get Safe Mode activation summary
// @access  Admin only
router.get('/safe-mode/summary', (req, res) => {
  const summary = getSafeModeSummary();
  res.json(summary);
});

// @route   GET /api/admin/debug/deploys
// @desc    Get all active deploys
// @access  Admin only
router.get('/deploys', (req, res) => {
  const deploys = getAllDeploys();
  res.json({
    deploys,
    total: deploys.length
  });
});

// @route   GET /api/admin/debug/deploys/canary-config
// @desc    Get canary configuration
// @access  Admin only
router.get('/deploys/canary-config', (req, res) => {
  const config = getCanaryConfig();
  res.json(config);
});

// @route   POST /api/admin/debug/deploys/:version/promote
// @desc    Promote canary deploy to stable
// @access  Admin only
router.post('/deploys/:version/promote', (req, res) => {
  const { version } = req.params;

  try {
    const deploy = promoteToStable(version);
    res.json({
      message: `Deploy ${version} promoted to stable`,
      deploy: deploy.getHealthReport()
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   GET /api/admin/debug/deploys/compare
// @desc    Compare two deploys
// @access  Admin only
router.get('/deploys/compare', (req, res) => {
  const { version1, version2 } = req.query;

  if (!version1 || !version2) {
    return res.status(400).json({ message: 'Both version1 and version2 are required' });
  }

  try {
    const comparison = getDeployComparison(version1, version2);
    res.json(comparison);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   GET /api/admin/debug/stability/users
// @desc    Get all user stability reports
// @access  Admin only
router.get('/stability/users', (req, res) => {
  const reports = getAllUserStabilityReports();
  res.json({
    reports,
    total: reports.length
  });
});

// @route   GET /api/admin/debug/stability/users/:userId
// @desc    Get stability report for specific user
// @access  Admin only
router.get('/stability/users/:userId', (req, res) => {
  const { userId } = req.params;
  const report = getUserStabilityReport(userId);
  res.json(report);
});

// @route   GET /api/admin/debug/stability/summary
// @desc    Get stability summary
// @access  Admin only
router.get('/stability/summary', (req, res) => {
  const summary = getStabilitySummary();
  res.json(summary);
});

// @route   GET /api/admin/debug/health-dashboard
// @desc    Get deploy health dashboard
// @access  Admin only
router.get('/health-dashboard', (req, res) => {
  const { platform, version, timeRange } = req.query;

  const dashboard = getDeployHealthDashboard({
    platform,
    version,
    timeRange
  });

  res.json(dashboard);
});

// @route   GET /api/admin/debug/rollback-events
// @desc    Get rollback events
// @access  Admin only
router.get('/rollback-events', (req, res) => {
  const { limit = 10 } = req.query;
  const events = getRollbackEvents(parseInt(limit));
  res.json({
    events,
    total: events.length
  });
});

// @route   GET /api/admin/debug/overlay
// @desc    Get debug overlay data
// @access  Admin only
router.get('/overlay', (req, res) => {
  try {
    const user = req.adminUser;

    if (!canAccessDebugOverlay(user)) {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    const sessionId = req.headers['x-session-id'] || 'unknown';
    const data = getDebugOverlayData(user._id.toString(), sessionId);

    logDebugOverlayAccess(user._id.toString(), 'accessed');

    res.json(data);
  } catch (error) {
    logger.error('Get debug overlay data error', { adminUserId: getActorId(req) }, error);

    const response = { message: 'Server error' };
    if (process.env.NODE_ENV === 'development') {
      response.error = error.message;
    }

    res.status(500).json(response);
  }
});

export default router;

