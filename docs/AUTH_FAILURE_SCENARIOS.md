# Auth Failure Scenarios & Recovery

**Phase 4D Documentation** - Stability Closure

This document describes expected behavior during auth failures and how to verify recovery.

---

## Failure Scenario: Refresh Endpoint Unavailable

### Cause
- Backend service restart/deployment
- Network partition
- MongoDB unavailable
- Rate limiting triggered

### Expected Frontend Behavior

| Behavior | Status |
|----------|--------|
| No infinite refresh loop | ✅ Circuit breaker trips after 3 failures |
| No forced logout | ✅ Auth state preserved until user action |
| Graceful degradation | ✅ "Safe mode" entered automatically |
| User notification | ✅ Toast shown: "Connection issues detected" |

### What Safe Mode Does

1. **Stops refresh attempts** - No more API calls until conditions improve
2. **Preserves session** - User stays logged in with stale access token
3. **Read-only experience** - User can browse but writes may fail
4. **Auto-recovery** - Resumes normal operation when endpoint returns

### Recovery Sequence

```
1. Circuit breaker OPEN (failures exceed threshold)
2. Frontend shows "Connection issues" toast
3. Background ping starts (exponential backoff)
4. Backend returns healthy
5. Circuit breaker HALF-OPEN (test request)
6. Success → Circuit breaker CLOSED
7. Normal refresh resumes
```

---

## Developer Testing Guide

### How to Simulate Refresh Failure

**Option 1: Block endpoint (recommended)**
```javascript
// In browser console (frontend)
window.__MOCK_REFRESH_FAILURE__ = true;
// Refresh failures will be simulated
```

**Option 2: Network DevTools**
1. Open DevTools → Network tab
2. Right-click → "Block request URL"
3. Add pattern: `*/api/auth/refresh`
4. Trigger refresh (wait for access token expiry or close/reopen tab)

**Option 3: Backend disable**
```bash
# Temporarily return 503 from refresh endpoint
# In refresh.js, add at top of handler:
# return res.status(503).json({ message: 'Service unavailable' });
```

### How to Confirm Recovery

1. **Check circuit breaker state**
   ```javascript
   // In browser console
   console.log(window.__AUTH_CIRCUIT_BREAKER_STATE__);
   // Should show: { state: 'OPEN', failures: 3, lastFailure: ... }
   ```

2. **Observe recovery**
   - Remove the block/mock
   - Wait for backoff interval (starts at 5s, doubles each attempt)
   - Watch for "Connection restored" toast
   - Verify normal API calls resume

3. **Check metrics (backend logs)**
   ```
   [auth:refresh] FAILURE userId=xxx sessionId=xxx reason=network_error
   [auth:circuit_breaker] TRIP reason=consecutive_failures count=3
   [auth:circuit_breaker] RECOVER after=45s
   ```

---

## Metrics to Monitor

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| `auth.refresh.failure` | < 1/min | 1-5/min | > 5/min |
| `auth.circuit_breaker.trips` | 0 | 1-2/day | > 5/day |
| `auth.session.not_found` | < 1/min | 1-5/min | > 5/min |

---

## Related Files

- `server/routes/refresh.js` - Refresh endpoint
- `server/utils/authMetrics.js` - Observability counters
- Frontend: `src/stores/authStore.js` - Circuit breaker logic
- Frontend: `src/utils/authCircuitBreaker.js` - Implementation

---

*Last updated: Phase 4 Production Hardening*

