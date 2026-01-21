# AUTH CIRCUIT BREAKER & RELOAD LOOP PROTECTION

## 🎯 Purpose

Stop continuous recovery loops by implementing multiple layers of protection:
- Circuit breakers that prevent premature API calls
- False positive auth instability triggers
- Infinite recovery loops
- Push status affecting auth health
- Auto-reload during development
- **Backend forceReload flag auto-expiry**
- **Frontend reload loop detection**

---

## 🔥 Implementation

### 1. Circuit Breaker Core (`src/utils/authCircuitBreaker.js`)

**Features:**
- ✅ Blocks non-critical requests until `authReady === true`
- ✅ Only allows `/api/auth/me` before auth ready
- ✅ Blocks: `/api/push/status`, `/api/notifications`, `/api/counts`, `/api/status`
- ✅ Single-shot recovery guard (prevents loops)
- ✅ Separates push failures from auth failures
- ✅ Disables auto-reload in dev mode

**Key Functions:**
```javascript
markAuthReady()           // Called after bootstrap completes
isAuthReady()             // Check if auth is ready
shouldBlockRequest(url)   // Check if request should be blocked
recordAuthFailure(url, status) // Record auth failure (post-bootstrap only)
isPushEndpoint(url)       // Check if endpoint is push-related
```

---

### 2. API Client Integration (`src/utils/apiClient.js`)

**Changes:**
- ✅ Import circuit breaker functions
- ✅ Block requests before auth ready
- ✅ Record 401 failures on critical endpoints
- ✅ Separate push failures from auth failures

**Request Blocking:**
```javascript
if (shouldBlockRequest(url)) {
  logger.warn(`[API] 🚫 Request blocked by circuit breaker: ${url}`);
  return null;
}
```

**Failure Recording:**
```javascript
if (res.status === 401) {
  if (isPushEndpoint(url)) {
    handlePushFailure(url, new Error(`HTTP ${res.status}`));
  } else {
    recordAuthFailure(url, res.status);
  }
}
```

---

### 3. AuthContext Integration (`src/context/AuthContext.jsx`)

**Changes:**
- ✅ Import `markAuthReady` and `resetAuthReady`
- ✅ Call `markAuthReady()` after successful auth
- ✅ Call `markAuthReady()` even on auth failure (to unblock app)
- ✅ Call `resetAuthReady()` on logout

**Bootstrap Success:**
```javascript
setAuthReady(true);
setAuthLoading(false);
markAuthReady(); // 🔥 CIRCUIT BREAKER
```

**Bootstrap Failure:**
```javascript
setAuthReady(true);
setAuthLoading(false);
markAuthReady(); // 🔥 Still mark ready to unblock app
```

**Logout:**
```javascript
resetAuthReady(); // 🔥 Reset circuit breaker on logout
```

---

### 4. Push Notifications Integration (`src/utils/pushNotifications.js`)

