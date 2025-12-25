/**
 * Debug Overlay Configuration
 * 
 * Backend support for debug overlay
 * 
 * Enable via:
 * - ?debug=true
 * - Keyboard shortcut (Ctrl+Shift+D, admin only)
 * 
 * Provides:
 * - authReady / authLoading state
 * - service worker state
 * - cache version
 * - mutation queue status
 * - stability score
 * - safe mode status
 */

/**
 * Get debug overlay data for current user
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 * @returns {object} Debug overlay data
 */
export function getDebugOverlayData(userId, sessionId) {
  const { getStabilityScore } = require('./stabilityScore.js');
  const { getSafeModeStatus } = require('./autoSafeMode.js');
  
  const stabilityScore = getStabilityScore(userId);
  const safeModeStatus = getSafeModeStatus(sessionId);
  
  return {
    timestamp: Date.now(),
    userId,
    sessionId,
    stability: stabilityScore,
    safeMode: safeModeStatus,
    backend: {
      version: process.env.BUILD_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime()
    }
  };
}

/**
 * Check if user is allowed to access debug overlay
 * @param {object} user - User object
 * @returns {boolean} True if user can access debug overlay
 */
export function canAccessDebugOverlay(user) {
  if (!user) return false;
  
  // Only admins can access debug overlay
  return ['admin', 'super_admin', 'moderator'].includes(user.role);
}

/**
 * Log debug overlay access
 * @param {string} userId - User ID
 * @param {string} action - Action (open/close)
 */
export function logDebugOverlayAccess(userId, action) {
  console.log(`[Debug Overlay] User ${userId} ${action} debug overlay at ${new Date().toISOString()}`);
}

