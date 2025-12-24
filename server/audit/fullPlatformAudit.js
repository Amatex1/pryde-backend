/**
 * Full Platform Audit Orchestrator
 * Coordinates all audit modules and generates comprehensive report
 */

import runRouteAudit from './modules/routeAudit.js';
import runFeatureAudit from './modules/featureAudit.js';
import runPermissionAudit from './modules/permissionAudit.js';
import runSecurityAudit from './modules/securityAudit.js';
import runNotificationAudit from './modules/notificationAudit.js';
import runLifecycleAudit from './modules/lifecycleAudit.js';
import runNetworkAudit from './modules/networkAudit.js';
import runUiAudit from './modules/uiAudit.js';
import runUpdateAudit from './modules/updateAudit.js';
import logger from '../utils/logger.js';

/**
 * Run full platform audit across all modules
 * @returns {Object} Comprehensive audit report
 */
export default async function runFullAudit() {
  const startTime = Date.now();
  
  logger.info('🔍 Starting full platform audit...');
  
  const results = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    audits: {},
    summary: {
      pass: 0,
      warn: 0,
      fail: 0,
      total: 0,
    },
    duration: 0,
  };

  const audits = [
    ['routes', runRouteAudit],
    ['features', runFeatureAudit],
    ['permissions', runPermissionAudit],
    ['security', runSecurityAudit],
    ['notifications', runNotificationAudit],
    ['lifecycle', runLifecycleAudit],
    ['network', runNetworkAudit],
    ['ui', runUiAudit],
    ['updates', runUpdateAudit],
  ];

  for (const [key, fn] of audits) {
    try {
      logger.info(`  Running ${key} audit...`);
      const report = await fn();
      results.audits[key] = report;
      results.summary.pass += report.pass || 0;
      results.summary.warn += report.warn || 0;
      results.summary.fail += report.fail || 0;
      results.summary.total += (report.pass || 0) + (report.warn || 0) + (report.fail || 0);
      
      logger.info(`  ✓ ${key} audit complete: ${report.pass} pass, ${report.warn} warn, ${report.fail} fail`);
    } catch (error) {
      logger.error(`  ✗ ${key} audit failed:`, error);
      results.audits[key] = {
        pass: 0,
        warn: 0,
        fail: 1,
        issues: [{
          type: 'audit_error',
          message: `Audit module failed: ${error.message}`,
          error: error.stack,
        }],
      };
      results.summary.fail += 1;
      results.summary.total += 1;
    }
  }

  results.duration = Date.now() - startTime;
  
  // Calculate health score (0-100)
  const totalChecks = results.summary.total;
  if (totalChecks > 0) {
    results.summary.healthScore = Math.round(
      ((results.summary.pass + (results.summary.warn * 0.5)) / totalChecks) * 100
    );
  } else {
    results.summary.healthScore = 0;
  }
  
  logger.info(`🎉 Full platform audit complete in ${results.duration}ms`);
  logger.info(`   Health Score: ${results.summary.healthScore}/100`);
  logger.info(`   Pass: ${results.summary.pass}, Warn: ${results.summary.warn}, Fail: ${results.summary.fail}`);

  return results;
}

