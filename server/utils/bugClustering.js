/**
 * Bug Clustering System
 * 
 * Automatically groups errors by:
 * - Error signature (message + stack trace pattern)
 * - Route
 * - App version
 * - Service worker state
 * - Auth state
 * 
 * Detects recurring patterns automatically
 * Assigns cluster IDs
 * 
 * Outcome:
 * - 100 similar bugs become 1 actionable issue
 * - No manual log spelunking
 */

import crypto from 'crypto';

// In-memory cluster storage
const errorClusters = new Map();

// Cluster retention time (24 hours)
const CLUSTER_RETENTION_MS = 24 * 60 * 60 * 1000;

// Cleanup interval (1 hour)
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Generate error signature from error details
 */
function generateErrorSignature(error) {
  const {
    message,
    stack,
    route,
    appVersion,
    serviceWorkerState,
    authState
  } = error;
  
  // Extract stack trace pattern (remove line numbers and file paths)
  const stackPattern = stack
    ? stack
        .split('\n')
        .slice(0, 3) // First 3 lines
        .map(line => line.replace(/:\d+:\d+/g, ':*:*')) // Remove line:col
        .map(line => line.replace(/\/[^/]+\.js/g, '/*.js')) // Remove file names
        .join('|')
    : 'no-stack';
  
  // Create signature components
  const components = [
    message || 'unknown-error',
    stackPattern,
    route || 'unknown-route',
    appVersion || 'unknown-version',
    serviceWorkerState || 'unknown-sw',
    authState || 'unknown-auth'
  ];
  
  // Generate hash
  const signature = crypto
    .createHash('sha256')
    .update(components.join('::'))
    .digest('hex')
    .substring(0, 16);
  
  return signature;
}

/**
 * Add error to cluster
 */
export function clusterError(errorData) {
  const signature = generateErrorSignature(errorData);
  
  // Get or create cluster
  if (!errorClusters.has(signature)) {
    errorClusters.set(signature, {
      clusterId: signature,
      signature,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      count: 0,
      errors: [],
      pattern: {
        message: errorData.message,
        route: errorData.route,
        appVersion: errorData.appVersion,
        serviceWorkerState: errorData.serviceWorkerState,
        authState: errorData.authState
      }
    });
    
    console.log(`[Bug Clustering] 🆕 New cluster created: ${signature}`);
  }
  
  const cluster = errorClusters.get(signature);
  
  // Add error to cluster
  cluster.errors.push({
    timestamp: Date.now(),
    sessionId: errorData.sessionId,
    userId: errorData.userId,
    error: errorData
  });
  
  // Update cluster metadata
  cluster.count++;
  cluster.lastSeen = Date.now();
  
  // Keep only last 100 errors per cluster
  if (cluster.errors.length > 100) {
    cluster.errors.shift();
  }
  
  console.log(`[Bug Clustering] 📊 Cluster ${signature}: ${cluster.count} occurrences`);
  
  return {
    clusterId: signature,
    clusterCount: cluster.count,
    isRecurring: cluster.count > 1
  };
}

/**
 * Get cluster by ID
 */
export function getCluster(clusterId) {
  return errorClusters.get(clusterId);
}

/**
 * Get all clusters
 */
export function getAllClusters() {
  return Array.from(errorClusters.values());
}

/**
 * Get clusters sorted by count (most frequent first)
 */
export function getClustersByFrequency() {
  return Array.from(errorClusters.values())
    .sort((a, b) => b.count - a.count);
}

/**
 * Get clusters for a specific version
 */
export function getClustersByVersion(appVersion) {
  return Array.from(errorClusters.values())
    .filter(cluster => cluster.pattern.appVersion === appVersion);
}

/**
 * Get clusters for a specific route
 */
export function getClustersByRoute(route) {
  return Array.from(errorClusters.values())
    .filter(cluster => cluster.pattern.route === route);
}

/**
 * Get recurring clusters (count > threshold)
 */
export function getRecurringClusters(threshold = 5) {
  return Array.from(errorClusters.values())
    .filter(cluster => cluster.count >= threshold)
    .sort((a, b) => b.count - a.count);
}

/**
 * Get cluster summary
 */
export function getClusterSummary() {
  const clusters = Array.from(errorClusters.values());
  
  return {
    totalClusters: clusters.length,
    totalErrors: clusters.reduce((sum, cluster) => sum + cluster.count, 0),
    recurringClusters: clusters.filter(c => c.count > 1).length,
    topClusters: clusters
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(cluster => ({
        clusterId: cluster.clusterId,
        count: cluster.count,
        pattern: cluster.pattern,
        firstSeen: cluster.firstSeen,
        lastSeen: cluster.lastSeen
      }))
  };
}

/**
 * Clear cluster
 */
export function clearCluster(clusterId) {
  const deleted = errorClusters.delete(clusterId);
  
  if (deleted) {
    console.log(`[Bug Clustering] 🗑️ Cluster ${clusterId} cleared`);
  }
  
  return deleted;
}

/**
 * Cleanup old clusters
 */
function cleanupOldClusters() {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [clusterId, cluster] of errorClusters.entries()) {
    if (now - cluster.lastSeen > CLUSTER_RETENTION_MS) {
      errorClusters.delete(clusterId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`[Bug Clustering] 🗑️ Cleaned up ${cleanedCount} old clusters`);
  }
}

// Start cleanup interval
setInterval(cleanupOldClusters, CLEANUP_INTERVAL_MS);

console.log('[Bug Clustering] 🚀 Bug clustering system initialized');

