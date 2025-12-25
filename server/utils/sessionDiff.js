/**
 * Session Diff Comparison
 * 
 * For clustered errors:
 * - Capture session snapshots (auth, cache, SW, online/offline, mutations)
 * - Diff failing sessions against healthy sessions
 * - Highlight what changed, what broke first, what correlates with failure
 * 
 * Outcome:
 * - Root causes emerge visually
 * - No guesswork debugging
 */

/**
 * Capture session snapshot
 */
export function captureSessionSnapshot(sessionData) {
  return {
    sessionId: sessionData.sessionId,
    timestamp: Date.now(),
    
    // Auth state
    auth: {
      isAuthenticated: sessionData.auth?.isAuthenticated || false,
      userId: sessionData.auth?.userId || null,
      tokenPresent: sessionData.auth?.tokenInfo?.present || false,
      tokenValid: sessionData.auth?.tokenInfo?.valid || false,
      tokenExpiry: sessionData.auth?.tokenInfo?.expiresAt || null
    },
    
    // Service worker state
    serviceWorker: {
      registered: sessionData.serviceWorker?.registered || false,
      state: sessionData.serviceWorker?.state || 'unknown',
      cacheVersion: sessionData.serviceWorker?.cacheVersion || null
    },
    
    // Cache state
    cache: {
      version: sessionData.versions?.frontend || null,
      backendVersion: sessionData.versions?.backend || null
    },
    
    // Online/offline state
    network: {
      isOnline: sessionData.device?.isOnline !== false,
      isPWA: sessionData.device?.isPWA || false
    },
    
    // Mutation queue
    mutations: {
      total: sessionData.mutations?.total || 0,
      pending: sessionData.mutations?.pending || 0,
      failed: sessionData.mutations?.failed || 0
    },
    
    // Safe mode
    safeMode: {
      enabled: sessionData.safeMode?.enabled || false
    },
    
    // Current route
    route: sessionData.currentRoute || 'unknown',
    
    // Timeline events
    timeline: {
      eventCount: sessionData.timeline?.eventCount || 0,
      lastEvent: sessionData.timeline?.lastEvent || null
    }
  };
}

/**
 * Compare two session snapshots
 */
export function compareSessionSnapshots(failingSnapshot, healthySnapshot) {
  const differences = [];
  
  // Compare auth state
  if (failingSnapshot.auth.isAuthenticated !== healthySnapshot.auth.isAuthenticated) {
    differences.push({
      category: 'auth',
      field: 'isAuthenticated',
      failing: failingSnapshot.auth.isAuthenticated,
      healthy: healthySnapshot.auth.isAuthenticated,
      severity: 'high'
    });
  }
  
  if (failingSnapshot.auth.tokenValid !== healthySnapshot.auth.tokenValid) {
    differences.push({
      category: 'auth',
      field: 'tokenValid',
      failing: failingSnapshot.auth.tokenValid,
      healthy: healthySnapshot.auth.tokenValid,
      severity: 'high'
    });
  }
  
  // Compare service worker state
  if (failingSnapshot.serviceWorker.state !== healthySnapshot.serviceWorker.state) {
    differences.push({
      category: 'serviceWorker',
      field: 'state',
      failing: failingSnapshot.serviceWorker.state,
      healthy: healthySnapshot.serviceWorker.state,
      severity: 'medium'
    });
  }
  
  if (failingSnapshot.serviceWorker.cacheVersion !== healthySnapshot.serviceWorker.cacheVersion) {
    differences.push({
      category: 'serviceWorker',
      field: 'cacheVersion',
      failing: failingSnapshot.serviceWorker.cacheVersion,
      healthy: healthySnapshot.serviceWorker.cacheVersion,
      severity: 'medium'
    });
  }
  
  // Compare cache versions
  if (failingSnapshot.cache.version !== healthySnapshot.cache.version) {
    differences.push({
      category: 'cache',
      field: 'version',
      failing: failingSnapshot.cache.version,
      healthy: healthySnapshot.cache.version,
      severity: 'high'
    });
  }
  
  // Compare network state
  if (failingSnapshot.network.isOnline !== healthySnapshot.network.isOnline) {
    differences.push({
      category: 'network',
      field: 'isOnline',
      failing: failingSnapshot.network.isOnline,
      healthy: healthySnapshot.network.isOnline,
      severity: 'high'
    });
  }
  
  // Compare mutation queue
  if (failingSnapshot.mutations.failed > 0 && healthySnapshot.mutations.failed === 0) {
    differences.push({
      category: 'mutations',
      field: 'failed',
      failing: failingSnapshot.mutations.failed,
      healthy: healthySnapshot.mutations.failed,
      severity: 'medium'
    });
  }
  
  // Compare safe mode
  if (failingSnapshot.safeMode.enabled !== healthySnapshot.safeMode.enabled) {
    differences.push({
      category: 'safeMode',
      field: 'enabled',
      failing: failingSnapshot.safeMode.enabled,
      healthy: healthySnapshot.safeMode.enabled,
      severity: 'low'
    });
  }
  
  return differences;
}

/**
 * Analyze session diff for root cause
 */
export function analyzeSessionDiff(differences) {
  const analysis = {
    likelyRootCause: null,
    affectedSubsystems: [],
    correlations: [],
    recommendations: []
  };
  
  // Count differences by category
  const categoryCounts = {};
  differences.forEach(diff => {
    categoryCounts[diff.category] = (categoryCounts[diff.category] || 0) + 1;
  });
  
  // Identify likely root cause
  const highSeverityDiffs = differences.filter(d => d.severity === 'high');
  
  if (highSeverityDiffs.length > 0) {
    const mostCommonCategory = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])[0][0];
    
    analysis.likelyRootCause = mostCommonCategory;
    analysis.affectedSubsystems = Object.keys(categoryCounts);
  }
  
  // Generate recommendations
  if (analysis.likelyRootCause === 'auth') {
    analysis.recommendations.push('Check token refresh logic');
    analysis.recommendations.push('Verify auth state synchronization');
  }
  
  if (analysis.likelyRootCause === 'serviceWorker') {
    analysis.recommendations.push('Check service worker update flow');
    analysis.recommendations.push('Verify cache version compatibility');
  }
  
  if (analysis.likelyRootCause === 'cache') {
    analysis.recommendations.push('Check version compatibility');
    analysis.recommendations.push('Consider forcing cache clear');
  }
  
  if (analysis.likelyRootCause === 'network') {
    analysis.recommendations.push('Check offline handling');
    analysis.recommendations.push('Verify network state detection');
  }
  
  return analysis;
}

