# Role Permission Audit Script - Improvements

## Overview
Enhanced the role permission audit script to comprehensively test both feature capabilities (account state-based) and role-based permissions (admin/moderation features) with automatic test user creation and detailed reporting.

## Key Improvements

### 1. **Comprehensive Permission Testing** 🔍

**Original Script Issues:**
- Used generic `featureCapability.can()` method that doesn't exist
- Only tested basic features
- Didn't distinguish between feature capabilities and role permissions
- No admin permission testing

**Improved Script:**
```javascript
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
```

**Benefits:**
- Tests actual functions from `featureCapability.js`
- Separates feature capabilities from role permissions
- Tests all admin permission flags
- Tests moderation capabilities (edit/delete any post)

### 2. **Automatic Test User Creation** 🤖

**Original Script:**
```javascript
const user = await User.findOne({ role });
if (!user) {
  console.warn(`⚠️ No user found with role ${role}, skipping`);
  continue;
}
```

**Improved Script:**
```javascript
const createTestUser = async (role) => {
  // Try to find existing user with this role
  let user = await User.findOne({ 
    role, 
    isActive: true, 
    isBanned: false, 
    isDeleted: false 
  });
  
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
  // ... (role-specific permission setup)

  await testUser.save();
  return testUser;
};
```

**Benefits:**
- Script works even on empty databases
- Creates properly configured test users
- Sets correct permissions for each role
- Ensures clean account state (active, verified, etc.)

### 3. **Detailed Account State Reporting** 📊

**Added to report:**
```javascript
accountState: {
  isActive: user.isActive,
  isDeleted: user.isDeleted,
  isBanned: user.isBanned,
  isSuspended: user.isSuspended,
  emailVerified: user.emailVerified,
  onboardingCompleted: user.onboardingCompleted,
}
```

**Example Output:**
```
🔐 Role: MODERATOR
   User: john_moderator (507f1f77bcf86cd799439011)
   Account State:
     - Active: true
     - Email Verified: true
     - Onboarding Complete: true
```

**Benefits:**
- Shows why permissions might be blocked
- Helps debug account state issues
- Verifies test users are properly configured

### 4. **Enhanced Permission Reporting** 📋

**Original Output:**
```
✔ post         → allowed: true | expected: true
❌ moderate     → allowed: false | expected: true
```

**Improved Output:**
```
   ✔ post                → allowed: true  | expected: true
   ✔ message             → allowed: true  | expected: true
   ✔ upload              → allowed: true  | expected: true
   ✔ reply               → allowed: true  | expected: true
   ✔ chat                → allowed: true  | expected: true
   ✔ edit_any_post       → allowed: true  | expected: true
   ✔ delete_any_post     → allowed: true  | expected: true
   ✔ view_reports        → allowed: true  | expected: true
   ✔ resolve_reports     → allowed: true  | expected: true
   ❌ manage_users        → allowed: false | expected: true [MISMATCH]
      Reasons: Permission flag not set
   ✔ view_analytics      → allowed: true  | expected: true
   ❌ manage_admins       → allowed: false | expected: false
```

**Benefits:**
- Clear visual alignment
- Shows mismatch markers
- Includes blocking reasons
- Includes warnings (non-blocking issues)

### 5. **Comprehensive Summary** 📈

**Added Summary Section:**
```
📋 SUMMARY
==========
Total roles audited: 4
Total permissions checked: 12
Total checks performed: 48
Mismatches found: 2

⚠️  MISMATCHES DETECTED:
========================

1. Role: moderator | Feature: manage_users
   Allowed: false | Expected: true
   Reasons: Permission flag not set

2. Role: admin | Feature: manage_admins
   Allowed: false | Expected: false
```

**Benefits:**
- Quick overview of audit results
- Lists all mismatches in one place
- Shows blocking reasons for each mismatch
- Easy to identify configuration issues

### 6. **Accurate Expected Permissions** ✅

**Based on actual codebase behavior:**

| Role | Feature Capabilities | Admin Permissions |
|------|---------------------|-------------------|
| **super_admin** | All ✅ | All ✅ |
| **admin** | All ✅ | All except `manage_admins` |
| **moderator** | All ✅ | `view_reports`, `resolve_reports`, `view_analytics`, `edit_any_post`, `delete_any_post` |
| **user** | All ✅ | None ❌ |

**Note:** Feature capabilities (post, message, upload, reply, chat) are based on account state, not role. All roles can use these features if their account is active, not banned, not suspended, etc.

### 7. **Proper Integration with Existing Code** 🔗

**Uses actual utility functions:**
```javascript
import * as featureCapability from '../utils/featureCapability.js';

// Later in code:
const result = featureCapability.canPost(user);
const allowed = result.allowed;
const reasons = result.reasons;
const warnings = result.warnings;
```

