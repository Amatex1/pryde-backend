/**
 * User Capability Audit Script
 * Audits all users to identify feature access issues
 * 
 * Usage: node server/scripts/auditUserCapabilities.js
 */

import mongoose from 'mongoose';
import User from '../models/User.js';
import { getUserCapabilities } from '../utils/featureCapability.js';
import config from '../config/config.js';
import logger from '../utils/logger.js';

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('✅ MongoDB connected for audit');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

/**
 * Audit all users and generate capability report
 */
const auditUsers = async () => {
  try {
    console.log('\n🔍 Starting User Capability Audit...\n');

    // Fetch all users (excluding password)
    const users = await User.find({}).select('-password');
    console.log(`📊 Found ${users.length} total users\n`);

    const results = {
      totalUsers: users.length,
      fullyFunctional: [],
      partiallyBlocked: [],
      fullyBlocked: [],
      blockingReasons: {}
    };

    // Audit each user
    for (const user of users) {
      const report = getUserCapabilities(user);
      
      // Count blocked features
      const capabilities = report.capabilities;
      const blockedFeatures = [];
      const allReasons = new Set();

      Object.entries(capabilities).forEach(([feature, result]) => {
        if (!result.allowed) {
          blockedFeatures.push(feature);
          result.reasons.forEach(reason => allReasons.add(reason));
        }
      });

      // Track blocking reasons frequency
      allReasons.forEach(reason => {
        results.blockingReasons[reason] = (results.blockingReasons[reason] || 0) + 1;
      });

      // Categorize user
      const userSummary = {
        userId: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        blockedFeatures,
        blockedReasons: Array.from(allReasons),
        fullReport: report
      };

      if (blockedFeatures.length === 0) {
        results.fullyFunctional.push(userSummary);
      } else if (blockedFeatures.length === Object.keys(capabilities).length) {
        results.fullyBlocked.push(userSummary);
      } else {
        results.partiallyBlocked.push(userSummary);
      }
    }

    return results;
  } catch (error) {
    console.error('❌ Audit error:', error);
    throw error;
  }
};

/**
 * Generate human-readable report
 */
const generateReport = (results) => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('           USER CAPABILITY AUDIT REPORT');
  console.log('═══════════════════════════════════════════════════════\n');

  // Summary statistics
  const totalUsers = results.totalUsers;
  const fullyFunctionalCount = results.fullyFunctional.length;
  const partiallyBlockedCount = results.partiallyBlocked.length;
  const fullyBlockedCount = results.fullyBlocked.length;

  console.log('📊 SUMMARY STATISTICS');
  console.log('─────────────────────────────────────────────────────');
  console.log(`Total Users:           ${totalUsers}`);
  console.log(`Fully Functional:      ${fullyFunctionalCount} (${((fullyFunctionalCount/totalUsers)*100).toFixed(1)}%)`);
  console.log(`Partially Blocked:     ${partiallyBlockedCount} (${((partiallyBlockedCount/totalUsers)*100).toFixed(1)}%)`);
  console.log(`Fully Blocked:         ${fullyBlockedCount} (${((fullyBlockedCount/totalUsers)*100).toFixed(1)}%)`);
  console.log('');

  // Top blocking reasons
  console.log('🚫 TOP BLOCKING REASONS (by frequency)');
  console.log('─────────────────────────────────────────────────────');
  const sortedReasons = Object.entries(results.blockingReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  sortedReasons.forEach(([reason, count]) => {
    console.log(`  ${count.toString().padStart(4)} users: ${reason}`);
  });
  console.log('');

  // Fully blocked users (critical)
  if (fullyBlockedCount > 0) {
    console.log('🔴 FULLY BLOCKED USERS (ALL features disabled)');
    console.log('─────────────────────────────────────────────────────');
    results.fullyBlocked.slice(0, 20).forEach(user => {
      console.log(`  @${user.username} (${user.userId})`);
      console.log(`    Reasons: ${user.blockedReasons.join(', ')}`);
      console.log('');
    });
    if (fullyBlockedCount > 20) {
      console.log(`  ... and ${fullyBlockedCount - 20} more\n`);
    }
  }

  // Partially blocked users
  if (partiallyBlockedCount > 0) {
    console.log('🟡 PARTIALLY BLOCKED USERS (SOME features disabled)');
    console.log('─────────────────────────────────────────────────────');
    results.partiallyBlocked.slice(0, 10).forEach(user => {
      console.log(`  @${user.username} (${user.userId})`);
      console.log(`    Blocked: ${user.blockedFeatures.join(', ')}`);
      console.log(`    Reasons: ${user.blockedReasons.join(', ')}`);
      console.log('');
    });
    if (partiallyBlockedCount > 10) {
      console.log(`  ... and ${partiallyBlockedCount - 10} more\n`);
    }
  }

  console.log('═══════════════════════════════════════════════════════\n');
};

/**
 * Generate suggested fixes for common issues
 */
const generateFixes = (results) => {
  console.log('💡 SUGGESTED FIXES');
  console.log('─────────────────────────────────────────────────────');

  const fixes = [];

  // Deactivated accounts
  const deactivated = results.fullyBlocked.filter(u =>
    u.blockedReasons.includes('Account is deactivated')
  );
  if (deactivated.length > 0) {
    fixes.push({
      issue: 'Deactivated accounts',
      count: deactivated.length,
      fix: 'Set isActive = true',
      users: deactivated.map(u => u.username)
    });
  }

  // Deleted accounts
  const deleted = results.fullyBlocked.filter(u =>
    u.blockedReasons.includes('Account is deleted')
  );
  if (deleted.length > 0) {
    fixes.push({
      issue: 'Deleted accounts',
      count: deleted.length,
      fix: 'These should remain deleted (no action needed)',
      users: deleted.map(u => u.username)
    });
  }

  // Banned accounts
  const banned = results.fullyBlocked.filter(u =>
    u.blockedReasons.includes('Account is banned')
  );
  if (banned.length > 0) {
    fixes.push({
      issue: 'Banned accounts',
      count: banned.length,
      fix: 'Review ban reason, unban if appropriate',
      users: banned.map(u => u.username)
    });
  }

  // Suspended accounts
  const suspended = results.fullyBlocked.filter(u =>
    u.blockedReasons.some(r => r.includes('suspended until'))
  );
  if (suspended.length > 0) {
    fixes.push({
      issue: 'Suspended accounts',
      count: suspended.length,
      fix: 'Wait for suspension to expire or manually unsuspend',
      users: suspended.map(u => u.username)
    });
  }

  // Muted users
  const muted = results.partiallyBlocked.filter(u =>
    u.blockedReasons.some(r => r.includes('muted until'))
  );
  if (muted.length > 0) {
    fixes.push({
      issue: 'Muted users',
      count: muted.length,
      fix: 'Wait for mute to expire or manually unmute',
      users: muted.map(u => u.username)
    });
  }

  fixes.forEach(fix => {
    console.log(`\n  ${fix.issue}: ${fix.count} users`);
    console.log(`  Fix: ${fix.fix}`);
    console.log(`  Users: ${fix.users.slice(0, 5).join(', ')}${fix.users.length > 5 ? '...' : ''}`);
  });

  console.log('\n');
};

/**
 * Main execution
 */
const main = async () => {
  try {
    await connectDB();

    const results = await auditUsers();
    generateReport(results);
    generateFixes(results);

    // Save detailed report to file
    const fs = await import('fs');
    const reportPath = './user-capability-audit-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`📄 Detailed report saved to: ${reportPath}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  }
};

// Run audit
main();


