/**
 * Automatic Safe Mode Activation
 * 
 * Self-healing UX that automatically enables Safe Mode when issues detected:
 * - Repeated auth bootstrap failures
 * - Infinite authReady loops
 * - Service worker install/update failures
 * - Mutation queue stuck beyond threshold
 * - Offline/online thrashing
 * - Critical error cluster exceeds limit
 * 
 * When triggered:
 * - Automatically enable Safe Mode for user session
 * - Persist Safe Mode flag locally
 * - Disable: SW, sockets, polling, optimistic UI
 * - Show calm banner
 * 
 * Exit conditions:
 * - App stabilizes
 * - User reloads
 * - New stable version detected
 * 
 * Outcome:
 * - Users protected from broken states
 * - No infinite loops
 * - No rage refreshes
 */

import User from '../models/User.js';

// Thresholds for auto-activation
const THRESHOLDS = {
  AUTH_FAILURES: 3, // Consecutive auth failures
  AUTH_READY_LOOPS: 2, // Auth ready loops
  SW_FAILURES: 2, // SW install/update failures
  STUCK_MUTATIONS: 5, // Mutations stuck > 30s
  OFFLINE_THRASHING: 5, // Offline/online transitions in 1 min
  CRITICAL_ERROR_CLUSTER: 10 // Errors in same cluster
};

// Session tracking
const sessionMetrics = new Map();

/**
 * Get or create session metrics
 */
function getSessionMetrics(sessionId) {
  if (!sessionMetrics.has(sessionId)) {
    sessionMetrics.set(sessionId, {
      authFailures: 0,
      authReadyLoops: 0,
      swFailures: 0,
      stuckMutations: 0,
      offlineTransitions: [],
      errorClusters: new Map(),
      safeModeActivated: false,
      lastReset: Date.now()
    });
  }
  
  return sessionMetrics.get(sessionId);
}

/**
 * Track auth failure
 */
export function trackAuthFailure(sessionId) {
  const metrics = getSessionMetrics(sessionId);
  metrics.authFailures++;
  
  console.log(`[Auto Safe Mode] ${sessionId}: Auth failures: ${metrics.authFailures}`);
  
  if (metrics.authFailures >= THRESHOLDS.AUTH_FAILURES) {
    activateSafeMode(sessionId, 'repeated_auth_failures', {
      failures: metrics.authFailures,
      threshold: THRESHOLDS.AUTH_FAILURES
    });
  }
}

/**
 * Track auth ready loop
 */
export function trackAuthReadyLoop(sessionId) {
  const metrics = getSessionMetrics(sessionId);
  metrics.authReadyLoops++;
  
  console.log(`[Auto Safe Mode] ${sessionId}: Auth ready loops: ${metrics.authReadyLoops}`);
  
  if (metrics.authReadyLoops >= THRESHOLDS.AUTH_READY_LOOPS) {
    activateSafeMode(sessionId, 'auth_ready_loops', {
      loops: metrics.authReadyLoops,
      threshold: THRESHOLDS.AUTH_READY_LOOPS
    });
  }
}

/**
 * Track service worker failure
 */
export function trackSWFailure(sessionId) {
  const metrics = getSessionMetrics(sessionId);
  metrics.swFailures++;
  
  console.log(`[Auto Safe Mode] ${sessionId}: SW failures: ${metrics.swFailures}`);
  
  if (metrics.swFailures >= THRESHOLDS.SW_FAILURES) {
    activateSafeMode(sessionId, 'service_worker_failures', {
      failures: metrics.swFailures,
      threshold: THRESHOLDS.SW_FAILURES
    });
  }
}

/**
 * Track stuck mutation
 */
export function trackStuckMutation(sessionId) {
  const metrics = getSessionMetrics(sessionId);
  metrics.stuckMutations++;
  
  console.log(`[Auto Safe Mode] ${sessionId}: Stuck mutations: ${metrics.stuckMutations}`);
  
  if (metrics.stuckMutations >= THRESHOLDS.STUCK_MUTATIONS) {
    activateSafeMode(sessionId, 'stuck_mutations', {
      stuck: metrics.stuckMutations,
      threshold: THRESHOLDS.STUCK_MUTATIONS
    });
  }
}

/**
 * Track offline transition
 */
export function trackOfflineTransition(sessionId) {
  const metrics = getSessionMetrics(sessionId);
  const now = Date.now();
  
  // Add transition
  metrics.offlineTransitions.push(now);
  
  // Keep only last minute
  metrics.offlineTransitions = metrics.offlineTransitions.filter(
    time => now - time < 60000
  );
  
  console.log(`[Auto Safe Mode] ${sessionId}: Offline transitions: ${metrics.offlineTransitions.length}`);
  
  if (metrics.offlineTransitions.length >= THRESHOLDS.OFFLINE_THRASHING) {
    activateSafeMode(sessionId, 'offline_thrashing', {
      transitions: metrics.offlineTransitions.length,
      threshold: THRESHOLDS.OFFLINE_THRASHING
    });
  }
}

/**
 * Track error cluster
 */
