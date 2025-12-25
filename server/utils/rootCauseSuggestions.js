/**
 * AI-Assisted Root Cause Suggestions
 * 
 * For each bug cluster:
 * - Feed error timeline, session diffs, recent deploy metadata
 * - Generate probable root cause
 * - Identify affected subsystem (auth, SW, cache, API)
 * - Recommend mitigation
 * 
 * Rules:
 * - Suggestions are advisory only
 * - Human confirmation required
 * - Confidence score attached
 * 
 * Outcome:
 * - Faster diagnosis
 * - Less cognitive load
 * - Fewer blind fixes
 */

/**
 * Analyze error pattern and generate root cause suggestions
 */
export function generateRootCauseSuggestions(cluster, sessionDiffs, deployMetadata = {}) {
  const suggestions = [];
  
  // Analyze error pattern
  const pattern = cluster.pattern;
  const errorCount = cluster.count;
  const timeSpan = cluster.lastSeen - cluster.firstSeen;
  
  // Check for auth-related issues
  if (pattern.authState === 'unauthenticated' || pattern.message?.includes('auth')) {
    suggestions.push({
      rootCause: 'Authentication Failure',
      affectedSubsystem: 'auth',
      confidence: 0.85,
      evidence: [
        `Auth state: ${pattern.authState}`,
        `Error message contains 'auth'`,
        `${errorCount} occurrences`
      ],
      mitigation: [
        'Check token refresh logic',
        'Verify auth state synchronization',
        'Review recent auth-related changes',
        'Check for token expiry issues'
      ],
      priority: 'high'
    });
  }
  
  // Check for service worker issues
  if (pattern.serviceWorkerState === 'error' || pattern.message?.includes('service worker')) {
    suggestions.push({
      rootCause: 'Service Worker Failure',
      affectedSubsystem: 'serviceWorker',
      confidence: 0.80,
      evidence: [
        `SW state: ${pattern.serviceWorkerState}`,
        `Error message contains 'service worker'`,
        `${errorCount} occurrences`
      ],
      mitigation: [
        'Check service worker update flow',
        'Verify cache version compatibility',
        'Review SW registration logic',
        'Consider disabling PWA temporarily'
      ],
      priority: 'high'
    });
  }
  
  // Check for version mismatch issues
  if (sessionDiffs.some(diff => diff.category === 'cache' && diff.field === 'version')) {
    suggestions.push({
      rootCause: 'Version Mismatch',
      affectedSubsystem: 'cache',
      confidence: 0.90,
      evidence: [
        'Cache version differs between failing and healthy sessions',
        `App version: ${pattern.appVersion}`,
        `${errorCount} occurrences`
      ],
      mitigation: [
        'Force cache clear for affected users',
        'Check version compatibility logic',
        'Review recent deployment changes',
        'Consider rolling back to previous version'
      ],
      priority: 'critical'
    });
  }
  
  // Check for network issues
  if (sessionDiffs.some(diff => diff.category === 'network' && diff.field === 'isOnline')) {
    suggestions.push({
      rootCause: 'Network Connectivity Issue',
      affectedSubsystem: 'network',
      confidence: 0.75,
      evidence: [
        'Network state differs between failing and healthy sessions',
        `${errorCount} occurrences`
      ],
      mitigation: [
        'Check offline handling logic',
        'Verify network state detection',
        'Review retry logic for failed requests',
        'Consider showing offline banner'
      ],
      priority: 'medium'
    });
  }
  
  // Check for mutation queue issues
  if (sessionDiffs.some(diff => diff.category === 'mutations' && diff.field === 'failed')) {
    suggestions.push({
      rootCause: 'Mutation Queue Failure',
      affectedSubsystem: 'mutations',
      confidence: 0.70,
      evidence: [
        'Failed mutations detected in failing sessions',
        `${errorCount} occurrences`
      ],
      mitigation: [
        'Check mutation retry logic',
        'Verify optimistic update rollback',
        'Review mutation queue processing',
        'Consider clearing stuck mutations'
      ],
      priority: 'medium'
    });
  }
  
  // Check for route-specific issues
  if (pattern.route && pattern.route !== 'unknown-route') {
    const routeSpecificCount = cluster.errors.filter(e => e.error.route === pattern.route).length;
    const routePercentage = (routeSpecificCount / errorCount) * 100;
    
    if (routePercentage > 80) {
      suggestions.push({
        rootCause: `Route-Specific Issue (${pattern.route})`,
        affectedSubsystem: 'routing',
        confidence: 0.85,
        evidence: [
          `${routePercentage.toFixed(0)}% of errors occur on route: ${pattern.route}`,
          `${errorCount} occurrences`
        ],
        mitigation: [
          `Review code for route: ${pattern.route}`,
          'Check for route-specific data loading issues',
          'Verify route guards and permissions',
          'Review recent changes to this route'
        ],
        priority: 'high'
      });
    }
  }
  
  // Check for deploy correlation
  if (deployMetadata.deployedAt) {
    const timeSinceDeployMS = cluster.firstSeen - deployMetadata.deployedAt;
    const timeSinceDeployMin = timeSinceDeployMS / (1000 * 60);
    
    if (timeSinceDeployMin < 60 && timeSinceDeployMin > 0) {
      suggestions.push({
        rootCause: 'Recent Deployment Issue',
        affectedSubsystem: 'deployment',
        confidence: 0.95,
        evidence: [
          `Error first appeared ${timeSinceDeployMin.toFixed(0)} minutes after deployment`,
          `Deploy version: ${deployMetadata.version}`,
          `${errorCount} occurrences`
        ],
        mitigation: [
          'Review changes in recent deployment',
          'Consider rolling back to previous version',
          'Check deployment logs for errors',
          'Verify all deployment steps completed successfully'
        ],
        priority: 'critical'
      });
    }
  }
  
  // Sort by confidence (highest first)
  suggestions.sort((a, b) => b.confidence - a.confidence);
  
  return suggestions;
}

/**
 * Format suggestions for display
 */
export function formatSuggestions(suggestions) {
  return suggestions.map((suggestion, index) => ({
    rank: index + 1,
    ...suggestion,
    confidencePercent: `${(suggestion.confidence * 100).toFixed(0)}%`
  }));
}

