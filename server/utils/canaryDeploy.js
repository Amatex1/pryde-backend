/**
 * Canary PWA Deploys (Staged Rollout)
 * 
 * Deploy rollout strategy:
 * - Canary (small % of users)
 * - Stable (full rollout)
 * 
 * Rules:
 * - New PWA versions initially served to canary cohort
 * - Telemetry monitored:
 *   - auth success rate
 *   - error clusters
 *   - SW update failures
 *   - Safe Mode activations
 * - If thresholds exceeded:
 *   - halt rollout
 *   - auto-rollback
 *   - disable PWA for affected version
 * 
 * Outcome:
 * - Bad releases affect few users
 * - Problems detected before mass impact
 * - Deploy confidence increases dramatically
 */

// Deploy phases
export const DeployPhase = {
  CANARY: 'canary',
  STABLE: 'stable',
  ROLLBACK: 'rollback'
};

// Canary configuration
const CANARY_CONFIG = {
  PERCENTAGE: 10, // 10% of users in canary
  MIN_SAMPLE_SIZE: 50, // Minimum users before evaluation
  EVALUATION_WINDOW: 5 * 60 * 1000, // 5 minutes
  THRESHOLDS: {
    AUTH_SUCCESS_RATE: 0.90, // 90% auth success
    ERROR_CLUSTER_SIZE: 10, // Max 10 errors in same cluster
    SW_UPDATE_SUCCESS_RATE: 0.85, // 85% SW update success
    SAFE_MODE_ACTIVATION_RATE: 0.05 // Max 5% Safe Mode activations
  }
};

// Active deploys
const activeDeploys = new Map();

/**
 * Deploy version metadata
 */
class DeployVersion {
  constructor(version, phase = DeployPhase.CANARY) {
    this.version = version;
    this.phase = phase;
    this.startTime = Date.now();
    this.metrics = {
      totalUsers: 0,
      authAttempts: 0,
      authSuccesses: 0,
      errorClusters: new Map(),
      swUpdateAttempts: 0,
      swUpdateSuccesses: 0,
      safeModeActivations: 0
    };
    this.status = 'active';
    this.rollbackReason = null;
  }
  
  /**
   * Calculate auth success rate
   */
  getAuthSuccessRate() {
    if (this.metrics.authAttempts === 0) return 1.0;
    return this.metrics.authSuccesses / this.metrics.authAttempts;
  }
  
  /**
   * Calculate SW update success rate
   */
  getSWUpdateSuccessRate() {
    if (this.metrics.swUpdateAttempts === 0) return 1.0;
    return this.metrics.swUpdateSuccesses / this.metrics.swUpdateAttempts;
  }
  
  /**
   * Calculate Safe Mode activation rate
   */
  getSafeModeActivationRate() {
    if (this.metrics.totalUsers === 0) return 0;
    return this.metrics.safeModeActivations / this.metrics.totalUsers;
  }
  
  /**
   * Get largest error cluster size
   */
  getLargestErrorClusterSize() {
    if (this.metrics.errorClusters.size === 0) return 0;
    return Math.max(...this.metrics.errorClusters.values());
  }
  
  /**
   * Check if deploy is healthy
   */
  isHealthy() {
    const authRate = this.getAuthSuccessRate();
    const swRate = this.getSWUpdateSuccessRate();
    const safeModeRate = this.getSafeModeActivationRate();
    const clusterSize = this.getLargestErrorClusterSize();
    
    return (
      authRate >= CANARY_CONFIG.THRESHOLDS.AUTH_SUCCESS_RATE &&
      swRate >= CANARY_CONFIG.THRESHOLDS.SW_UPDATE_SUCCESS_RATE &&
      safeModeRate <= CANARY_CONFIG.THRESHOLDS.SAFE_MODE_ACTIVATION_RATE &&
      clusterSize < CANARY_CONFIG.THRESHOLDS.ERROR_CLUSTER_SIZE
    );
  }
  
  /**
   * Get health report
   */
  getHealthReport() {
    return {
      version: this.version,
      phase: this.phase,
      status: this.status,
      healthy: this.isHealthy(),
      metrics: {
        totalUsers: this.metrics.totalUsers,
        authSuccessRate: (this.getAuthSuccessRate() * 100).toFixed(2) + '%',
        swUpdateSuccessRate: (this.getSWUpdateSuccessRate() * 100).toFixed(2) + '%',
        safeModeActivationRate: (this.getSafeModeActivationRate() * 100).toFixed(2) + '%',
        largestErrorCluster: this.getLargestErrorClusterSize()
      },
      thresholds: {
        authSuccessRate: (CANARY_CONFIG.THRESHOLDS.AUTH_SUCCESS_RATE * 100) + '%',
        swUpdateSuccessRate: (CANARY_CONFIG.THRESHOLDS.SW_UPDATE_SUCCESS_RATE * 100) + '%',
        safeModeActivationRate: (CANARY_CONFIG.THRESHOLDS.SAFE_MODE_ACTIVATION_RATE * 100) + '%',
        errorClusterSize: CANARY_CONFIG.THRESHOLDS.ERROR_CLUSTER_SIZE
      },
      rollbackReason: this.rollbackReason,
      uptime: Date.now() - this.startTime
    };
  }
}

/**
 * Register new deploy
 */
