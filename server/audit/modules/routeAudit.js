/**
 * Route & Navigation Audit Module
 * Validates routing configuration across frontend and backend
 */

import { FRONTEND_ROUTES, API_ROUTES } from '../../config/routes.js';
import logger from '../../utils/logger.js';

/**
 * Audit route configuration
 * @returns {Object} Audit report
 */
export default async function runRouteAudit() {
  const report = {
    pass: 0,
    warn: 0,
    fail: 0,
    issues: [],
    details: {
      frontendRoutes: FRONTEND_ROUTES.length,
      apiRoutes: API_ROUTES.length,
      protectedRoutes: 0,
      publicRoutes: 0,
      adminRoutes: 0,
    },
  };

  try {
    // Validate frontend routes
    for (const route of FRONTEND_ROUTES) {
      if (!route.path || !route.component) {
        report.fail++;
        report.issues.push({
          type: 'route_misconfigured',
          severity: 'high',
          message: `Frontend route misconfigured: ${route.path || 'unknown'}`,
          route: route,
        });
      } else {
        report.pass++;
        
        // Count route types
        if (route.requiresAuth) {
          report.details.protectedRoutes++;
        } else {
          report.details.publicRoutes++;
        }
        
        if (route.requiresRole) {
          report.details.adminRoutes++;
        }
      }
    }

    // Validate API routes
    for (const route of API_ROUTES) {
      if (!route.path || !route.method) {
        report.fail++;
        report.issues.push({
          type: 'api_route_misconfigured',
          severity: 'high',
          message: `API route misconfigured: ${route.path || 'unknown'}`,
          route: route,
        });
      } else {
        report.pass++;
      }
    }

    // Check for common routing issues
    const duplicatePaths = findDuplicatePaths(FRONTEND_ROUTES);
    if (duplicatePaths.length > 0) {
      report.warn++;
      report.issues.push({
        type: 'duplicate_routes',
        severity: 'medium',
        message: `Found ${duplicatePaths.length} duplicate route paths`,
        paths: duplicatePaths,
      });
    }

    // Check for missing critical routes
    const criticalRoutes = ['/login', '/register', '/feed', '/settings'];
    const missingCritical = criticalRoutes.filter(
      path => !FRONTEND_ROUTES.find(r => r.path === path)
    );
    
    if (missingCritical.length > 0) {
      report.fail++;
      report.issues.push({
        type: 'missing_critical_routes',
        severity: 'critical',
        message: `Missing critical routes: ${missingCritical.join(', ')}`,
        routes: missingCritical,
      });
    }

    logger.debug(`Route audit: ${report.pass} pass, ${report.warn} warn, ${report.fail} fail`);
  } catch (error) {
    logger.error('Route audit error:', error);
    report.fail++;
    report.issues.push({
      type: 'audit_error',
      severity: 'critical',
      message: `Route audit failed: ${error.message}`,
      error: error.stack,
    });
  }

  return report;
}

/**
 * Find duplicate route paths
 * @param {Array} routes - Route array
 * @returns {Array} Duplicate paths
 */
function findDuplicatePaths(routes) {
  const pathCounts = {};
  const duplicates = [];

  for (const route of routes) {
    if (pathCounts[route.path]) {
      if (!duplicates.includes(route.path)) {
        duplicates.push(route.path);
      }
    } else {
      pathCounts[route.path] = 1;
    }
  }

  return duplicates;
}

