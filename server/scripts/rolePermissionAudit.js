/**
 * Role Permission Audit Script
 * Verifies which roles can access which features
 * Reports mismatches between intent and enforcement
 * 
 * Usage:
 *   node server/scripts/rolePermissionAudit.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import * as featureCapability from '../utils/featureCapability.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set');
  process.exit(1);
}

const ROLES = ['super_admin', 'admin', 'moderator', 'user'];

// Feature capability checks (account state based)
const FEATURE_CAPABILITIES = [
  { name: 'post', fn: featureCapability.canPost },
  { name: 'message', fn: featureCapability.canMessage },
  { name: 'upload', fn: featureCapability.canUploadMedia },
  { name: 'reply', fn: featureCapability.canReply },
  { name: 'chat', fn: featureCapability.canChat },
];

// Role-based permissions (admin/moderation features)
const ROLE_PERMISSIONS = [
  { name: 'edit_any_post', check: (user) => ['moderator', 'admin', 'super_admin'].includes(user.role) },
  { name: 'delete_any_post', check: (user) => ['moderator', 'admin', 'super_admin'].includes(user.role) },
  { name: 'view_reports', check: (user) => user.permissions?.canViewReports === true },
  { name: 'resolve_reports', check: (user) => user.permissions?.canResolveReports === true },
  { name: 'manage_users', check: (user) => user.permissions?.canManageUsers === true },
  { name: 'view_analytics', check: (user) => user.permissions?.canViewAnalytics === true },
  { name: 'manage_admins', check: (user) => user.permissions?.canManageAdmins === true },
];

// Expected permissions for each role
const EXPECTED_PERMISSIONS = {
  super_admin: {
    // Feature capabilities (should all be true for active, non-banned users)
    post: true,
    message: true,
    upload: true,
    reply: true,
    chat: true,
    // Role-based permissions
    edit_any_post: true,
    delete_any_post: true,
    view_reports: true,
    resolve_reports: true,
    manage_users: true,
    view_analytics: true,
    manage_admins: true,
  },
  admin: {
    // Feature capabilities
    post: true,
    message: true,
    upload: true,
    reply: true,
    chat: true,
    // Role-based permissions
    edit_any_post: true,
    delete_any_post: true,
    view_reports: true,
    resolve_reports: true,
    manage_users: true,
    view_analytics: true,
    manage_admins: false,
  },
  moderator: {
    // Feature capabilities
    post: true,
    message: true,
    upload: true,
    reply: true,
    chat: true,
    // Role-based permissions
    edit_any_post: true,
    delete_any_post: true,
    view_reports: true,
    resolve_reports: true,
    manage_users: false,
    view_analytics: true,
    manage_admins: false,
  },
  user: {
    // Feature capabilities
    post: true,
    message: true,
    upload: true,
    reply: true,
    chat: true,
    // Role-based permissions
    edit_any_post: false,
    delete_any_post: false,
    view_reports: false,
    resolve_reports: false,
    manage_users: false,
    view_analytics: false,
    manage_admins: false,
  },
};

const createTestUser = async (role) => {
  // Try to find existing user with this role
  let user = await User.findOne({ role, isActive: true, isBanned: false, isDeleted: false });
  
  if (user) {
    return user;
  }

  // Create a test user if none exists
  console.log(`⚠️  No active ${role} user found, creating test user...`);
  
  const testUser = new User({
    username: `test_${role}_${Date.now()}`,
    email: `test_${role}_${Date.now()}@example.com`,
    password: 'TestPassword123!',
    fullName: `Test ${role}`,
    role: role,
    isActive: true,
    isBanned: false,
    isDeleted: false,
    emailVerified: true,
    onboardingCompleted: true,
    ageVerified: true,
    termsAccepted: true,
  });

  // Set permissions based on role
  if (role === 'super_admin') {
    testUser.permissions = {
      canViewReports: true,
      canResolveReports: true,
      canManageUsers: true,
      canViewAnalytics: true,
      canManageAdmins: true,
    };
  } else if (role === 'admin') {
    testUser.permissions = {
      canViewReports: true,
      canResolveReports: true,
      canManageUsers: true,
      canViewAnalytics: true,
      canManageAdmins: false,
    };
  } else if (role === 'moderator') {
    testUser.permissions = {
      canViewReports: true,
      canResolveReports: true,
      canManageUsers: false,
      canViewAnalytics: true,
      canManageAdmins: false,
    };
  } else {
    testUser.permissions = {
      canViewReports: false,
      canResolveReports: false,
      canManageUsers: false,
      canViewAnalytics: false,
      canManageAdmins: false,
    };
  }

  await testUser.save();
  return testUser;
};

const run = async () => {
  console.log('🔐 Role Permission Audit Script');
  console.log('================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to database\n');

  const report = {};
  const mismatches = [];

  for (const role of ROLES) {
    console.log(`🔍 Auditing role: ${role}...`);

    const user = await createTestUser(role);
    report[role] = {
      userId: user._id,
      username: user.username,
      accountState: {
        isActive: user.isActive,
        isDeleted: user.isDeleted,
        isBanned: user.isBanned,
        isSuspended: user.isSuspended,
        emailVerified: user.emailVerified,
        onboardingCompleted: user.onboardingCompleted,
      },
      permissions: {},
    };

    // Check feature capabilities
    for (const feature of FEATURE_CAPABILITIES) {
      const result = feature.fn(user);
      const allowed = result.allowed;
      const expected = EXPECTED_PERMISSIONS[role][feature.name];

      report[role].permissions[feature.name] = {
        allowed,
        expected,
        status: allowed === expected ? 'OK' : 'MISMATCH',
        reasons: result.reasons || [],
        warnings: result.warnings || [],
      };

      if (allowed !== expected) {
        mismatches.push({
          role,
          feature: feature.name,
          allowed,
          expected,
          reasons: result.reasons,
        });
      }
    }

    // Check role-based permissions
    for (const permission of ROLE_PERMISSIONS) {
      const allowed = permission.check(user);
      const expected = EXPECTED_PERMISSIONS[role][permission.name];

      report[role].permissions[permission.name] = {
        allowed,
        expected,
        status: allowed === expected ? 'OK' : 'MISMATCH',
      };

      if (allowed !== expected) {
        mismatches.push({
          role,
          feature: permission.name,
          allowed,
          expected,
        });
      }
    }
  }

  // Print detailed report
  console.log('\n📊 ROLE PERMISSION AUDIT REPORT');
  console.log('================================\n');

  for (const role in report) {
    const roleData = report[role];
    console.log(`\n🔐 Role: ${role.toUpperCase()}`);
    console.log(`   User: ${roleData.username} (${roleData.userId})`);
    console.log(`   Account State:`);
    console.log(`     - Active: ${roleData.accountState.isActive}`);
    console.log(`     - Email Verified: ${roleData.accountState.emailVerified}`);
    console.log(`     - Onboarding Complete: ${roleData.accountState.onboardingCompleted}`);
    console.log(`\n   Permissions:`);

    for (const [permName, permData] of Object.entries(roleData.permissions)) {
      const icon = permData.status === 'OK' ? '✔' : '❌';
      const statusColor = permData.status === 'OK' ? '' : ' [MISMATCH]';

      console.log(`   ${icon} ${permName.padEnd(18)} → allowed: ${String(permData.allowed).padEnd(5)} | expected: ${permData.expected}${statusColor}`);

      if (permData.reasons && permData.reasons.length > 0) {
        console.log(`      Reasons: ${permData.reasons.join(', ')}`);
      }

      if (permData.warnings && permData.warnings.length > 0) {
        console.log(`      Warnings: ${permData.warnings.join(', ')}`);
      }
    }
  }

  // Print summary
  console.log('\n\n📋 SUMMARY');
  console.log('==========');
  console.log(`Total roles audited: ${ROLES.length}`);
  console.log(`Total permissions checked: ${FEATURE_CAPABILITIES.length + ROLE_PERMISSIONS.length}`);
  console.log(`Total checks performed: ${ROLES.length * (FEATURE_CAPABILITIES.length + ROLE_PERMISSIONS.length)}`);
  console.log(`Mismatches found: ${mismatches.length}`);

  if (mismatches.length > 0) {
    console.log('\n⚠️  MISMATCHES DETECTED:');
    console.log('========================');
    mismatches.forEach((mismatch, index) => {
      console.log(`\n${index + 1}. Role: ${mismatch.role} | Feature: ${mismatch.feature}`);
      console.log(`   Allowed: ${mismatch.allowed} | Expected: ${mismatch.expected}`);
      if (mismatch.reasons && mismatch.reasons.length > 0) {
        console.log(`   Reasons: ${mismatch.reasons.join(', ')}`);
      }
    });
  } else {
    console.log('\n✅ All permissions match expected values!');
  }

  await mongoose.disconnect();
  console.log('\n✅ Role audit complete\n');
};

run().catch((err) => {
  console.error('❌ Role audit failed:', err);
  process.exit(1);
});

