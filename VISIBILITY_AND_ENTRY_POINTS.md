# Visibility & Entry Points for Platform Resilience Systems

This document describes how to wire visibility and entry points for the platform resilience systems, ensuring they remain invisible when healthy but accessible when needed.

---

## 1. Admin Health & Incident Dashboard

### Route
`/api/admin/health`

### Access
Super Admin / Admin only

### Endpoints

#### GET /api/admin/health/dashboard
Get comprehensive health dashboard.

**Query Parameters:**
- `platform` (optional): Filter by platform (web/ios/android)
- `version` (optional): Filter by version
- `timeRange` (optional): Time range (1h/6h/24h/7d/30d), default: 24h

**Response:**
```json
{
  "activeVersions": [...],
  "canaryStatus": {...},
  "stableStatus": {...},
  "errorClusters": [...],
  "authRates": {...},
  "safeModeActivations": 5,
  "pwaSuccessRates": {...}
}
```

#### GET /api/admin/health/incidents
Get incident timeline.

**Query Parameters:**
- `limit` (optional): Max incidents to return, default: 50

**Response:**
```json
{
  "incidents": [
    {
      "type": "rollback",
      "severity": "critical",
      "timestamp": 1234567890,
      "version": "1.2.3",
      "reason": "auth_failure_rate",
      "details": {...}
    }
  ],
  "total": 10
}
```

#### GET /api/admin/health/alerts
Get predictive alerts.

**Response:**
```json
{
  "alerts": [
    {
      "severity": "critical",
      "type": "unhealthy_deploy",
      "message": "2 unhealthy deploy(s) detected",
      "details": {...},
      "timestamp": 1234567890
    }
  ],
  "total": 5,
  "critical": 2,
  "warning": 3
}
```

#### GET /api/admin/health/feature-flags
Get all feature flags.

**Response:**
```json
{
  "flags": [
    {
      "key": "PWA",
      "name": "Progressive Web App",
      "description": "Offline support, install prompts, service worker",
      "enabled": true,
      "degraded": false,
      "reason": null,
      "override": null,
      "canDegrade": true
    }
  ],
  "degraded": [...],
  "overrides": [...],
  "total": 6,
  "degradedCount": 0,
  "overrideCount": 0
}
```

#### POST /api/admin/health/feature-flags/:feature/override
Set admin override for feature flag.

**Body:**
```json
{
  "enabled": false,
  "duration": 3600000
}
```

**Response:**
```json
{
  "success": true,
  "feature": "PWA",
  "enabled": false,
  "adminId": "admin123",
  "duration": 3600000
}
```

#### DELETE /api/admin/health/feature-flags/:feature/override
Remove admin override for feature flag.

**Response:**
```json
{
  "success": true,
  "feature": "PWA"
}
```

---

## 2. Debug Overlay Entry Point

### Access
Admin only (moderator/admin/super_admin)

### Activation Methods

#### URL Parameter
Add `?debug=true` to any URL:
```
https://pryde.app/feed?debug=true
```

#### Keyboard Shortcut
Press `Ctrl+Shift+D` (admin only)

### Backend Endpoint

#### GET /api/admin/debug/overlay
Get debug overlay data.

**Headers:**
- `x-session-id`: Session ID

**Response:**
```json
{
  "timestamp": 1234567890,
  "userId": "user123",
  "sessionId": "session456",
  "stability": {
    "score": 95,
    "level": "Excellent"
  },
  "safeMode": {
    "enabled": false,
    "trigger": null
  },
  "backend": {
    "version": "1.2.3",
    "environment": "production",
    "uptime": 123456
  }
}
```

### Frontend Display
Shows:
- authReady / authLoading state
- Service worker state
- Cache version
- Mutation queue status
- Stability score
- Safe Mode status

---

## 3. User-Visible Stability Controls

### Route
`/api/stability`

### Access
Authenticated users

### Endpoints

#### GET /api/stability/status
Get user's stability status.

**Headers:**
- `x-session-id`: Session ID

**Response:**
```json
{
  "stabilityScore": {
    "score": 85,
    "level": "Good"
  },
  "safeModeEnabled": false,
  "diagnosticsOptIn": true,
  "showStabilityControls": false
}
```