export function registerDeploy(version, phase = DeployPhase.CANARY) {
  const deploy = new DeployVersion(version, phase);
  activeDeploys.set(version, deploy);
  
  console.log(`[Canary Deploy] 🚀 Registered ${phase} deploy: ${version}`);
  
  return deploy;
}

/**
 * Get deploy for version
 */
export function getDeploy(version) {
  return activeDeploys.get(version);
}

/**
 * Determine if user should get canary version
 */
export function isCanaryUser(userId) {
  // Simple hash-based assignment for consistent cohort
  const hash = hashString(userId);
  return (hash % 100) < CANARY_CONFIG.PERCENTAGE;
}

/**
 * Simple string hash function
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Track user on version
 */
export function trackUserOnVersion(version, userId) {
  const deploy = getDeploy(version);
  if (!deploy) {
    console.warn(`[Canary Deploy] Unknown version: ${version}`);
    return;
  }

  deploy.metrics.totalUsers++;
}

/**
 * Track auth attempt
 */
export function trackAuthAttempt(version, success) {
  const deploy = getDeploy(version);
  if (!deploy) return;

  deploy.metrics.authAttempts++;
  if (success) {
    deploy.metrics.authSuccesses++;
  }

  evaluateDeployHealth(deploy);
}

/**
 * Track SW update
 */
export function trackSWUpdate(version, success) {
  const deploy = getDeploy(version);
  if (!deploy) return;

  deploy.metrics.swUpdateAttempts++;
  if (success) {
    deploy.metrics.swUpdateSuccesses++;
  }

  evaluateDeployHealth(deploy);
}

/**
 * Track error cluster
 */
export function trackErrorCluster(version, clusterId) {
  const deploy = getDeploy(version);
  if (!deploy) return;

  const count = (deploy.metrics.errorClusters.get(clusterId) || 0) + 1;
  deploy.metrics.errorClusters.set(clusterId, count);

  evaluateDeployHealth(deploy);
}

/**
 * Track Safe Mode activation
 */
export function trackSafeModeActivation(version) {
  const deploy = getDeploy(version);
  if (!deploy) return;

  deploy.metrics.safeModeActivations++;

  evaluateDeployHealth(deploy);
}

/**
 * Evaluate deploy health and trigger rollback if needed
 */
function evaluateDeployHealth(deploy) {
  // Only evaluate canary deploys
  if (deploy.phase !== DeployPhase.CANARY) return;

  // Check if we have enough data
  if (deploy.metrics.totalUsers < CANARY_CONFIG.MIN_SAMPLE_SIZE) {
    return;
  }

  // Check if deploy is healthy
  if (!deploy.isHealthy()) {
    triggerRollback(deploy);
  }
}

/**
 * Trigger rollback for deploy
 */
function triggerRollback(deploy) {
  if (deploy.status === 'rolled_back') {
    return; // Already rolled back
  }

  deploy.status = 'rolled_back';
  deploy.phase = DeployPhase.ROLLBACK;

  // Determine rollback reason
  const reasons = [];

  if (deploy.getAuthSuccessRate() < CANARY_CONFIG.THRESHOLDS.AUTH_SUCCESS_RATE) {
    reasons.push(`Auth success rate too low: ${(deploy.getAuthSuccessRate() * 100).toFixed(2)}%`);
  }

  if (deploy.getSWUpdateSuccessRate() < CANARY_CONFIG.THRESHOLDS.SW_UPDATE_SUCCESS_RATE) {
    reasons.push(`SW update success rate too low: ${(deploy.getSWUpdateSuccessRate() * 100).toFixed(2)}%`);
  }

  if (deploy.getSafeModeActivationRate() > CANARY_CONFIG.THRESHOLDS.SAFE_MODE_ACTIVATION_RATE) {
    reasons.push(`Safe Mode activation rate too high: ${(deploy.getSafeModeActivationRate() * 100).toFixed(2)}%`);
  }

  if (deploy.getLargestErrorClusterSize() >= CANARY_CONFIG.THRESHOLDS.ERROR_CLUSTER_SIZE) {
    reasons.push(`Error cluster too large: ${deploy.getLargestErrorClusterSize()} errors`);
  }

  deploy.rollbackReason = reasons.join('; ');

  console.log(`[Canary Deploy] 🚨 ROLLBACK TRIGGERED for ${deploy.version}`);
  console.log(`[Canary Deploy] Reason: ${deploy.rollbackReason}`);

  // TODO: Notify admins
  // TODO: Disable PWA for this version
  // TODO: Force clients to reload to stable version
}

/**
 * Promote canary to stable
 */
export function promoteToStable(version) {
  const deploy = getDeploy(version);
  if (!deploy) {
    throw new Error(`Deploy not found: ${version}`);
  }

  if (deploy.phase !== DeployPhase.CANARY) {
    throw new Error(`Deploy is not in canary phase: ${version}`);
  }

  if (!deploy.isHealthy()) {
    throw new Error(`Deploy is not healthy: ${version}`);
  }

  deploy.phase = DeployPhase.STABLE;

  console.log(`[Canary Deploy] ✅ Promoted to stable: ${version}`);

  return deploy;
}

/**
 * Get all active deploys
 */
export function getAllDeploys() {
  return Array.from(activeDeploys.values()).map(deploy => deploy.getHealthReport());
}

/**
 * Get canary configuration
 */
export function getCanaryConfig() {
  return CANARY_CONFIG;
}

