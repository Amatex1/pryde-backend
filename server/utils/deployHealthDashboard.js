/**
 * Post-Deploy Health Dashboards (Operations Visibility)
 * 
 * Dashboard shows:
 * - Active frontend versions
 * - Canary vs stable performance
 * - Error clusters by deploy
 * - Auth success rate over time
 * - Safe Mode activation counts
 * - PWA install/update success rates
 * - Rollback events
 * 
 * Rules:
 * - Near-real-time updates
 * - Filterable by platform (desktop / mobile / PWA)
 * - Read-only for non-admins
 * 
 * Outcome:
 * - Immediate deploy confidence signal
 * - Faster incident response
 * - No blind deployments
 */

import { getAllDeploys, getCanaryConfig } from './canaryDeploy.js';
import { getClustersByVersion, getClusterSummary } from './bugClustering.js';
import { getSafeModeSummary } from './autoSafeMode.js';
import { getStabilitySummary } from './stabilityScore.js';
import { getRollbackStatus } from './rollbackTriggers.js';

// Platform types
export const Platform = {
  DESKTOP: 'desktop',
  MOBILE: 'mobile',
  PWA: 'pwa'
};

// Time series data
const timeSeriesData = {
  authSuccessRate: [],
  errorRate: [],
  safeModeActivations: [],
  pwaInstallRate: [],
  pwaUpdateRate: []
};

// Rollback events
const rollbackEvents = [];

/**
 * Record auth success rate data point
 */
export function recordAuthSuccessRate(timestamp, rate) {
  timeSeriesData.authSuccessRate.push({ timestamp, rate });
  
  // Keep only last 24 hours
  const cutoff = Date.now() - (24 * 60 * 60 * 1000);
  timeSeriesData.authSuccessRate = timeSeriesData.authSuccessRate.filter(
    d => d.timestamp > cutoff
  );
}

/**
 * Record error rate data point
 */
export function recordErrorRate(timestamp, rate) {
  timeSeriesData.errorRate.push({ timestamp, rate });
  
  // Keep only last 24 hours
  const cutoff = Date.now() - (24 * 60 * 60 * 1000);
  timeSeriesData.errorRate = timeSeriesData.errorRate.filter(
    d => d.timestamp > cutoff
  );
}

/**
 * Record Safe Mode activation data point
 */
export function recordSafeModeActivation(timestamp, count) {
  timeSeriesData.safeModeActivations.push({ timestamp, count });
  
  // Keep only last 24 hours
  const cutoff = Date.now() - (24 * 60 * 60 * 1000);
  timeSeriesData.safeModeActivations = timeSeriesData.safeModeActivations.filter(
    d => d.timestamp > cutoff
  );
}

/**
 * Record PWA install rate data point
 */
export function recordPWAInstallRate(timestamp, rate) {
  timeSeriesData.pwaInstallRate.push({ timestamp, rate });
  
  // Keep only last 24 hours
  const cutoff = Date.now() - (24 * 60 * 60 * 1000);
  timeSeriesData.pwaInstallRate = timeSeriesData.pwaInstallRate.filter(
    d => d.timestamp > cutoff
  );
}

/**
 * Record PWA update rate data point
 */
export function recordPWAUpdateRate(timestamp, rate) {
  timeSeriesData.pwaUpdateRate.push({ timestamp, rate });
  
  // Keep only last 24 hours
  const cutoff = Date.now() - (24 * 60 * 60 * 1000);
  timeSeriesData.pwaUpdateRate = timeSeriesData.pwaUpdateRate.filter(
    d => d.timestamp > cutoff
  );
}

/**
 * Record rollback event
 */
export function recordRollbackEvent(version, reason, details) {
  rollbackEvents.push({
    version,
    reason,
    details,
    timestamp: Date.now()
  });
  
  console.log(`[Deploy Health] 🚨 Rollback event recorded: ${version} - ${reason}`);
}

/**
 * Get deploy health dashboard
 */
export function getDeployHealthDashboard(filters = {}) {
  const { platform, version, timeRange = '24h' } = filters;
  
  // Get all active deploys
  const deploys = getAllDeploys();
  
  // Filter by version if specified
  const filteredDeploys = version
    ? deploys.filter(d => d.version === version)
    : deploys;
  
  // Get error clusters
  const clusterSummary = getClusterSummary();
  
  // Get Safe Mode summary
  const safeModeSummary = getSafeModeSummary();
  
  // Get stability summary
  const stabilitySummary = getStabilitySummary();
  
  // Get rollback status
  const rollbackStatus = getRollbackStatus();
  
  // Get canary config
  const canaryConfig = getCanaryConfig();
  
  return {
    timestamp: Date.now(),
    filters: {
      platform: platform || 'all',
      version: version || 'all',
      timeRange
    },
    deploys: {
      active: filteredDeploys,
      canary: filteredDeploys.filter(d => d.phase === 'canary'),
      stable: filteredDeploys.filter(d => d.phase === 'stable'),
      rolledBack: filteredDeploys.filter(d => d.phase === 'rollback')
    },
    errorClusters: clusterSummary,
    safeMode: safeModeSummary,
    stability: stabilitySummary,
    rollback: {
      status: rollbackStatus,
      events: rollbackEvents.slice(-10) // Last 10 events
    },
    canaryConfig,
    timeSeries: getTimeSeriesData(timeRange),
    summary: generateSummary(filteredDeploys, clusterSummary, safeModeSummary, stabilitySummary)
  };
}

