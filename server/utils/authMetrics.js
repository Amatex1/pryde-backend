/**
 * Phase 4A: Lightweight Auth Observability
 * 
 * In-memory counters and structured logging for auth health.
 * No PII, no tokens logged. JSON-friendly structured output.
 * 
 * Counters are reset on server restart (intentional - we want recent data only).
 */

import logger from './logger.js';

// ─────────────────────────────────────────────────────────────────────────────
// AUTH METRICS COUNTERS (in-memory)
// ─────────────────────────────────────────────────────────────────────────────

const counters = {
  'auth.refresh.success': 0,
  'auth.refresh.failure': 0,
  'auth.refresh.token_reuse': 0,
  'auth.session.revoked_access': 0,
  'auth.session.expired': 0,
  'auth.session.not_found': 0,
  'auth.circuit_breaker.trips': 0,
  'auth.login.success': 0,
  'auth.login.failure': 0,
  'auth.logout': 0,
};

// Window tracking for rate detection
const failureWindow = {
  timestamps: [],
  windowMs: 60000, // 1 minute
  threshold: 10, // Alert if >10 failures in 1 minute
};

// ─────────────────────────────────────────────────────────────────────────────
// COUNTER OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Increment a counter
 * @param {string} metric - Metric name
 * @param {number} value - Value to add (default: 1)
 */
export function incCounter(metric, value = 1) {
  if (counters.hasOwnProperty(metric)) {
    counters[metric] += value;
  }
}

/**
 * Get current counter values
 * @returns {Object} All counter values
 */
export function getCounters() {
  return { ...counters };
}

/**
 * Get a single counter value
 * @param {string} metric - Metric name
 * @returns {number} Counter value
 */
export function getCounter(metric) {
  return counters[metric] || 0;
}

/**
 * Reset all counters (for testing)
 */
export function resetCounters() {
  Object.keys(counters).forEach(key => counters[key] = 0);
  failureWindow.timestamps = [];
}

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURED LOGGING EVENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Log refresh token verification failure
 * @param {Object} context - { userId, sessionId, reason }
 */
export function logRefreshFailure({ userId, sessionId, reason }) {
  incCounter('auth.refresh.failure');
  trackFailureRate();
  
  logger.warn(JSON.stringify({
    event: 'auth.refresh.failure',
    userId: userId ? userId.toString().slice(-6) : 'unknown', // Last 6 chars only
    sessionId: sessionId ? sessionId.slice(-8) : 'unknown', // Last 8 chars only
    reason,
    timestamp: new Date().toISOString()
  }));
}

/**
 * Log refresh token reuse attempt (potential replay attack)
 * @param {Object} context - { userId, sessionId }
 */
export function logTokenReuse({ userId, sessionId }) {
  incCounter('auth.refresh.token_reuse');
  
  logger.warn(JSON.stringify({
    event: 'auth.refresh.token_reuse',
    userId: userId ? userId.toString().slice(-6) : 'unknown',
    sessionId: sessionId ? sessionId.slice(-8) : 'unknown',
    severity: 'high',
    timestamp: new Date().toISOString()
  }));
}

/**
 * Log revoked session access attempt
 * @param {Object} context - { userId, sessionId }
 */
export function logRevokedSessionAccess({ userId, sessionId }) {
  incCounter('auth.session.revoked_access');
  
  logger.warn(JSON.stringify({
    event: 'auth.session.revoked_access',
    userId: userId ? userId.toString().slice(-6) : 'unknown',
    sessionId: sessionId ? sessionId.slice(-8) : 'unknown',
    severity: 'medium',
    timestamp: new Date().toISOString()
  }));
}

/**
 * Log circuit breaker activation
 * @param {Object} context - { reason, failureCount }
 */
export function logCircuitBreakerTrip({ reason, failureCount }) {
  incCounter('auth.circuit_breaker.trips');
  
  logger.error(JSON.stringify({
    event: 'auth.circuit_breaker.trip',
    reason,
    failureCount,
    severity: 'critical',
    timestamp: new Date().toISOString()
  }));
}

/**
 * Track failure rate and alert if threshold exceeded
 */
function trackFailureRate() {
  const now = Date.now();
  failureWindow.timestamps.push(now);
  
  // Clean old entries
  failureWindow.timestamps = failureWindow.timestamps.filter(
    t => now - t < failureWindow.windowMs
  );
  
  // Alert if threshold exceeded
  if (failureWindow.timestamps.length >= failureWindow.threshold) {
    logger.error(JSON.stringify({
      event: 'auth.failure_rate.exceeded',
      failuresInWindow: failureWindow.timestamps.length,
      windowMs: failureWindow.windowMs,
      threshold: failureWindow.threshold,
      severity: 'critical',
      timestamp: new Date().toISOString()
    }));
  }
}

export default {
  incCounter,
  getCounters,
  getCounter,
  resetCounters,
  logRefreshFailure,
  logTokenReuse,
  logRevokedSessionAccess,
  logCircuitBreakerTrip
};