**Matches actual permission checks:**
```javascript
// From server/routes/posts.js
const isAdmin = user && ['moderator', 'admin', 'super_admin'].includes(user.role);

// From server/middleware/adminAuth.js
if (!['moderator', 'admin', 'super_admin'].includes(user.role)) {
  return res.status(403).json({ message: 'Access denied' });
}
```

## Permission Matrix

### Feature Capabilities (Account State Based)

| Feature | super_admin | admin | moderator | user |
|---------|-------------|-------|-----------|------|
| post | ✅ | ✅ | ✅ | ✅ |
| message | ✅ | ✅ | ✅ | ✅ |
| upload | ✅ | ✅ | ✅ | ✅ |
| reply | ✅ | ✅ | ✅ | ✅ |
| chat | ✅ | ✅ | ✅ | ✅ |

*All roles can use these features if account is active, not banned, not suspended, not muted, etc.*

### Role-Based Permissions (Admin/Moderation)

| Permission | super_admin | admin | moderator | user |
|------------|-------------|-------|-----------|------|
| edit_any_post | ✅ | ✅ | ✅ | ❌ |
| delete_any_post | ✅ | ✅ | ✅ | ❌ |
| view_reports | ✅ | ✅ | ✅ | ❌ |
| resolve_reports | ✅ | ✅ | ✅ | ❌ |
| manage_users | ✅ | ✅ | ❌ | ❌ |
| view_analytics | ✅ | ✅ | ✅ | ❌ |
| manage_admins | ✅ | ❌ | ❌ | ❌ |

## Usage

```bash
node server/scripts/rolePermissionAudit.js
```

**What it does:**
1. Connects to database
2. For each role (super_admin, admin, moderator, user):
   - Finds or creates a test user with that role
   - Tests all feature capabilities
   - Tests all role-based permissions
   - Compares actual vs expected permissions
3. Generates detailed report
4. Lists all mismatches
5. Provides summary statistics

## Use Cases

### 1. **Verify Permission Configuration**
Run after setting up new admin users to ensure permissions are correctly assigned.

### 2. **Debug Permission Issues**
When users report they can't access features, run this to verify role permissions are correct.

### 3. **Test Permission Changes**
After modifying permission logic, run this to ensure no regressions.

### 4. **Documentation**
Generate current permission matrix for documentation purposes.

### 5. **Onboarding**
Help new developers understand the permission system.

## Expected Output (All Passing)

```
🔐 Role Permission Audit Script
================================

✅ Connected to database

🔍 Auditing role: super_admin...
🔍 Auditing role: admin...
🔍 Auditing role: moderator...
🔍 Auditing role: user...

📊 ROLE PERMISSION AUDIT REPORT
================================

🔐 Role: SUPER_ADMIN
   User: admin_user (507f1f77bcf86cd799439011)
   Account State:
     - Active: true
     - Email Verified: true
     - Onboarding Complete: true

   Permissions:
   ✔ post                → allowed: true  | expected: true
   ✔ message             → allowed: true  | expected: true
   ✔ upload              → allowed: true  | expected: true
   ✔ reply               → allowed: true  | expected: true
   ✔ chat                → allowed: true  | expected: true
   ✔ edit_any_post       → allowed: true  | expected: true
   ✔ delete_any_post     → allowed: true  | expected: true
   ✔ view_reports        → allowed: true  | expected: true
   ✔ resolve_reports     → allowed: true  | expected: true
   ✔ manage_users        → allowed: true  | expected: true
   ✔ view_analytics      → allowed: true  | expected: true
   ✔ manage_admins       → allowed: true  | expected: true

[... similar output for other roles ...]

📋 SUMMARY
==========
Total roles audited: 4
Total permissions checked: 12
Total checks performed: 48
Mismatches found: 0

✅ All permissions match expected values!

✅ Role audit complete
```

## Troubleshooting

### Mismatches Found

If mismatches are detected:

1. **Check user permissions object** - Ensure permissions are set correctly in database
2. **Verify role assignment** - Ensure user has correct role
3. **Check account state** - Ensure user is active, not banned, etc.
4. **Review permission logic** - Check if expected permissions match actual implementation

### Test Users Created

The script creates test users if none exist for a role. These users:
- Have username format: `test_{role}_{timestamp}`
- Have email format: `test_{role}_{timestamp}@example.com`
- Are fully configured with correct permissions
- Can be safely deleted after audit

## Future Enhancements

- [ ] Add cleanup flag to remove test users after audit
- [ ] Add JSON export for permission matrix
- [ ] Add comparison with previous audit results
- [ ] Add permission inheritance visualization
- [ ] Test with various account states (banned, suspended, etc.)

