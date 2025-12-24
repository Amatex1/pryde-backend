# Full Platform Audit System

## Overview

The Full Platform Audit System is a comprehensive auditing framework that validates the health, security, and integrity of the Pryde Social platform across all layers: frontend, backend, security, permissions, routing, UI, lifecycle, and deployment.

## Architecture

```
server/audit/
├── fullPlatformAudit.js          # Main orchestrator
├── modules/                       # Individual audit modules
│   ├── routeAudit.js             # Route & navigation validation
│   ├── featureAudit.js           # Feature availability checks
│   ├── permissionAudit.js        # Role & permission validation
│   ├── securityAudit.js          # Security configuration checks
│   ├── notificationAudit.js      # Notification system health
│   ├── lifecycleAudit.js         # State & lifecycle validation
│   ├── networkAudit.js           # Network & rate limiting checks
│   ├── uiAudit.js                # UI integrity validation
│   └── updateAudit.js            # Deployment & update checks
└── README.md                      # This file

server/config/
├── routes.js                      # Route definitions
└── roles.js                       # Role & permission matrix

server/scripts/
└── runFullAudit.js               # Audit runner script
```

## Audit Modules

### 1. Route Audit (`routeAudit.js`)
**Purpose**: Validates routing configuration across frontend and backend

**Checks**:
- ✅ All routes have required properties (path, component)
- ✅ No duplicate route paths
- ✅ Critical routes are present (/login, /register, /feed, /settings)
- ✅ Protected routes are properly configured
- ✅ Admin routes have role requirements

**Output**:
- Total frontend routes
- Total API routes
- Protected vs public route counts
- Admin route counts
- List of any misconfigured or missing routes

### 2. Feature Audit (`featureAudit.js`)
**Purpose**: Validates feature availability across different user states

**Checks**:
- ✅ Active users can access all features (post, message, upload, reply, chat, comment)
- ✅ Banned/suspended users are properly blocked from features
- ✅ Feature capability checks work correctly
- ✅ No unexpected feature blocks for active users

**Output**:
- Users audited
- Features checked
- Active vs blocked user counts
- List of any unexpected feature blocks

### 3. Permission Audit (`permissionAudit.js`)
**Purpose**: Validates role-based permissions and access control

**Checks**:
- ✅ All users have valid roles (user, moderator, admin, super_admin)
- ✅ Permission flags match role expectations
- ✅ Role matrix is complete for all roles
- ✅ No permission mismatches

**Output**:
- Users audited
- Role distribution
- Permission mismatches
- List of invalid roles or permission issues

### 4. Security Audit (`securityAudit.js`)
**Purpose**: Validates security headers, configurations, and best practices

**Checks**:
- ✅ Required environment variables are set (MONGO_URI, JWT_SECRET, etc.)
- ✅ Secrets are strong (>= 32 characters)
- ✅ Security headers are configured (CSP, X-Frame-Options, etc.)
- ✅ CORS is properly configured
- ✅ HTTPS enforcement in production
- ✅ Rate limiting is enabled

**Output**:
- Environment checks
- Configuration checks
- Header checks
- List of security issues

### 5. Notification Audit (`notificationAudit.js`)
**Purpose**: Validates notification delivery and system health

