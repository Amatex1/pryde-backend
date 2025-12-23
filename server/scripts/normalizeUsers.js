/**
 * One-time user normalization script
 * Brings all user accounts to a known-good baseline
 *
 * SAFE TO RUN MULTIPLE TIMES
 * DOES NOT MODIFY banned/suspended/deleted users
 * 
 * Usage:
 *   node server/scripts/normalizeUsers.js           # Dry run (no changes)
 *   node server/scripts/normalizeUsers.js --apply   # Apply changes
 */

import mongoose from 'mongoose';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const DRY_RUN = !process.argv.includes('--apply');

if (!MONGO_URI) {
  console.error('❌ MONGO_URI not set');
  process.exit(1);
}

const stats = {
  scanned: 0,
  modified: 0,
  skippedBanned: 0,
  skippedSuspended: 0,
  skippedDeleted: 0,
  errors: 0,
  fixes: {
    isActive: 0,
    role: 0,
    onboardingCompleted: 0,
    emailVerified: 0,
    permissions: 0,
    loginAlerts: 0,
    privacySettings: 0,
    moderation: 0,
    arrays: 0,
  },
};

const normalizeUser = (user) => {
  let changed = false;
  const changes = [];

  // 🔒 CRITICAL: Do NOT touch banned, suspended, or deleted users
  if (user.isBanned === true) {
    stats.skippedBanned++;
    return { changed: false, changes: [] };
  }
  
  if (user.isSuspended === true) {
    stats.skippedSuspended++;
    return { changed: false, changes: [] };
  }
  
  if (user.isDeleted === true) {
    stats.skippedDeleted++;
    return { changed: false, changes: [] };
  }

  // ✅ Ensure active state (default: true)
  if (user.isActive === undefined || user.isActive === null) {
    user.isActive = true;
    stats.fixes.isActive++;
    changes.push('isActive → true');
    changed = true;
  }

  // ✅ Ensure role (default: 'user')
  if (!user.role || !['user', 'moderator', 'admin', 'super_admin'].includes(user.role)) {
    user.role = 'user';
    stats.fixes.role++;
    changes.push('role → user');
    changed = true;
  }

  // ✅ Ensure permissions object exists for all users
  if (!user.permissions || typeof user.permissions !== 'object') {
    user.permissions = {
      canViewReports: false,
      canResolveReports: false,
      canManageUsers: false,
      canViewAnalytics: false,
      canManageAdmins: false
    };
    stats.fixes.permissions++;
    changes.push('permissions → initialized');
    changed = true;
  }

  // ✅ Ensure onboarding completed (default: true for existing users)
  if (user.onboardingCompleted === undefined || user.onboardingCompleted === null) {
    user.onboardingCompleted = true;
    stats.fixes.onboardingCompleted++;
    changes.push('onboardingCompleted → true');
    changed = true;
  }

  // ⚠️ Email verification policy
  // Do NOT auto-verify - only set if undefined
  if (user.emailVerified === undefined || user.emailVerified === null) {
    user.emailVerified = false;
    stats.fixes.emailVerified++;
    changes.push('emailVerified → false');
    changed = true;
  }

  // ✅ Ensure loginAlerts object exists
  if (!user.loginAlerts || typeof user.loginAlerts !== 'object') {
    user.loginAlerts = {
      enabled: true,
      emailOnNewDevice: true,
      emailOnSuspiciousLogin: true
    };
    stats.fixes.loginAlerts++;
    changes.push('loginAlerts → initialized');
    changed = true;
  }

  // ✅ Ensure privacySettings object exists
  if (!user.privacySettings || typeof user.privacySettings !== 'object') {
    user.privacySettings = {
      profileVisibility: 'public',
      isPrivateAccount: false,
      whoCanMessage: 'followers',
      showOnlineStatus: true,
      showLastSeen: true,
      quietModeEnabled: false,
      autoQuietHoursEnabled: true,
      whoCanSeeMyPosts: 'public',
      defaultPostVisibility: 'followers',
      whoCanCommentOnMyPosts: 'everyone',
      whoCanTagMe: 'followers',
      autoHideContentWarnings: false
    };
    stats.fixes.privacySettings++;
    changes.push('privacySettings → initialized');
    changed = true;
  }

  // ✅ Ensure moderation object exists
  if (!user.moderation || typeof user.moderation !== 'object') {
    user.moderation = {
      isMuted: false,
      muteExpires: null,
      muteReason: '',
      violationCount: 0,
      lastViolation: null,
      autoMuteEnabled: true
    };
    stats.fixes.moderation++;
    changes.push('moderation → initialized');
    changed = true;
  }

  // ✅ Array fields (prevent undefined crashes)
  const arrayFields = [
    'blockedUsers',
    'trustedDevices',
    'loginHistory',
    'recoveryContacts',
    'recoveryRequests',
    'activeSessions',
    'passkeys',
    'twoFactorBackupCodes',
    'moderationHistory',
    'featuredPosts',
    'bookmarkedPosts',
    'followers',
    'following'
  ];

  arrayFields.forEach((field) => {
    if (!Array.isArray(user[field])) {
      user[field] = [];
      stats.fixes.arrays++;
      changes.push(`${field} → []`);
      changed = true;
    }
  });

  return { changed, changes };
};