export function trackErrorCluster(sessionId, clusterId) {
  const metrics = getSessionMetrics(sessionId);
  
  const count = (metrics.errorClusters.get(clusterId) || 0) + 1;
  metrics.errorClusters.set(clusterId, count);
  
  console.log(`[Auto Safe Mode] ${sessionId}: Error cluster ${clusterId}: ${count}`);
  
  if (count >= THRESHOLDS.CRITICAL_ERROR_CLUSTER) {
    activateSafeMode(sessionId, 'critical_error_cluster', {
      clusterId,
      count,
      threshold: THRESHOLDS.CRITICAL_ERROR_CLUSTER
    });
  }
}

/**
 * Activate Safe Mode for session
 */
async function activateSafeMode(sessionId, reason, details) {
  const metrics = getSessionMetrics(sessionId);

  if (metrics.safeModeActivated) {
    console.log(`[Auto Safe Mode] ${sessionId}: Safe Mode already activated`);
    return;
  }

  metrics.safeModeActivated = true;
  metrics.safeModeReason = reason;
  metrics.safeModeDetails = details;
  metrics.safeModeActivatedAt = Date.now();

  console.log(`[Auto Safe Mode] 🛡️ ACTIVATING SAFE MODE for ${sessionId}`);
  console.log(`[Auto Safe Mode] Reason: ${reason}`, details);

  // Degrade features when Safe Mode is activated
  const { degradeFeature } = require('./featureFlags.js');
  degradeFeature('PWA', `Safe Mode: ${reason}`);
  degradeFeature('SOCKETS', `Safe Mode: ${reason}`);
  degradeFeature('POLLING', `Safe Mode: ${reason}`);
  degradeFeature('OPTIMISTIC_UI', `Safe Mode: ${reason}`);

  return {
    activated: true,
    reason,
    details,
    timestamp: Date.now()
  };
}

/**
 * Check if Safe Mode is activated for session
 */
export function isSafeModeActivated(sessionId) {
  const metrics = getSessionMetrics(sessionId);
  return metrics.safeModeActivated;
}

/**
 * Reset session metrics
 */
export function resetSessionMetrics(sessionId) {
  sessionMetrics.delete(sessionId);
  console.log(`[Auto Safe Mode] ${sessionId}: Metrics reset`);
}

/**
 * Get session metrics for debugging
 */
export function getSessionMetricsDebug(sessionId) {
  const metrics = getSessionMetrics(sessionId);

  return {
    sessionId,
    authFailures: metrics.authFailures,
    authReadyLoops: metrics.authReadyLoops,
    swFailures: metrics.swFailures,
    stuckMutations: metrics.stuckMutations,
    offlineTransitions: metrics.offlineTransitions.length,
    errorClusters: Array.from(metrics.errorClusters.entries()).map(([id, count]) => ({
      clusterId: id,
      count
    })),
    safeModeActivated: metrics.safeModeActivated,
    lastReset: metrics.lastReset
  };
}

/**
 * Get all active sessions
 */
export function getAllActiveSessions() {
  return Array.from(sessionMetrics.keys()).map(sessionId =>
    getSessionMetricsDebug(sessionId)
  );
}

/**
 * Get Safe Mode activation summary
 */
export function getSafeModeSummary() {
  const sessions = getAllActiveSessions();

  const activatedSessions = sessions.filter(s => s.safeModeActivated);

  return {
    totalSessions: sessions.length,
    safeModeActivated: activatedSessions.length,
    activationRate: sessions.length > 0
      ? (activatedSessions.length / sessions.length * 100).toFixed(2) + '%'
      : '0%',
    thresholds: THRESHOLDS
  };
}

/**
 * Get Safe Mode status for session
 */
export function getSafeModeStatus(sessionId) {
  const metrics = getSessionMetrics(sessionId);

  return {
    enabled: metrics.safeModeActivated,
    trigger: metrics.safeModeReason || null,
    details: metrics.safeModeDetails || null,
    activatedAt: metrics.safeModeActivatedAt || null
  };
}

/**
 * Enable Safe Mode manually
 */
export function enableSafeMode(sessionId, reason = 'user_manual') {
  const metrics = getSessionMetrics(sessionId);

  if (metrics.safeModeActivated) {
    return { success: false, message: 'Safe Mode already activated' };
  }

  activateSafeMode(sessionId, reason, { manual: true });

  return { success: true, message: 'Safe Mode enabled' };
}

/**
 * Disable Safe Mode manually
 */
export function disableSafeMode(sessionId) {
  const metrics = getSessionMetrics(sessionId);

  if (!metrics.safeModeActivated) {
    return { success: false, message: 'Safe Mode not activated' };
  }

  metrics.safeModeActivated = false;
  metrics.safeModeReason = null;
  metrics.safeModeDetails = null;
  metrics.safeModeActivatedAt = null;

  // Restore features when Safe Mode is disabled
  const { restoreFeature } = require('./featureFlags.js');
  restoreFeature('PWA');
  restoreFeature('SOCKETS');
  restoreFeature('POLLING');
  restoreFeature('OPTIMISTIC_UI');

  console.log(`[Auto Safe Mode] ${sessionId}: Safe Mode disabled`);

  return { success: true, message: 'Safe Mode disabled' };
}

