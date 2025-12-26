# User Capability Audit System - Implementation Summary

## Overview

A comprehensive audit system has been implemented to diagnose and monitor user feature access issues in the Pryde Social platform. The system identifies account-state blockers, permission mismatches, and token inconsistencies.

## What Was Created

### 1. Core Utilities

#### `server/utils/featureCapability.js` (Already Existed - Enhanced)
- **Functions:**
  - `canPost(user)` - Check posting permission
  - `canMessage(user)` - Check messaging permission
  - `canUploadMedia(user)` - Check upload permission
  - `canReply(user)` - Check reply permission
  - `canChat(user)` - Check chat permission
  - `getUserCapabilities(user)` - Comprehensive capability report

- **Checks Performed:**
  - Account deleted status
  - Account deactivated status
  - Banned status
  - Suspended status (with expiration)
  - Muted status (with expiration)
  - Email verification (warning only)
  - Onboarding completion (warning only)

#### `server/utils/tokenConsistency.js` (NEW)
- **Functions:**
  - `checkTokenConsistency(token)` - Validate JWT against user state
  - `auditUserSessions(userId)` - Audit all active sessions

- **Detects:**
  - Deleted user tokens
  - Banned user tokens
  - Deactivated user tokens
  - Suspended user tokens
  - Invalid/logged-out sessions
  - Role mismatches
  - Stale tokens (>7 days old)
  - Missing sessionId claims

### 2. Middleware

#### `server/middleware/featureGuard.js` (NEW)
- **Middleware Functions:**
  - `requireCanPost` - Guard post creation
  - `requireCanMessage` - Guard messaging
  - `requireCanUploadMedia` - Guard media uploads
  - `requireCanReply` - Guard replies

- **Features:**
  - Logs all blocked attempts (in-memory, max 1000 entries)
  - Returns detailed error responses with blocking reasons
  - Development mode console warnings
  - `getBlockedAttempts()` - Retrieve blocked attempts log
  - `clearBlockedAttempts()` - Clear the log

### 3. Admin API Endpoints

#### `server/routes/audit.js` (NEW)
Registered at `/api/audit/*` (admin-only)

**Endpoints:**

1. **`GET /api/audit/users`**
   - Audit all users
   - Returns summary statistics
   - Groups users by status (fully functional, partially blocked, fully blocked)
   - Shows top blocking reasons
   - Limits results to prevent overwhelming responses

2. **`GET /api/audit/user/:userId`**
   - Detailed report for specific user
   - Includes capability checks
   - Shows active sessions
   - Account state details

3. **`POST /api/audit/token`**
   - Validate token consistency
   - Check for stale permissions
   - Detect session issues
   - Verify role consistency

4. **`GET /api/audit/blocked-attempts`**
   - Retrieve blocked feature attempts log
   - Group by user and feature
   - Show top blocking reasons
   - Recent attempts (last 50)

5. **`DELETE /api/audit/blocked-attempts`**
   - Clear the blocked attempts log
   - Admin action logging

### 4. Standalone Audit Script

#### `server/scripts/auditUserCapabilities.js` (Already Existed - Fixed)
- **Fixed:** Import path for config (`config/index.js` instead of `config/config.js`)
- **Features:**
  - Audits all users in database
  - Generates console report with statistics
  - Creates JSON report file
  - Suggests fixes for common issues
  - Groups users by blocking status

**Usage:**
```bash
node server/scripts/auditUserCapabilities.js
```

**Output:**
- Console report with summary statistics
- Top blocking reasons by frequency
- Fully blocked users list
- Partially blocked users list
- Suggested fixes
- JSON file: `user-capability-audit-report.json`

### 5. Documentation

#### `server/docs/USER_CAPABILITY_AUDIT.md` (NEW)
Comprehensive documentation including:
- System overview
- Component descriptions
- API endpoint documentation
- Usage examples
- Common blocking reasons
- Troubleshooting guide
- Security notes

## Integration Points

### Server Registration
Updated `server/server.js`:
- Added import: `import auditRoutes from './routes/audit.js';`
- Registered routes: `app.use('/api/audit', auditRoutes);`

### Existing Middleware
The system integrates with existing middleware:
- `auth.js` - Authentication
- `adminAuth.js` - Admin authorization
- `requireActiveUser.js` - Active user check
- `privacy.js` - Privacy checks
- `moderation.js` - Moderation checks

## How It Works

### Feature Capability Flow
1. User attempts action (post, message, upload, etc.)
2. Feature guard middleware checks user state
3. If blocked, logs attempt and returns error with reasons
4. If allowed, proceeds to next middleware

### Audit Flow
1. Admin requests audit via API or runs script
2. System fetches all users from database
3. Each user evaluated against all capability checks
4. Users categorized by blocking status
5. Statistics and reports generated
6. Results returned or saved to file

### Token Consistency Flow
1. Admin submits token for validation
2. Token decoded and verified
3. User fetched from database
4. Token claims compared to current user state
5. Issues and warnings identified
6. Detailed report returned

## Common Blocking Reasons

1. **Account is deleted** - Soft-deleted account
2. **Account is deactivated** - User deactivated account
3. **Account is banned** - Permanent ban
4. **Account is suspended until [date]** - Temporary suspension
5. **User is muted until [date]** - Temporary mute
6. **Session has been logged out** - Invalid session

## Security Considerations

- All audit endpoints require admin authentication
- Blocked attempts log is in-memory (not persisted)
- Token checks are read-only (no state modification)
- Audit script requires direct database access
- Sensitive data (passwords) excluded from reports

## Testing Recommendations

1. **Run the audit script:**
   ```bash
   node server/scripts/auditUserCapabilities.js
   ```

2. **Test admin API endpoints:**
   - Get all users audit
   - Check specific user
   - Validate token consistency
   - View blocked attempts

3. **Test feature guards:**
   - Apply to routes that need protection
   - Verify blocking works correctly
   - Check logging functionality

4. **Monitor blocked attempts:**
   - Periodically check blocked attempts log
   - Identify patterns of blocked access
   - Clear log when needed

## Next Steps

1. **Apply feature guards to routes** - Add middleware to protected routes
2. **Set up monitoring** - Regularly check blocked attempts
3. **Run periodic audits** - Schedule audit script execution
4. **Review blocking patterns** - Identify systemic issues
5. **Update documentation** - Add to admin guide

## Files Modified/Created

### Created:
- `server/utils/tokenConsistency.js`
- `server/middleware/featureGuard.js`
- `server/routes/audit.js`
- `server/docs/USER_CAPABILITY_AUDIT.md`
- `AUDIT_SYSTEM_SUMMARY.md`

### Modified:
- `server/scripts/auditUserCapabilities.js` (fixed config import)
- `server/server.js` (registered audit routes)

### Already Existed (No Changes):
- `server/utils/featureCapability.js`
- `server/middleware/auth.js`
- `server/middleware/adminAuth.js`
- `server/middleware/requireActiveUser.js`
- `server/models/User.js`

