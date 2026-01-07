/**
 * Version Check Middleware
 * 
 * Validates frontend version compatibility on protected routes
 * Returns 426 Upgrade Required if frontend is too old
 */

// Minimum compatible frontend version
const MIN_FRONTEND_VERSION = process.env.MIN_FRONTEND_VERSION || '1.0.0';

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

/**
 * Middleware to check frontend version compatibility
 * 
 * Checks X-Frontend-Version header and returns 426 if incompatible
 */
export default function versionCheck(req, res, next) {
  // Skip version check for public routes
  const publicRoutes = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/status',
    '/api/refresh',
    '/api/version',
    '/api/health',
    '/api/status'
  ];
  
  if (publicRoutes.some(route => req.path.startsWith(route))) {
    return next();
  }
  
  // Get frontend version from header
  const frontendVersion = req.header('X-Frontend-Version');
  
  // If no version header, allow request (for backward compatibility)
  // In production, you might want to enforce this
  if (!frontendVersion) {
    return next();
  }
  
  // Compare versions
  const comparison = compareVersions(frontendVersion, MIN_FRONTEND_VERSION);
  
  // If frontend version is too old, return 426 Upgrade Required
  if (comparison < 0) {
    return res.status(426).json({
      message: 'Frontend version is too old. Please update your app.',
      frontendVersion,
      minFrontendVersion: MIN_FRONTEND_VERSION,
      backendVersion: process.env.BUILD_VERSION || '1.0.0'
    });
  }
  
  // Version is compatible, continue
  next();
}
