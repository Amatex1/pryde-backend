# User Normalization Script - Improvements

## Overview
Enhanced the user normalization script with better safety, dry-run mode, comprehensive fixes, and detailed reporting.

## Key Improvements

### 1. **Dry Run Mode** 🔍
```bash
# Preview changes without modifying database
node server/scripts/normalizeUsers.js

# Apply changes to database
node server/scripts/normalizeUsers.js --apply
```

**Benefits:**
- Safe to test on production
- Review all changes before applying
- Prevents accidental modifications
- Clear visual distinction between modes

### 2. **Enhanced Safety Checks** 🔒

**Original:**
```javascript
if (user.isBanned === true || user.isSuspended === true) {
  stats.skippedBanned++;
  return false;
}
```

**Improved:**
```javascript
// Separate tracking for each skip reason
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
```

**Benefits:**
- Separate counters for banned, suspended, and deleted users
- Skips soft-deleted accounts (critical safety improvement)
- Better reporting on why users were skipped

### 3. **Comprehensive Field Normalization** ✅

#### Added Normalizations:

**Permissions Object:**
```javascript
if (!user.permissions || typeof user.permissions !== 'object') {
  user.permissions = {
    canViewReports: false,
    canResolveReports: false,
    canManageUsers: false,
    canViewAnalytics: false,
    canManageAdmins: false
  };
}
```

**Login Alerts:**
```javascript
if (!user.loginAlerts || typeof user.loginAlerts !== 'object') {
  user.loginAlerts = {
    enabled: true,
    emailOnNewDevice: true,
    emailOnSuspiciousLogin: true
  };
}
```

**Privacy Settings:**
```javascript
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
}
```

**Moderation Object:**
```javascript
if (!user.moderation || typeof user.moderation !== 'object') {
  user.moderation = {
    isMuted: false,
    muteExpires: null,
    muteReason: '',
    violationCount: 0,
    lastViolation: null,
    autoMuteEnabled: true
  };
}
```

**Extended Array Fields:**
```javascript
const arrayFields = [
  'blockedUsers',
  'trustedDevices',
  'loginHistory',
  'recoveryContacts',
  'recoveryRequests',
  'activeSessions',
  'passkeys',
  'twoFactorBackupCodes',      // NEW
  'moderationHistory',          // NEW
  'featuredPosts',              // NEW
  'bookmarkedPosts',            // NEW
  'followers',                  // NEW
  'following'                   // NEW
];
```

### 4. **Detailed Change Tracking** 📋

**Original:**
```javascript
const changed = normalizeUser(user);
if (changed) {
  await user.save();
  stats.modified++;
  console.log(`✔ Normalized user ${user.username}`);
}
```

**Improved:**
```javascript
const { changed, changes } = normalizeUser(user);
if (changed) {
  if (!DRY_RUN) {
    await user.save();
  }
  stats.modified++;
  
  console.log(`${DRY_RUN ? '📋' : '✔'} ${username}`);
  changes.forEach(change => console.log(`   - ${change}`));
}
```

**Example Output:**
```
📋 john_doe
   - isActive → true
   - permissions → initialized
   - loginAlerts → initialized
   - blockedUsers → []
   - followers → []
```

### 5. **Error Handling** ⚠️

```javascript
try {
  const { changed, changes } = normalizeUser(user);
  // ... process user
} catch (error) {
  stats.errors++;
  console.error(`❌ Error processing user ${user.username}:`, error.message);
}
```

**Benefits:**
- Script continues even if one user fails
- Tracks error count
- Shows which user caused the error
- Doesn't crash entire normalization

### 6. **Enhanced Reporting** 📊

**Original Summary:**
```
Scanned users:        150
Modified users:       45
Skipped (banned):     5
```

**Improved Summary:**
```
Mode:                 DRY RUN (no changes saved)
Scanned users:        150
Modified users:       45
Errors:               0
Skipped (banned):     3
Skipped (suspended):  2
Skipped (deleted):    1

Fix counts:
- isActive set:            12
- role set:                3
- permissions initialized: 45
- onboarding set:          8
- emailVerified set:       15
- loginAlerts initialized: 20
- privacySettings init:    18
- moderation initialized:  22
- arrays initialized:      67
```

## Usage Examples

### Preview Changes (Safe)
```bash
node server/scripts/normalizeUsers.js
```
Output shows what WOULD be changed without modifying database.

### Apply Changes
```bash
node server/scripts/normalizeUsers.js --apply
```
Actually saves changes to database.

### Recommended Workflow
1. Run in dry-run mode first
2. Review the output
3. If everything looks good, run with --apply
4. Monitor the output for errors

## Safety Features

✅ **Dry run by default** - Must explicitly use --apply
✅ **Skips banned users** - Never modifies banned accounts
✅ **Skips suspended users** - Never modifies suspended accounts  
✅ **Skips deleted users** - Never modifies soft-deleted accounts
✅ **Error isolation** - One bad user doesn't crash entire script
✅ **Detailed logging** - See exactly what changes for each user
✅ **Idempotent** - Safe to run multiple times

## Fields Normalized

### Boolean Fields
- `isActive` → `true` (if undefined)
- `emailVerified` → `false` (if undefined, never auto-true)
- `onboardingCompleted` → `true` (if undefined)

### String Fields
- `role` → `'user'` (if invalid or missing)

### Object Fields
- `permissions` → Default permissions object
- `loginAlerts` → Default login alerts settings
- `privacySettings` → Default privacy settings
- `moderation` → Default moderation object

### Array Fields (13 total)
All initialized to `[]` if not array:
- blockedUsers, trustedDevices, loginHistory
- recoveryContacts, recoveryRequests, activeSessions
- passkeys, twoFactorBackupCodes, moderationHistory
- featuredPosts, bookmarkedPosts, followers, following

## Migration Path

1. **Development:** Run dry-run, verify output
2. **Staging:** Run with --apply, monitor results
3. **Production:** Run dry-run first, then --apply
4. **Post-migration:** Verify user functionality

## Future Enhancements

- [ ] Add --user flag to normalize specific user
- [ ] Add --batch-size for large databases
- [ ] Export changes to JSON for audit trail
- [ ] Add rollback capability
- [ ] Add validation checks after normalization

