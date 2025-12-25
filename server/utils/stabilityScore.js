/**
 * User-Facing Stability Score (Transparency)
 * 
 * Per-user Stability Score (0–100):
 * 
 * Inputs:
 * - Error frequency
 * - Safe Mode activations
 * - Offline recoveries
 * - Successful mutations
 * - Auth stability
 * 
 * Display:
 * - Subtle indicator in settings / profile
 * - Friendly language:
 *   "Stability: Excellent / Good / Needs Attention"
 * 
 * Rules:
 * - Never shames users
 * - Informational only
 * - Helps users understand odd behavior
 * 
 * Outcome:
 * - Users feel informed, not confused
 * - Support conversations become easier
 * - Trust increases
 */

// Stability levels
export const StabilityLevel = {
  EXCELLENT: 'excellent',
  GOOD: 'good',
  FAIR: 'fair',
  NEEDS_ATTENTION: 'needs_attention'
};

// Scoring weights
const WEIGHTS = {
  ERROR_FREQUENCY: 0.30,
  SAFE_MODE_ACTIVATIONS: 0.25,
  OFFLINE_RECOVERIES: 0.15,
  SUCCESSFUL_MUTATIONS: 0.20,
  AUTH_STABILITY: 0.10
};

// User stability metrics
const userMetrics = new Map();

/**
 * Get or create user metrics
 */
function getUserMetrics(userId) {
  if (!userMetrics.has(userId)) {
    userMetrics.set(userId, {
      errors: 0,
      safeModeActivations: 0,
      offlineRecoveries: 0,
      successfulMutations: 0,
      failedMutations: 0,
      authAttempts: 0,
      authSuccesses: 0,
      lastUpdated: Date.now()
    });
  }
  
  return userMetrics.get(userId);
}

/**
 * Track error
 */
export function trackError(userId) {
  const metrics = getUserMetrics(userId);
  metrics.errors++;
  metrics.lastUpdated = Date.now();
}

/**
 * Track Safe Mode activation
 */
export function trackSafeModeActivation(userId) {
  const metrics = getUserMetrics(userId);
  metrics.safeModeActivations++;
  metrics.lastUpdated = Date.now();
}

/**
 * Track offline recovery
 */
export function trackOfflineRecovery(userId) {
  const metrics = getUserMetrics(userId);
  metrics.offlineRecoveries++;
  metrics.lastUpdated = Date.now();
}

/**
 * Track mutation
 */
export function trackMutation(userId, success) {
  const metrics = getUserMetrics(userId);
  
  if (success) {
    metrics.successfulMutations++;
  } else {
    metrics.failedMutations++;
  }
  
  metrics.lastUpdated = Date.now();
}

/**
 * Track auth attempt
 */
export function trackAuthAttempt(userId, success) {
  const metrics = getUserMetrics(userId);
  
  metrics.authAttempts++;
  if (success) {
    metrics.authSuccesses++;
  }
  
  metrics.lastUpdated = Date.now();
}

/**
 * Calculate stability score (0-100)
 */
export function calculateStabilityScore(userId) {
  const metrics = getUserMetrics(userId);
  
  // Calculate component scores (0-100)
  const errorScore = calculateErrorScore(metrics);
  const safeModeScore = calculateSafeModeScore(metrics);
  const offlineScore = calculateOfflineScore(metrics);
  const mutationScore = calculateMutationScore(metrics);
  const authScore = calculateAuthScore(metrics);
  
  // Weighted average
  const totalScore = 
    errorScore * WEIGHTS.ERROR_FREQUENCY +
    safeModeScore * WEIGHTS.SAFE_MODE_ACTIVATIONS +
    offlineScore * WEIGHTS.OFFLINE_RECOVERIES +
    mutationScore * WEIGHTS.SUCCESSFUL_MUTATIONS +
    authScore * WEIGHTS.AUTH_STABILITY;
  
  return Math.round(totalScore);
}

/**
 * Calculate error score
 */
function calculateErrorScore(metrics) {
  // Fewer errors = higher score
  // 0 errors = 100, 10+ errors = 0
  const errorCount = metrics.errors;
  
  if (errorCount === 0) return 100;
  if (errorCount >= 10) return 0;
  
  return 100 - (errorCount * 10);
}

/**
 * Calculate Safe Mode score
 */
function calculateSafeModeScore(metrics) {
  // No Safe Mode activations = 100
  // 1+ activations = 0
  return metrics.safeModeActivations === 0 ? 100 : 0;
}

/**
 * Calculate offline score
 */
