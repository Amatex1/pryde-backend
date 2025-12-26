# User Capability Audit System

## Overview

The User Capability Audit System provides comprehensive tools to diagnose and monitor user feature access issues in the Pryde Social platform. It helps identify account-state blockers, permission mismatches, and token inconsistencies.

## Components

### 1. Feature Capability Checker (`server/utils/featureCapability.js`)

Core functions that determine what features a user can access:

- **`canPost(user)`** - Check if user can create posts
- **`canMessage(user)`** - Check if user can send messages
- **`canUploadMedia(user)`** - Check if user can upload media
- **`canReply(user)`** - Check if user can reply to posts/comments
- **`canChat(user)`** - Check if user can participate in group chats
- **`getUserCapabilities(user)`** - Get comprehensive capability report

Each function returns:
```javascript
{
  allowed: boolean,
  reasons: string[],  // Blocking reasons if not allowed
  warnings: string[]  // Non-blocking warnings
}
```

### 2. Token Consistency Checker (`server/utils/tokenConsistency.js`)

Validates JWT tokens against current user state:

- **`checkTokenConsistency(token)`** - Verify token matches user state
- **`auditUserSessions(userId)`** - Audit all active sessions for a user

Detects:
- Stale tokens with outdated permissions
- Tokens for deleted/banned/suspended users
- Invalid or logged-out sessions
- Role mismatches between token and database

### 3. Feature Guard Middleware (`server/middleware/featureGuard.js`)

Instruments feature access attempts and logs blocked attempts:

- **`requireCanPost`** - Middleware to check post permission
- **`requireCanMessage`** - Middleware to check messaging permission
- **`requireCanUploadMedia`** - Middleware to check upload permission
- **`requireCanReply`** - Middleware to check reply permission
- **`getBlockedAttempts()`** - Get log of blocked attempts
- **`clearBlockedAttempts()`** - Clear the blocked attempts log

### 4. Audit Script (`server/scripts/auditUserCapabilities.js`)

Standalone script to audit all users:

```bash
node server/scripts/auditUserCapabilities.js
```

Generates:
- Summary statistics (fully functional, partially blocked, fully blocked users)
- Top blocking reasons by frequency
- Detailed reports for blocked users
- Suggested fixes for common issues
- JSON report file: `user-capability-audit-report.json`

### 5. Admin API Endpoints (`server/routes/audit.js`)

Admin-only endpoints for real-time auditing:

#### `GET /api/audit/users`
Audit all users and generate capability report.

**Response:**
```json
{
  "summary": {
    "total": 100,
    "fullyFunctional": 85,
    "partiallyBlocked": 10,
    "fullyBlocked": 5,
    "percentageFunctional": "85.0"
  },
  "topBlockingReasons": [
    { "reason": "Account is deactivated", "count": 8 },
    { "reason": "Account is banned", "count": 3 }
  ],
  "fullyFunctional": [...],
  "partiallyBlocked": [...],
  "fullyBlocked": [...]
}
```

#### `GET /api/audit/user/:userId`
Get detailed capability report for a specific user.

**Response:**
```json
{
  "userId": "...",
  "username": "johndoe",
  "role": "user",
  "accountState": {
    "isActive": true,
    "isDeleted": false,
    "isBanned": false,
    "isSuspended": false,
    "emailVerified": true
  },
  "capabilities": {
    "canPost": { "allowed": true, "reasons": [], "warnings": [] },
    "canMessage": { "allowed": true, "reasons": [], "warnings": [] }
  },
  "sessions": {
    "totalSessions": 2,
    "sessions": [...]
  }
}
```

#### `POST /api/audit/token`
Check token consistency against user state.

**Request:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "valid": true,
  "userId": "...",
  "username": "johndoe",
  "tokenAge": 120,
  "issues": [],
  "warnings": ["Email not verified"],
  "userState": {
    "isActive": true,
    "isDeleted": false,
    "isBanned": false
  }
}
```

#### `GET /api/audit/blocked-attempts`
Get log of blocked feature attempts.

**Response:**
```json
{
  "total": 45,
  "recentAttempts": [...],
  "byUser": [
    {
      "username": "johndoe",
      "count": 5,
      "attempts": [...]
    }
  ],
  "byFeature": [
    { "feature": "post", "count": 20 },
    { "feature": "message", "count": 15 }
  ],
  "topReasons": [
    { "reason": "Account is deactivated", "count": 30 }
  ]
}
```

#### `DELETE /api/audit/blocked-attempts`
Clear the blocked attempts log.

## Usage Examples

### Running the Audit Script

```bash
# Run full audit
node server/scripts/auditUserCapabilities.js

# Output will show:
# - Summary statistics
# - Top blocking reasons
# - Fully blocked users
# - Partially blocked users
# - Suggested fixes
# - JSON report saved to user-capability-audit-report.json
```

### Using Admin API

```javascript
// Get all users audit
const response = await fetch('/api/audit/users', {
  headers: {
    'Authorization': `Bearer ${adminToken}`
  }
});
const audit = await response.json();

// Check specific user
const userAudit = await fetch(`/api/audit/user/${userId}`, {
  headers: {
    'Authorization': `Bearer ${adminToken}`
  }
});

// Check token consistency
const tokenCheck = await fetch('/api/audit/token', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ token: userToken })
});
```

## Common Blocking Reasons

1. **Account is deleted** - User account has been soft-deleted
2. **Account is deactivated** - User has deactivated their account
3. **Account is banned** - User has been permanently banned
4. **Account is suspended until [date]** - Temporary suspension
5. **User is muted until [date]** - Temporary mute (blocks posting/messaging)
6. **Session has been logged out** - Token session no longer valid

## Troubleshooting

### User Can't Post/Message

1. Run audit for the user: `GET /api/audit/user/:userId`
2. Check `capabilities` object for specific blocking reasons
3. Review `accountState` for account-level issues
4. Check `sessions` to verify active sessions

### Token Issues

1. Use token consistency checker: `POST /api/audit/token`
2. Look for `issues` array for critical problems
3. Check `warnings` for non-critical issues
4. Verify `tokenAge` - tokens older than 7 days should be refreshed

### Monitoring Blocked Attempts

1. Check blocked attempts log: `GET /api/audit/blocked-attempts`
2. Review `byUser` to identify users with repeated blocks
3. Check `topReasons` to identify systemic issues
4. Clear log periodically: `DELETE /api/audit/blocked-attempts`

## Security Notes

- All audit endpoints require admin authentication
- Blocked attempts log is in-memory (max 1000 entries)
- Token consistency checks do not modify user state
- Audit script requires direct database access