#### POST /api/stability/safe-mode/toggle
Toggle Safe Mode.

**Headers:**
- `x-session-id`: Session ID

**Body:**
```json
{
  "enabled": true
}
```

**Response:**
```json
{
  "success": true,
  "safeModeEnabled": true
}
```

#### POST /api/stability/diagnostics/opt-in
Opt in/out of diagnostics.

**Body:**
```json
{
  "optIn": true
}
```

**Response:**
```json
{
  "success": true,
  "diagnosticsOptIn": true
}
```

#### POST /api/stability/report-bug
Report bug with session snapshot.

**Headers:**
- `x-session-id`: Session ID

**Body:**
```json
{
  "description": "App freezes when posting",
  "category": "performance"
}
```

**Response:**
```json
{
  "success": true,
  "reportId": "report123",
  "message": "Bug report submitted successfully"
}
```

#### GET /api/stability/recommendations
Get stability recommendations.

**Response:**
```json
{
  "recommendations": [
    {
      "type": "enable_safe_mode",
      "title": "Enable Safe Mode",
      "description": "Safe Mode disables advanced features to improve stability",
      "priority": "high"
    }
  ],
  "total": 1
}
```

---

## 4. Safe Mode Banner (Conditional)

### Route
`/api/stability/banner`

### Access
Authenticated users

### Endpoints

#### GET /api/stability/banner
Get Safe Mode banner configuration.

**Headers:**
- `x-session-id`: Session ID

**Response:**
```json
{
  "banner": {
    "show": true,
    "type": "info",
    "dismissible": false,
    "message": "Safe Mode activated due to authentication issues.",
    "details": "We've temporarily disabled some features to help stabilize your session.",
    "learnMoreUrl": "/help/safe-mode",
    "actions": [
      {
        "label": "Learn More",
        "action": "navigate",
        "url": "/help/safe-mode"
      }
    ]
  },
  "shouldShow": true
}
```

#### POST /api/stability/banner/dismiss
Dismiss Safe Mode banner (user-manual mode only).

**Headers:**
- `x-session-id`: Session ID

**Response:**
```json
{
  "success": true,
  "dismissed": true
}
```

### Banner Triggers
- `auth_failures`: Authentication issues
- `authready_loop`: Loading loops
- `sw_failures`: Service worker issues
- `stuck_mutations`: Sync issues
- `offline_thrashing`: Connection instability
- `error_clusters`: Repeated errors
- `user_manual`: User-enabled

### Banner Styles
Each trigger has a specific style:
- **auth_failures**: Yellow warning (⚠️)
- **authready_loop**: Yellow warning (🔄)
- **sw_failures**: Blue info (ℹ️)
- **stuck_mutations**: Yellow warning (⏸️)
- **offline_thrashing**: Blue info (📡)
- **error_clusters**: Red critical (🛡️)
- **user_manual**: Blue info (✓)

---

## 5. Feature Flags

### Available Features
1. **PWA**: Progressive Web App (offline support, install prompts, service worker)
2. **SOCKETS**: WebSockets (real-time updates and notifications)
3. **POLLING**: Background Polling (periodic background updates)
4. **OPTIMISTIC_UI**: Optimistic UI (instant UI updates before server confirmation)
5. **OFFLINE_QUEUE**: Offline Queue (queue actions when offline)
6. **PUSH_NOTIFICATIONS**: Push Notifications (browser push notifications)

### Auto-Degradation
Features are automatically degraded when Safe Mode is activated:
- PWA → Disabled
- SOCKETS → Disabled
- POLLING → Disabled
- OPTIMISTIC_UI → Disabled

### Admin Overrides
Admins can temporarily override feature flags:
- Set override with optional duration
- Override expires automatically
- Overrides take precedence over auto-degradation

---

## Integration Examples

### Frontend: Check Feature Flag
```javascript
import api from './utils/api';

async function isFeatureEnabled(feature) {
  try {
    const response = await api.get('/admin/health/feature-flags');
    const flag = response.data.flags.find(f => f.key === feature);
    return flag ? flag.enabled : false;
  } catch (error) {
    console.error('Failed to check feature flag:', error);
    return false;
  }
}

// Usage
const pwaEnabled = await isFeatureEnabled('PWA');
if (pwaEnabled) {
  // Register service worker
}
```