const run = async () => {
  console.log('🔧 User Normalization Script');
  console.log('============================\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be saved');
    console.log('   Run with --apply to save changes\n');
  } else {
    console.log('⚠️  APPLY MODE - Changes will be saved to database\n');
  }

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to database\n');

  const users = await User.find({});
  console.log(`🔍 Scanning ${users.length} users…\n`);

  for (const user of users) {
    stats.scanned++;

    try {
      const { changed, changes } = normalizeUser(user);

      if (changed) {
        if (!DRY_RUN) {
          await user.save();
        }
        stats.modified++;

        const username = user.username || user._id.toString();
        console.log(`${DRY_RUN ? '📋' : '✔'} ${username}`);
        changes.forEach(change => console.log(`   - ${change}`));
      }
    } catch (error) {
      stats.errors++;
      console.error(`❌ Error processing user ${user.username || user._id}:`, error.message);
    }
  }

  console.log('\n📊 NORMALIZATION SUMMARY');
  console.log('========================');
  console.log(`Mode:                 ${DRY_RUN ? 'DRY RUN (no changes saved)' : 'APPLY (changes saved)'}`);
  console.log(`Scanned users:        ${stats.scanned}`);
  console.log(`Modified users:       ${stats.modified}`);
  console.log(`Errors:               ${stats.errors}`);
  console.log(`Skipped (banned):     ${stats.skippedBanned}`);
  console.log(`Skipped (suspended):  ${stats.skippedSuspended}`);
  console.log(`Skipped (deleted):    ${stats.skippedDeleted}`);
  console.log('\nFix counts:');
  console.log(`- isActive set:            ${stats.fixes.isActive}`);
  console.log(`- role set:                ${stats.fixes.role}`);
  console.log(`- permissions initialized: ${stats.fixes.permissions}`);
  console.log(`- onboarding set:          ${stats.fixes.onboardingCompleted}`);
  console.log(`- emailVerified set:       ${stats.fixes.emailVerified}`);
  console.log(`- loginAlerts initialized: ${stats.fixes.loginAlerts}`);
  console.log(`- privacySettings init:    ${stats.fixes.privacySettings}`);
  console.log(`- moderation initialized:  ${stats.fixes.moderation}`);
  console.log(`- arrays initialized:      ${stats.fixes.arrays}`);

  await mongoose.disconnect();

  if (DRY_RUN) {
    console.log('\n💡 Run with --apply to save these changes');
  } else {
    console.log('\n✅ Normalization complete');
  }
};

run().catch((err) => {
  console.error('❌ Normalization failed:', err);
  process.exit(1);
});