**Changes:**
- ✅ Import `isAuthReady`
- ✅ Skip push status check before auth ready
- ✅ Skip push initialization before auth ready
- ✅ Silently fail push requests (don't affect auth)

**Status Check:**
```javascript
if (!isAuthReady()) {
  console.debug('[Push] Skipping status check - auth not ready');
  return false;
}
```

---

### 5. Main Entry Point (`src/main.jsx`)

**Changes:**
- ✅ Import `initCircuitBreaker`
- ✅ Initialize circuit breaker BEFORE theme
- ✅ Initialize circuit breaker BEFORE any API calls

**Initialization Order:**
```javascript
initCircuitBreaker();  // 🔥 FIRST
initializeTheme();
// ... rest of initialization
```

---

## 📋 Circuit Breaker Rules

### 1. Request Blocking (Before Auth Ready)

**Allowed:**
- ✅ `/api/auth/me` (bootstrap call)

**Blocked:**
- 🚫 `/api/push/status`
- 🚫 `/api/notifications/*`
- 🚫 `/api/counts`
- 🚫 `/api/status`
- 🚫 All other `/api/*` endpoints

### 2. Auth Instability Detection (After Auth Ready)

**Triggers Recovery:**
- ❌ 3+ failures on `/api/auth/me` within 1 minute
- ❌ 3+ failures on `/api/refresh` within 1 minute

**Ignored:**
- ✅ 401s during bootstrap
- ✅ 401s on push endpoints
- ✅ 401s on optional endpoints
- ✅ Network errors during initial load

### 3. Single-Shot Recovery

**Rules:**
- ✅ Recovery can only trigger ONCE per session
- ✅ Subsequent triggers are ignored
- ✅ Reset only on full page reload by user

**Dev Mode:**
- ✅ Recovery is logged but NOT executed
- ✅ Allows observation without self-destruction

---

## 🚀 Benefits

### Before Circuit Breaker
- ❌ Continuous recovery loops
- ❌ Push status triggers auth instability
- ❌ Requests fire before auth ready
- ❌ False positive recovery triggers
- ❌ Infinite reloads in dev mode

### After Circuit Breaker
- ✅ Deterministic auth flow
- ✅ Push failures don't affect auth
- ✅ Requests blocked until auth ready
- ✅ Only real auth failures trigger recovery
- ✅ Dev mode allows debugging without loops

---

## 🔧 Debug Utilities

**Available in Dev Mode:**
```javascript
window.authCircuitBreaker.getState()      // Get current state
window.authCircuitBreaker.markReady()     // Manually mark auth ready
window.authCircuitBreaker.reset()         // Reset recovery state
window.authCircuitBreaker.isReady()       // Check if auth is ready
window.authCircuitBreaker.hasRecovered()  // Check if recovery triggered
```

---

## 🔥 ADDITIONAL PROTECTIONS (CRITICAL)

### 7. Backend forceReload Auto-Expiry (`server/routes/version.js`)

**Problem:**
- Admin can trigger `forceReload: true` via `/api/admin/debug/pwa/force-reload`
- This flag is returned by `/version/status` endpoint
- If flag is never reset, **ALL clients reload forever**

**Solution:**
- Add `forceReloadTimestamp` to track when flag was set
- Auto-expire flag after 5 minutes
- Prevents infinite reload loops

**Implementation:**
```javascript
// Auto-expire forceReload after 5 minutes
const FORCE_RELOAD_EXPIRY = 5 * 60 * 1000;

if (shouldForceReload && pwaControlState.forceReloadTimestamp) {
  const timeSinceTriggered = now - pwaControlState.forceReloadTimestamp;

  if (timeSinceTriggered > FORCE_RELOAD_EXPIRY) {
    pwaControlState.forceReload = false;
    pwaControlState.forceReloadTimestamp = null;
    shouldForceReload = false;
  }
}
```

---

### 8. Frontend Reload Loop Detection (`src/utils/emergencyRecovery.js`)

**Problem:**
- If backend keeps returning `forceReload: true`
- Or if version mismatch persists
- Frontend reloads infinitely

**Solution:**
- Track reload count in `sessionStorage`
- Abort after 3 reloads in 5 minutes
- Show alert to user

**Implementation:**
```javascript
const reloadCount = parseInt(sessionStorage.getItem('emergencyReloadCount') || '0', 10);
const lastReloadTime = parseInt(sessionStorage.getItem('lastEmergencyReload') || '0', 10);

// Reset counter if last reload was more than 5 minutes ago
if (now - lastReloadTime > 300000) {
  sessionStorage.setItem('emergencyReloadCount', '0');
}

// If we've reloaded 3+ times in 5 minutes, STOP
if (reloadCount >= 3) {
  alert('App is stuck in a reload loop. Please clear your browser cache manually.');
  return;
}
```

---

## ✅ Testing Checklist

- [ ] App boots without premature API calls
- [ ] Push status doesn't fire before auth ready
- [ ] Auth failures during bootstrap are ignored
- [ ] Auth failures after bootstrap trigger recovery (once)
- [ ] Recovery doesn't trigger in dev mode
- [ ] Logout resets circuit breaker state
- [ ] Login marks auth as ready
- [ ] Push failures don't trigger recovery
- [ ] **Backend forceReload auto-expires after 5 minutes**
- [ ] **Frontend detects reload loops and aborts after 3 attempts**
- [ ] **Admin can cancel forceReload manually**

---

## 📊 Success Metrics

**Expected Behavior:**
1. App boots → AuthContext hydrates → `markAuthReady()` called
2. All non-critical requests blocked until step 1 completes
3. Push status waits for auth ready
4. Auth failures during bootstrap are ignored
5. Auth failures after bootstrap are tracked
6. Recovery triggers ONCE if threshold exceeded
7. Dev mode logs recovery without executing

**Result:**
- ✅ No more continuous recovery loops
- ✅ Deterministic auth lifecycle
- ✅ Push is truly optional
- ✅ Site becomes usable again

