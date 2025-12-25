/**
 * Admin Health & Incident Dashboard
 * 
 * Admin-only route: /admin/health
 * 
 * Includes:
 * - Active frontend versions
 * - Canary vs stable status
 * - Incident timelines
 * - Error clusters
 * - Predictive alerts
 * - Rollback history
 * - Safe Mode activation counts
 * 
 * Access: Super Admin / Admin only
 */

import express from 'express';
import auth from '../middleware/auth.js';
import adminAuth from '../middleware/adminAuth.js';
import { getDeployHealthDashboard, getRollbackEvents } from '../utils/deployHealthDashboard.js';
import { getAllDeploys } from '../utils/canaryDeploy.js';
import { getClusterSummary, getClustersByFrequency } from '../utils/bugClustering.js';
import { getSafeModeSummary } from '../utils/autoSafeMode.js';
import { getStabilitySummary } from '../utils/stabilityScore.js';
import { getRollbackStatus } from '../utils/rollbackTriggers.js';
import {
  getAllFeatureFlags,
  getDegradedFeatures,
  getFeaturesWithOverrides,
  setAdminOverride,
  removeAdminOverride
} from '../utils/featureFlags.js';

const router = express.Router();

// All routes require admin authentication
router.use(auth);
router.use(adminAuth);

/**
 * @route   GET /api/admin/health/dashboard
 * @desc    Get comprehensive health dashboard
 * @access  Admin only
 */
router.get('/dashboard', (req, res) => {
  const { platform, version, timeRange = '24h' } = req.query;
  
  try {
    const dashboard = getDeployHealthDashboard({
      platform,
      version,
      timeRange
    });
    
    res.json(dashboard);
  } catch (error) {
    console.error('Get health dashboard error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   GET /api/admin/health/incidents
 * @desc    Get incident timeline
 * @access  Admin only
 */
router.get('/incidents', (req, res) => {
  const { limit = 50 } = req.query;
  
  try {
    // Get rollback events
    const rollbackEvents = getRollbackEvents(parseInt(limit));
    
    // Get error clusters
    const errorClusters = getClustersByFrequency().slice(0, parseInt(limit));
    
    // Combine into incident timeline
    const incidents = [
      ...rollbackEvents.map(event => ({
        type: 'rollback',
        severity: 'critical',
        timestamp: event.timestamp,
        version: event.version,
        reason: event.reason,
        details: event.details
      })),
      ...errorClusters.map(cluster => ({
        type: 'error_cluster',
        severity: cluster.errors.length >= 10 ? 'critical' : 'warning',
        timestamp: cluster.lastSeen,
        clusterId: cluster.clusterId,
        count: cluster.errors.length,
        pattern: cluster.pattern
      }))
    ].sort((a, b) => b.timestamp - a.timestamp).slice(0, parseInt(limit));
    
    res.json({
      incidents,
      total: incidents.length
    });
  } catch (error) {
    console.error('Get incidents error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   GET /api/admin/health/alerts
 * @desc    Get predictive alerts
 * @access  Admin only
 */
router.get('/alerts', (req, res) => {
  try {
    const alerts = [];
    
    // Get current metrics
    const deploys = getAllDeploys();
    const clusterSummary = getClusterSummary();
    const safeModeSummary = getSafeModeSummary();
    const stabilitySummary = getStabilitySummary();
    const rollbackStatus = getRollbackStatus();
    
    // Check for unhealthy deploys
    const unhealthyDeploys = deploys.filter(d => !d.healthy);
    if (unhealthyDeploys.length > 0) {
      alerts.push({
        severity: 'critical',
        type: 'unhealthy_deploy',
        message: `${unhealthyDeploys.length} unhealthy deploy(s) detected`,
        details: unhealthyDeploys,
        timestamp: Date.now()
      });
    }
    
    // Check for high Safe Mode activation rate
    const safeModeRate = parseFloat(safeModeSummary.activationRate);
    if (safeModeRate > 5) {
      alerts.push({
        severity: 'warning',
        type: 'high_safe_mode_rate',
        message: `Safe Mode activation rate is ${safeModeSummary.activationRate}`,
        details: safeModeSummary,
        timestamp: Date.now()
      });
    }
    
    // Check for recurring error clusters
    if (clusterSummary.recurringClusters > 5) {
      alerts.push({
        severity: 'warning',
        type: 'recurring_errors',
        message: `${clusterSummary.recurringClusters} recurring error clusters detected`,
        details: clusterSummary,
        timestamp: Date.now()
      });
    }
    
    // Check for low average stability score
    if (stabilitySummary.averageScore < 70) {
      alerts.push({
        severity: 'warning',
        type: 'low_stability',
        message: `Average stability score is ${stabilitySummary.averageScore}`,
        details: stabilitySummary,
        timestamp: Date.now()
      });
    }
    
    // Check if rollback is triggered
    if (rollbackStatus.triggered) {
      alerts.push({
        severity: 'critical',
        type: 'rollback_triggered',
        message: `Rollback triggered: ${rollbackStatus.reason}`,
        details: rollbackStatus,
        timestamp: Date.now()
      });
    }
    
    res.json({
      alerts,
      total: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      warning: alerts.filter(a => a.severity === 'warning').length
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   GET /api/admin/health/feature-flags
 * @desc    Get all feature flags
 * @access  Admin only
 */
router.get('/feature-flags', (req, res) => {
  try {
    const flags = getAllFeatureFlags();
    const degraded = getDegradedFeatures();
    const overrides = getFeaturesWithOverrides();

    res.json({
      flags,
      degraded,
      overrides,
      total: flags.length,
      degradedCount: degraded.length,
      overrideCount: overrides.length
    });
  } catch (error) {
    console.error('Get feature flags error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/admin/health/feature-flags/:feature/override
 * @desc    Set admin override for feature flag
 * @access  Admin only
 */
router.post('/feature-flags/:feature/override', (req, res) => {
  try {
    const { feature } = req.params;
    const { enabled, duration } = req.body;
    const adminId = req.adminUser._id.toString();

    const success = setAdminOverride(
      feature,
      enabled,
      adminId,
      duration ? parseInt(duration) : null
    );

    if (!success) {
      return res.status(400).json({ message: 'Invalid feature or cannot override' });
    }

    res.json({
      success: true,
      feature,
      enabled,
      adminId,
      duration
    });
  } catch (error) {
    console.error('Set feature flag override error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   DELETE /api/admin/health/feature-flags/:feature/override
 * @desc    Remove admin override for feature flag
 * @access  Admin only
 */
router.delete('/feature-flags/:feature/override', (req, res) => {
  try {
    const { feature } = req.params;

    const success = removeAdminOverride(feature);

    if (!success) {
      return res.status(400).json({ message: 'Invalid feature' });
    }

    res.json({
      success: true,
      feature
    });
  } catch (error) {
    console.error('Remove feature flag override error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;