function calculateOfflineScore(metrics) {
  // More recoveries = higher score (resilience)
  // 0 recoveries = 50 (neutral)
  // 5+ recoveries = 100
  const recoveries = metrics.offlineRecoveries;
  
  if (recoveries === 0) return 50;
  if (recoveries >= 5) return 100;
  
  return 50 + (recoveries * 10);
}

/**
 * Calculate mutation score
 */
function calculateMutationScore(metrics) {
  const total = metrics.successfulMutations + metrics.failedMutations;
  
  if (total === 0) return 100; // No mutations = perfect
  
  const successRate = metrics.successfulMutations / total;
  return Math.round(successRate * 100);
}

/**
 * Calculate auth score
 */
function calculateAuthScore(metrics) {
  if (metrics.authAttempts === 0) return 100; // No attempts = perfect
  
  const successRate = metrics.authSuccesses / metrics.authAttempts;
  return Math.round(successRate * 100);
}

/**
 * Get stability level from score
 */
export function getStabilityLevel(score) {
  if (score >= 90) return StabilityLevel.EXCELLENT;
  if (score >= 70) return StabilityLevel.GOOD;
  if (score >= 50) return StabilityLevel.FAIR;
  return StabilityLevel.NEEDS_ATTENTION;
}

/**
 * Get friendly stability message
 */
export function getStabilityMessage(level) {
  switch (level) {
    case StabilityLevel.EXCELLENT:
      return 'Your app is running smoothly!';
    case StabilityLevel.GOOD:
      return 'Your app is performing well.';
    case StabilityLevel.FAIR:
      return 'Your app is mostly stable.';
    case StabilityLevel.NEEDS_ATTENTION:
      return 'We\'re working to improve your experience.';
    default:
      return 'Stability information unavailable.';
  }
}

/**
 * Get user stability report
 */
export function getUserStabilityReport(userId) {
  const metrics = getUserMetrics(userId);
  const score = calculateStabilityScore(userId);
  const level = getStabilityLevel(score);
  const message = getStabilityMessage(level);

  return {
    userId,
    score,
    level,
    message,
    metrics: {
      errors: metrics.errors,
      safeModeActivations: metrics.safeModeActivations,
      offlineRecoveries: metrics.offlineRecoveries,
      successfulMutations: metrics.successfulMutations,
      failedMutations: metrics.failedMutations,
      mutationSuccessRate: metrics.successfulMutations + metrics.failedMutations > 0
        ? ((metrics.successfulMutations / (metrics.successfulMutations + metrics.failedMutations)) * 100).toFixed(2) + '%'
        : 'N/A',
      authAttempts: metrics.authAttempts,
      authSuccesses: metrics.authSuccesses,
      authSuccessRate: metrics.authAttempts > 0
        ? ((metrics.authSuccesses / metrics.authAttempts) * 100).toFixed(2) + '%'
        : 'N/A'
    },
    lastUpdated: metrics.lastUpdated
  };
}

/**
 * Reset user metrics
 */
export function resetUserMetrics(userId) {
  userMetrics.delete(userId);
  console.log(`[Stability Score] ${userId}: Metrics reset`);
}

/**
 * Get all user stability reports
 */
export function getAllUserStabilityReports() {
  return Array.from(userMetrics.keys()).map(userId =>
    getUserStabilityReport(userId)
  );
}

/**
 * Get stability summary
 */
export function getStabilitySummary() {
  const reports = getAllUserStabilityReports();

  const excellent = reports.filter(r => r.level === StabilityLevel.EXCELLENT).length;
  const good = reports.filter(r => r.level === StabilityLevel.GOOD).length;
  const fair = reports.filter(r => r.level === StabilityLevel.FAIR).length;
  const needsAttention = reports.filter(r => r.level === StabilityLevel.NEEDS_ATTENTION).length;

  const avgScore = reports.length > 0
    ? reports.reduce((sum, r) => sum + r.score, 0) / reports.length
    : 0;

  return {
    totalUsers: reports.length,
    averageScore: Math.round(avgScore),
    distribution: {
      excellent,
      good,
      fair,
      needsAttention
    },
    percentages: {
      excellent: reports.length > 0 ? ((excellent / reports.length) * 100).toFixed(2) + '%' : '0%',
      good: reports.length > 0 ? ((good / reports.length) * 100).toFixed(2) + '%' : '0%',
      fair: reports.length > 0 ? ((fair / reports.length) * 100).toFixed(2) + '%' : '0%',
      needsAttention: reports.length > 0 ? ((needsAttention / reports.length) * 100).toFixed(2) + '%' : '0%'
    }
  };
}

