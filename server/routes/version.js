/**
 * Version endpoint for update detection and PWA safety
 *
 * Features:
 * - Version compatibility checking
 * - PWA kill-switch
 * - Force reload control
 * - Frontend ↔ Backend version pinning
 */

import express from 'express';

const router = express.Router();

// Backend version - UPDATE THIS ON EACH DEPLOY
// Format: YYYY.MM.DD-NNN (e.g., 2026.01.24-001)
const BACKEND_VERSION = process.env.BUILD_VERSION || '2026.02.07-1803';

// Minimum compatible frontend version
// Update this when you make breaking API changes
const MIN_FRONTEND_VERSION = process.env.MIN_FRONTEND_VERSION || '1.0.0';

// Shared PWA control state (can be modified by admin debug endpoints)
export let pwaControlState = {
  pwaEnabled: process.env.PWA_ENABLED !== 'false',
  forceReload: process.env.FORCE_RELOAD === 'true',
  forceReloadTimestamp: null, // Timestamp when force reload was triggered
  maintenanceMessage: process.env.MAINTENANCE_MESSAGE || null
};

// Export function to update PWA control state (used by admin debug routes)
export function updatePWAControlState(newState) {
  pwaControlState = { ...pwaControlState, ...newState };
}

/**
 * Compare semantic versions
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 < part2) return -1;
    if (part1 > part2) return 1;
  }

  return 0;
}

// @route   GET /api/version
// @desc    Get current build version and timestamp
// @access  Public
router.get('/', (req, res) => {
  res.json({
    version: BACKEND_VERSION,
    timestamp: process.env.BUILD_TIME || Date.now(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// @route   GET /api/version/status
// @desc    Get PWA safety status and version compatibility
// @access  Public
router.get('/status', (req, res) => {
  // 🔥 CRITICAL: Auto-expire forceReload after 5 minutes to prevent infinite loops
  // This ensures that if a client reloads, it won't get stuck in a loop
  const now = Date.now();
  const FORCE_RELOAD_EXPIRY = 5 * 60 * 1000; // 5 minutes

  let shouldForceReload = pwaControlState.forceReload;

  if (shouldForceReload && pwaControlState.forceReloadTimestamp) {
    const timeSinceTriggered = now - pwaControlState.forceReloadTimestamp;

    if (timeSinceTriggered > FORCE_RELOAD_EXPIRY) {
      console.log('🔄 [Version] Force reload expired - resetting to false');
      pwaControlState.forceReload = false;
      pwaControlState.forceReloadTimestamp = null;
      shouldForceReload = false;
    }
  }

  res.json({
    pwaEnabled: pwaControlState.pwaEnabled,
    minFrontendVersion: MIN_FRONTEND_VERSION,
    forceReload: shouldForceReload,
    message: pwaControlState.maintenanceMessage,
    backendVersion: BACKEND_VERSION,
    timestamp: now
  });
});

// @route   POST /api/version/check
// @desc    Check if frontend version is compatible with backend
// @access  Public
router.post('/check', (req, res) => {
  const { frontendVersion } = req.body;

  if (!frontendVersion) {
    return res.status(400).json({
      compatible: false,
      message: 'Frontend version is required'
    });
  }

  // Compare versions
  const comparison = compareVersions(frontendVersion, MIN_FRONTEND_VERSION);
  const compatible = comparison >= 0; // Frontend version >= minimum required

  if (!compatible) {
    return res.status(426).json({
      compatible: false,
      message: 'Frontend version is too old. Please update.',
      frontendVersion,
      minFrontendVersion: MIN_FRONTEND_VERSION,
      backendVersion: BACKEND_VERSION
    });
  }

  res.json({
    compatible: true,
    message: 'Frontend version is compatible',
    frontendVersion,
    minFrontendVersion: MIN_FRONTEND_VERSION,
    backendVersion: BACKEND_VERSION
  });
});

export default router;

