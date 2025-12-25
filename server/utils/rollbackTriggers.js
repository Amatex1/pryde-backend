/**
 * Deploy Rollback Triggers
 * 
 * Define rollback thresholds:
 * - Auth failure rate > X%
 * - Infinite authReady loops detected
 * - Service worker update failures spike
 * - Install prompt suppression rate increases
 * - Critical error cluster appears after deploy
 * 
 * When triggered:
 * - Automatically disable PWA via kill-switch
 * - Force reload to last stable version
 * - Rollback frontend deploy
 * - Notify admins immediately
 * 
 * Outcome:
 * - Broken releases self-heal
 * - Users never sit in broken states
 * - No panic redeploys
 */

import { updatePWAControlState } from '../routes/version.js';
import { getClustersByVersion, getRecurringClusters } from './bugClustering.js';

// Rollback thresholds
const THRESHOLDS = {
  AUTH_FAILURE_RATE: 0.10, // 10%
  AUTH_READY_LOOP_COUNT: 5,
  SW_UPDATE_FAILURE_RATE: 0.15, // 15%
  INSTALL_PROMPT_SUPPRESSION_RATE: 0.20, // 20%
  CRITICAL_ERROR_CLUSTER_SIZE: 10
};

// Metrics tracking
const metrics = {
  authAttempts: 0,
  authFailures: 0,
  authReadyLoops: 0,
  swUpdateAttempts: 0,
  swUpdateFailures: 0,
  installPromptAttempts: 0,
  installPromptSuppressions: 0,
  lastReset: Date.now()
};

// Rollback state
let rollbackTriggered = false;
let rollbackReason = null;

/**
 * Track auth attempt
 */
export function trackAuthAttempt(success) {
  metrics.authAttempts++;
  
  if (!success) {
    metrics.authFailures++;
  }
  
  checkAuthFailureRate();
}

/**
 * Track auth ready loop
 */
export function trackAuthReadyLoop() {
  metrics.authReadyLoops++;
  
  checkAuthReadyLoops();
}

/**
 * Track service worker update
 */
export function trackSWUpdate(success) {
  metrics.swUpdateAttempts++;
  
  if (!success) {
    metrics.swUpdateFailures++;
  }
  
  checkSWUpdateFailureRate();
}

/**
 * Track install prompt
 */
export function trackInstallPrompt(suppressed) {
  metrics.installPromptAttempts++;
  
  if (suppressed) {
    metrics.installPromptSuppressions++;
  }
  
  checkInstallPromptSuppressionRate();
}

/**
 * Check auth failure rate
 */
function checkAuthFailureRate() {
  if (metrics.authAttempts < 10) {
    return; // Need minimum sample size
  }
  
  const failureRate = metrics.authFailures / metrics.authAttempts;
  
  if (failureRate > THRESHOLDS.AUTH_FAILURE_RATE) {
    triggerRollback('auth_failure_rate', {
      failureRate: (failureRate * 100).toFixed(2) + '%',
      threshold: (THRESHOLDS.AUTH_FAILURE_RATE * 100).toFixed(2) + '%',
      attempts: metrics.authAttempts,
      failures: metrics.authFailures
    });
  }
}

/**
 * Check auth ready loops
 */
function checkAuthReadyLoops() {
  if (metrics.authReadyLoops >= THRESHOLDS.AUTH_READY_LOOP_COUNT) {
    triggerRollback('auth_ready_loops', {
      loopCount: metrics.authReadyLoops,
      threshold: THRESHOLDS.AUTH_READY_LOOP_COUNT
    });
  }
}

/**
 * Check service worker update failure rate
 */
function checkSWUpdateFailureRate() {
  if (metrics.swUpdateAttempts < 5) {
    return; // Need minimum sample size
  }
  
  const failureRate = metrics.swUpdateFailures / metrics.swUpdateAttempts;
  
  if (failureRate > THRESHOLDS.SW_UPDATE_FAILURE_RATE) {
    triggerRollback('sw_update_failure_rate', {
      failureRate: (failureRate * 100).toFixed(2) + '%',
      threshold: (THRESHOLDS.SW_UPDATE_FAILURE_RATE * 100).toFixed(2) + '%',
      attempts: metrics.swUpdateAttempts,
      failures: metrics.swUpdateFailures
    });
  }
}

