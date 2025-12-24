/**
 * Full Platform Audit Runner Script
 * Executes comprehensive audit and outputs results
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import runFullAudit from '../audit/fullPlatformAudit.js';
import logger from '../utils/logger.js';

// Get directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Main execution function
 */
async function main() {
  try {
    logger.info('🚀 Starting Full Platform Audit...');
    logger.info('=====================================\n');

    // Connect to MongoDB
    // Support multiple environment variable names
    const mongoURL = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI;

    if (!mongoURL) {
      throw new Error('MongoDB connection string not found. Please set MONGO_URI, MONGO_URL, or MONGODB_URI in .env file');
    }

    logger.info('📡 Connecting to MongoDB...');
    logger.debug(`Using MongoDB: ${mongoURL.substring(0, 30)}...`);

    try {
      await mongoose.connect(mongoURL, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      });
      logger.info('✅ Connected to MongoDB\n');
    } catch (dbError) {
      logger.error('❌ Failed to connect to MongoDB:', dbError.message);
      logger.error('Please check your MongoDB connection string in the .env file');
      logger.error('Make sure your IP address is whitelisted in MongoDB Atlas');
      throw dbError;
    }

    // Run the audit
    const report = await runFullAudit();

    // Output results
    logger.info('\n=====================================');
    logger.info('📊 AUDIT RESULTS');
    logger.info('=====================================\n');

    console.log(JSON.stringify(report, null, 2));

    logger.info('\n=====================================');
    logger.info('📈 SUMMARY');
    logger.info('=====================================');
    logger.info(`Environment: ${report.environment}`);
    logger.info(`Timestamp: ${report.timestamp}`);
    logger.info(`Duration: ${report.duration}ms`);
    logger.info(`Health Score: ${report.summary.healthScore}/100`);
    logger.info(`Total Checks: ${report.summary.total}`);
    logger.info(`✅ Pass: ${report.summary.pass}`);
    logger.info(`⚠️  Warn: ${report.summary.warn}`);
    logger.info(`❌ Fail: ${report.summary.fail}`);

    // Show critical issues
    const criticalIssues = [];
    for (const [auditName, auditReport] of Object.entries(report.audits)) {
      if (auditReport.issues) {
        for (const issue of auditReport.issues) {
          if (issue.severity === 'critical' || issue.severity === 'high') {
            criticalIssues.push({
              audit: auditName,
              ...issue,
            });
          }
        }
      }
    }

    if (criticalIssues.length > 0) {
      logger.info('\n=====================================');
      logger.info('🚨 CRITICAL ISSUES');
      logger.info('=====================================');
      for (const issue of criticalIssues) {
        logger.warn(`[${issue.audit}] ${issue.type}: ${issue.message}`);
      }
    }

    // Disconnect from MongoDB
    await mongoose.disconnect();
    logger.info('\n✅ Audit complete. Database disconnected.');

    // Exit with appropriate code
    if (report.summary.fail > 0) {
      logger.warn('\n⚠️  Audit completed with failures');
      process.exit(1);
    } else if (report.summary.warn > 0) {
      logger.info('\n✅ Audit completed with warnings');
      process.exit(0);
    } else {
      logger.info('\n🎉 Audit completed successfully!');
      process.exit(0);
    }
  } catch (error) {
    logger.error('❌ Audit failed:', error);
    
    // Try to disconnect from MongoDB
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      logger.error('Failed to disconnect from MongoDB:', disconnectError);
    }

    process.exit(1);
  }
}

// Run the script
main();