**Checks**:
- ✅ Notification counts are reasonable
- ✅ No orphaned notifications (user doesn't exist)
- ✅ Push notification configuration
- ✅ Notification preferences are set

**Output**:
- Total notifications
- Unread notifications
- Users with push enabled
- Orphaned notification count

### 6. Lifecycle Audit (`lifecycleAudit.js`)
**Purpose**: Validates application state management and lifecycle behavior

**Checks**:
- ✅ User state counts (active, deactivated, deleted, banned, suspended)
- ✅ No stale accounts (created >6 months ago, onboarding incomplete)
- ✅ Expired suspensions are cleared
- ✅ No inconsistent user states (deleted + active)

**Output**:
- Active/deactivated/deleted/banned/suspended user counts
- Stale account count
- Expired suspension count
- Inconsistent state count

### 7. Network Audit (`networkAudit.js`)
**Purpose**: Validates network configurations and rate limiting

**Checks**:
- ✅ Rate limiting is configured
- ✅ CORS is properly set up
- ✅ Socket.IO is configured
- ✅ API versioning is in place
- ✅ Request timeouts are set
- ✅ Body size limits are configured
- ✅ DDoS protection is verified

**Output**:
- Rate limiting status
- CORS configuration status
- Socket configuration status
- API versioning status

### 8. UI Audit (`uiAudit.js`)
**Purpose**: Validates UI integrity, accessibility, and user experience

**Checks**:
- ✅ PWA is enabled
- ✅ Mobile optimization
- ✅ Dark mode support
- ✅ Accessibility features
- ✅ Error boundaries
- ✅ Loading states
- ✅ Offline support
- ✅ Performance optimizations

**Output**:
- PWA status
- Mobile optimization status
- Dark mode support
- Accessibility feature count

### 9. Update Audit (`updateAudit.js`)
**Purpose**: Validates deployment behavior and update mechanisms

**Checks**:
- ✅ Version endpoint is configured
- ✅ Service worker is set up
- ✅ Update notifications are enabled
- ✅ Deployment environment is correct
- ✅ Version tracking is in place
- ✅ Health check endpoint exists
- ✅ Graceful shutdown handlers
- ✅ Rollback capability

**Output**:
- Version endpoint status
- Service worker status
- Update notification status
- Rollback capability

## Usage

### Running the Audit

```bash
# Run full audit
npm run audit

# Save audit results to JSON file
npm run audit:json
```

### Programmatic Usage

```javascript
import runFullAudit from './server/audit/fullPlatformAudit.js';

const report = await runFullAudit();
console.log(report);
```

## Output Format

```json
{
  "timestamp": "2025-12-24T20:00:00.000Z",
  "environment": "production",
  "audits": {
    "routes": { "pass": 45, "warn": 0, "fail": 0, "issues": [], "details": {...} },
    "features": { "pass": 300, "warn": 0, "fail": 0, "issues": [], "details": {...} },
    ...
  },
  "summary": {
    "pass": 500,
    "warn": 10,
    "fail": 2,
    "total": 512,
    "healthScore": 97
  },
  "duration": 1234
}
```

## Health Score

The health score is calculated as:

```
healthScore = ((pass + (warn * 0.5)) / total) * 100
```

- **90-100**: Excellent health
- **75-89**: Good health
- **60-74**: Fair health
- **Below 60**: Poor health - immediate attention required

## Exit Codes

- `0`: Audit passed (may have warnings)
- `1`: Audit failed (has failures)

## Integration

### CI/CD Pipeline

Add to your CI/CD pipeline:

```yaml
# .github/workflows/audit.yml
name: Platform Audit
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npm run audit
```

### Scheduled Audits

Run audits on a schedule using cron:

```bash
# Run audit daily at 2 AM
0 2 * * * cd /path/to/pryde-backend && npm run audit >> /var/log/audit.log 2>&1
```

## Extending the Audit System

### Adding a New Audit Module

1. Create a new file in `server/audit/modules/`:

```javascript
// server/audit/modules/myAudit.js
export default async function runMyAudit() {
  const report = {
    pass: 0,
    warn: 0,
    fail: 0,
    issues: [],
    details: {},
  };

  // Your audit logic here

  return report;
}
```

2. Import and add to `fullPlatformAudit.js`:

```javascript
import runMyAudit from './modules/myAudit.js';

const audits = [
  // ... existing audits
  ['myAudit', runMyAudit],
];
```

## Best Practices

1. **Run audits regularly**: Schedule daily or weekly audits
2. **Monitor health score**: Set up alerts if score drops below 80
3. **Fix critical issues immediately**: Don't let critical issues accumulate
4. **Review warnings**: Warnings can become failures if ignored
5. **Document exceptions**: If an issue can't be fixed, document why

## Troubleshooting

### Audit Fails to Connect to Database

```bash
# Check MONGO_URI environment variable
echo $MONGO_URI

# Verify MongoDB is running
mongosh $MONGO_URI
```

### Audit Times Out

```bash
# Increase timeout in runFullAudit.js
# Or run individual audit modules
```

### False Positives

If an audit module reports false positives, you can:
1. Update the audit logic in the module
2. Add exceptions for known cases
3. Document the exception in the audit report

## Support

For issues or questions about the audit system:
1. Check this README
2. Review audit module source code
3. Contact the development team

## License

Part of Pryde Social platform - Internal use only