/**
 * Get time series data for time range
 */
function getTimeSeriesData(timeRange) {
  const cutoff = getTimeRangeCutoff(timeRange);
  
  return {
    authSuccessRate: timeSeriesData.authSuccessRate.filter(d => d.timestamp > cutoff),
    errorRate: timeSeriesData.errorRate.filter(d => d.timestamp > cutoff),
    safeModeActivations: timeSeriesData.safeModeActivations.filter(d => d.timestamp > cutoff),
    pwaInstallRate: timeSeriesData.pwaInstallRate.filter(d => d.timestamp > cutoff),
    pwaUpdateRate: timeSeriesData.pwaUpdateRate.filter(d => d.timestamp > cutoff)
  };
}

/**
 * Get time range cutoff timestamp
 */
function getTimeRangeCutoff(timeRange) {
  const now = Date.now();

  switch (timeRange) {
    case '1h':
      return now - (60 * 60 * 1000);
    case '6h':
      return now - (6 * 60 * 60 * 1000);
    case '24h':
      return now - (24 * 60 * 60 * 1000);
    case '7d':
      return now - (7 * 24 * 60 * 60 * 1000);
    default:
      return now - (24 * 60 * 60 * 1000);
  }
}

/**
 * Generate dashboard summary
 */
function generateSummary(deploys, clusterSummary, safeModeSummary, stabilitySummary) {
  const healthyDeploys = deploys.filter(d => d.healthy);
  const unhealthyDeploys = deploys.filter(d => !d.healthy);

  const overallHealth = deploys.length > 0
    ? (healthyDeploys.length / deploys.length) * 100
    : 100;

  return {
    overallHealth: overallHealth.toFixed(2) + '%',
    healthStatus: getHealthStatus(overallHealth),
    totalDeploys: deploys.length,
    healthyDeploys: healthyDeploys.length,
    unhealthyDeploys: unhealthyDeploys.length,
    totalErrorClusters: clusterSummary.totalClusters || 0,
    recurringClusters: clusterSummary.recurringClusters || 0,
    safeModeActivationRate: safeModeSummary.activationRate || '0%',
    averageStabilityScore: stabilitySummary.averageScore || 0,
    usersNeedingAttention: stabilitySummary.distribution?.needsAttention || 0
  };
}

/**
 * Get health status from percentage
 */
function getHealthStatus(percentage) {
  if (percentage >= 95) return 'excellent';
  if (percentage >= 80) return 'good';
  if (percentage >= 60) return 'fair';
  return 'critical';
}

/**
 * Get deploy comparison
 */
export function getDeployComparison(version1, version2) {
  const deploys = getAllDeploys();

  const deploy1 = deploys.find(d => d.version === version1);
  const deploy2 = deploys.find(d => d.version === version2);

  if (!deploy1 || !deploy2) {
    throw new Error('One or both versions not found');
  }

  return {
    version1: {
      version: deploy1.version,
      metrics: deploy1.metrics,
      healthy: deploy1.healthy
    },
    version2: {
      version: deploy2.version,
      metrics: deploy2.metrics,
      healthy: deploy2.healthy
    },
    comparison: {
      authSuccessRate: {
        version1: deploy1.metrics.authSuccessRate,
        version2: deploy2.metrics.authSuccessRate,
        better: parseFloat(deploy1.metrics.authSuccessRate) > parseFloat(deploy2.metrics.authSuccessRate) ? version1 : version2
      },
      swUpdateSuccessRate: {
        version1: deploy1.metrics.swUpdateSuccessRate,
        version2: deploy2.metrics.swUpdateSuccessRate,
        better: parseFloat(deploy1.metrics.swUpdateSuccessRate) > parseFloat(deploy2.metrics.swUpdateSuccessRate) ? version1 : version2
      },
      safeModeActivationRate: {
        version1: deploy1.metrics.safeModeActivationRate,
        version2: deploy2.metrics.safeModeActivationRate,
        better: parseFloat(deploy1.metrics.safeModeActivationRate) < parseFloat(deploy2.metrics.safeModeActivationRate) ? version1 : version2
      },
      largestErrorCluster: {
        version1: deploy1.metrics.largestErrorCluster,
        version2: deploy2.metrics.largestErrorCluster,
        better: deploy1.metrics.largestErrorCluster < deploy2.metrics.largestErrorCluster ? version1 : version2
      }
    }
  };
}

/**
 * Get rollback events
 */
export function getRollbackEvents(limit = 10) {
  return rollbackEvents.slice(-limit);
}

/**
 * Clear old time series data
 */
export function clearOldTimeSeriesData() {
  const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days

  Object.keys(timeSeriesData).forEach(key => {
    timeSeriesData[key] = timeSeriesData[key].filter(d => d.timestamp > cutoff);
  });

  console.log('[Deploy Health] Cleared old time series data');
}