### Frontend: Show Safe Mode Banner
```javascript
import { useState, useEffect } from 'react';
import api from './utils/api';

function SafeModeBanner() {
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    const fetchBanner = async () => {
      try {
        const response = await api.get('/stability/banner', {
          headers: {
            'x-session-id': sessionStorage.getItem('sessionId')
          }
        });

        if (response.data.shouldShow) {
          setBanner(response.data.banner);
        }
      } catch (error) {
        console.error('Failed to fetch banner:', error);
      }
    };

    fetchBanner();
  }, []);

  if (!banner || !banner.show) return null;

  return (
    <div className="safe-mode-banner">
      <p>{banner.message}</p>
      <p>{banner.details}</p>
      {banner.actions.map(action => (
        <button key={action.label} onClick={() => handleAction(action)}>
          {action.label}
        </button>
      ))}
    </div>
  );
}
```

### Frontend: Stability Controls in Settings
```javascript
import { useState, useEffect } from 'react';
import api from './utils/api';

function StabilitySettings() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await api.get('/stability/status', {
          headers: {
            'x-session-id': sessionStorage.getItem('sessionId')
          }
        });
        setStatus(response.data);
      } catch (error) {
        console.error('Failed to fetch stability status:', error);
      }
    };

    fetchStatus();
  }, []);

  if (!status || !status.showStabilityControls) return null;

  return (
    <div className="stability-settings">
      <h3>Stability</h3>

      <div className="stability-score">
        <p>Score: {status.stabilityScore.score}/100</p>
        <p>Level: {status.stabilityScore.level}</p>
      </div>

      <div className="safe-mode-toggle">
        <label>
          <input
            type="checkbox"
            checked={status.safeModeEnabled}
            onChange={handleToggleSafeMode}
          />
          Enable Safe Mode
        </label>
      </div>

      <div className="diagnostics-opt-in">
        <label>
          <input
            type="checkbox"
            checked={status.diagnosticsOptIn}
            onChange={handleToggleDiagnostics}
          />
          Share diagnostics to help improve stability
        </label>
      </div>

      <button onClick={handleReportBug}>
        Report bug with snapshot
      </button>
    </div>
  );
}
```

---

## Final Outcome

### Systems Remain Invisible When Healthy
- No UI clutter
- No unnecessary warnings
- No performance overhead

### Visibility Appears Only When Needed
- Safe Mode banner shows only when activated
- Stability controls show only when score < 90 or Safe Mode active
- Debug overlay hidden by default

### Admins Gain Clarity
- Health dashboard shows real-time metrics
- Incident timeline shows historical issues
- Feature flags show degraded features with reasons
- Predictive alerts warn of potential issues

### Users Gain Trust
- Stability score provides transparency
- Safe Mode banner explains issues calmly
- Recommendations guide users to solutions
- Bug reporting empowers users to help

---

## API Summary

### Admin Endpoints (6)
1. `GET /api/admin/health/dashboard` - Health dashboard
2. `GET /api/admin/health/incidents` - Incident timeline
3. `GET /api/admin/health/alerts` - Predictive alerts
4. `GET /api/admin/health/feature-flags` - Feature flags
5. `POST /api/admin/health/feature-flags/:feature/override` - Set override
6. `DELETE /api/admin/health/feature-flags/:feature/override` - Remove override

### Debug Endpoints (1)
7. `GET /api/admin/debug/overlay` - Debug overlay data

### User Endpoints (6)
8. `GET /api/stability/status` - Stability status
9. `POST /api/stability/safe-mode/toggle` - Toggle Safe Mode
10. `POST /api/stability/diagnostics/opt-in` - Opt in/out of diagnostics
11. `POST /api/stability/report-bug` - Report bug with snapshot
12. `GET /api/stability/recommendations` - Stability recommendations
13. `GET /api/stability/banner` - Safe Mode banner
14. `POST /api/stability/banner/dismiss` - Dismiss banner

**Total New Endpoints:** 14 endpoints