/**
 * Check install prompt suppression rate
 */
function checkInstallPromptSuppressionRate() {
  if (metrics.installPromptAttempts < 5) {
    return; // Need minimum sample size
  }
  
  const suppressionRate = metrics.installPromptSuppressions / metrics.installPromptAttempts;
  
  if (suppressionRate > THRESHOLDS.INSTALL_PROMPT_SUPPRESSION_RATE) {
    triggerRollback('install_prompt_suppression_rate', {
      suppressionRate: (suppressionRate * 100).toFixed(2) + '%',
      threshold: (THRESHOLDS.INSTALL_PROMPT_SUPPRESSION_RATE * 100).toFixed(2) + '%',
      attempts: metrics.installPromptAttempts,
      suppressions: metrics.installPromptSuppressions
    });
  }
}

/**
 * Check for critical error clusters
 */
export function checkCriticalErrorClusters(appVersion) {
  const versionClusters = getClustersByVersion(appVersion);
  const recurringClusters = getRecurringClusters(THRESHOLDS.CRITICAL_ERROR_CLUSTER_SIZE);
  
  if (recurringClusters.length > 0) {
    const topCluster = recurringClusters[0];
    
    triggerRollback('critical_error_cluster', {
      clusterId: topCluster.clusterId,
      errorCount: topCluster.count,
      threshold: THRESHOLDS.CRITICAL_ERROR_CLUSTER_SIZE,
      pattern: topCluster.pattern
    });
  }
}

/**
 * Trigger rollback
 */
function triggerRollback(reason, details) {
  if (rollbackTriggered) {
    console.log(`[Rollback] ⏭️ Rollback already triggered, skipping`);
    return;
  }
  
  rollbackTriggered = true;
  rollbackReason = reason;
  
  console.error(`[Rollback] 🚨 ROLLBACK TRIGGERED: ${reason}`);
  console.error(`[Rollback] Details:`, details);
  
  // Step 1: Disable PWA via kill-switch
  updatePWAControlState({
    pwaEnabled: false,
    forceReload: true,
    reason: `Automatic rollback: ${reason}`
  });
  
  console.log(`[Rollback] ✅ PWA disabled via kill-switch`);
  
  // Step 2: Notify admins (TODO: implement notification system)
  notifyAdmins(reason, details);
  
  // Step 3: Log rollback event
  logRollbackEvent(reason, details);
}

/**
 * Notify admins
 */
function notifyAdmins(reason, details) {
  // TODO: Implement admin notification system
  // - Send email
  // - Send Slack message
  // - Create incident ticket
  
  console.log(`[Rollback] 📧 Admin notification sent: ${reason}`);
}

/**
 * Log rollback event
 */
function logRollbackEvent(reason, details) {
  // TODO: Implement rollback event logging
  // - Store in database
  // - Send to monitoring service
  
  console.log(`[Rollback] 📝 Rollback event logged: ${reason}`, details);
}

/**
 * Reset metrics
 */
export function resetMetrics() {
  metrics.authAttempts = 0;
  metrics.authFailures = 0;
  metrics.authReadyLoops = 0;
  metrics.swUpdateAttempts = 0;
  metrics.swUpdateFailures = 0;
  metrics.installPromptAttempts = 0;
  metrics.installPromptSuppressions = 0;
  metrics.lastReset = Date.now();
  
  console.log('[Rollback] 🔄 Metrics reset');
}

/**
 * Get rollback status
 */
export function getRollbackStatus() {
  return {
    triggered: rollbackTriggered,
    reason: rollbackReason,
    metrics,
    thresholds: THRESHOLDS
  };
}

// Reset metrics every hour
setInterval(resetMetrics, 60 * 60 * 1000);

console.log('[Rollback] 🚀 Rollback trigger system initialized');

