# APM & Monitoring Readiness Plan

**Date:** 2026-01-12  
**Objective:** Plan APM, error tracking, and observability infrastructure  
**Status:** ✅ **FOUNDATION IN PLACE, READY FOR APM INTEGRATION**

---

## CURRENT MONITORING INFRASTRUCTURE ✅

### 1. Production Monitoring System
**File:** `server/utils/productionMonitoring.js`

**Metrics Tracked:**
- ✅ Unhandled exceptions
- ✅ Auth failures
- ✅ Socket errors
- ✅ Database errors
- ✅ Validation errors
- ✅ Slow queries (>1 second)
- ✅ Slow requests (>3 seconds)
- ✅ Cache hit/miss rates
- ✅ Socket connection health

**Status:** ✅ Comprehensive internal monitoring

### 2. Request Monitoring Middleware
**File:** `server/middleware/monitoring.js`

**Features:**
- ✅ Request duration tracking
- ✅ Error tracking
- ✅ Auth failure tracking
- ✅ Metrics endpoint (`/api/monitoring/metrics`)

**Status:** ✅ Active on all requests

### 3. Database Performance Monitoring
**Files:** `server/scripts/optimizeDatabase.js`, `server/dbConn.js`

**Features:**
- ✅ Slow query detection
- ✅ Index optimization
- ✅ Connection pool monitoring
- ✅ Query profiling support

**Status:** ✅ Database monitoring ready

---

## APM INTEGRATION PLAN

### Recommended APM Solutions

#### Option 1: Sentry (Recommended)
**Pros:**
- ✅ Excellent error tracking
- ✅ Performance monitoring
- ✅ Free tier (5K errors/month)
- ✅ Easy integration
- ✅ Source map support
- ✅ Release tracking

**Pricing:**
- Free: 5K errors/month
- Team: $26/month (50K errors)
- Business: $80/month (100K errors)

**Integration Effort:** 2-3 hours

#### Option 2: New Relic
**Pros:**
- ✅ Full APM suite
- ✅ Real-time dashboards
- ✅ Distributed tracing
- ✅ Custom metrics

**Pricing:**
- Free: 100GB/month
- Standard: $99/month
- Pro: $349/month

**Integration Effort:** 4-6 hours

#### Option 3: Datadog
**Pros:**
- ✅ Comprehensive monitoring
- ✅ Log aggregation
- ✅ Infrastructure monitoring
- ✅ Custom dashboards

**Pricing:**
- Free: 5 hosts
- Pro: $15/host/month
- Enterprise: $23/host/month

**Integration Effort:** 4-6 hours

---

## RECOMMENDED: SENTRY INTEGRATION

### Why Sentry?
1. ✅ Best error tracking in the industry
2. ✅ Free tier sufficient for MVP
3. ✅ Easy integration (2-3 hours)
4. ✅ Excellent React support
5. ✅ Performance monitoring included
6. ✅ Release tracking for deployments

### Implementation Steps

#### Step 1: Install Sentry (Backend)
```bash
cd server
npm install @sentry/node @sentry/profiling-node
```

#### Step 2: Configure Sentry (Backend)
```javascript
// server/config/sentry.js
import * as Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";

export function initSentry() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    
    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Profiling
    profilesSampleRate: 0.1,
    
    integrations: [
      new ProfilingIntegration(),
    ],
    
    // Release tracking
    release: process.env.RENDER_GIT_COMMIT || 'development',
    
    // Filter sensitive data
    beforeSend(event) {
      // Remove PII
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers?.authorization;
      }
      return event;
    },
  });
}
```

#### Step 3: Add to Server
```javascript
// server/server.js
import { initSentry } from './config/sentry.js';

// Initialize Sentry FIRST
if (process.env.NODE_ENV === 'production') {
  initSentry();
}

// ... rest of server setup
```

#### Step 4: Add Error Handler
```javascript
// server/server.js (at the end, after all routes)
import * as Sentry from "@sentry/node";

// Sentry error handler (must be before other error handlers)
app.use(Sentry.Handlers.errorHandler());

// Your custom error handler
app.use((err, req, res, next) => {
  // Error already sent to Sentry
  res.status(500).json({ message: 'Server error' });
});
```

#### Step 5: Install Sentry (Frontend)
```bash
cd ../src
npm install @sentry/react
```

#### Step 6: Configure Sentry (Frontend)
```javascript
// src/config/sentry.js
import * as Sentry from "@sentry/react";

export function initSentry() {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    
    // Performance Monitoring
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
    
    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    
    integrations: [
      new Sentry.BrowserTracing(),
      new Sentry.Replay(),
    ],
    
    // Release tracking
    release: import.meta.env.VITE_GIT_COMMIT || 'development',
  });
}
```

#### Step 7: Add to App
```javascript
// src/main.jsx
import { initSentry } from './config/sentry';

// Initialize Sentry FIRST
if (import.meta.env.MODE === 'production') {
  initSentry();
}

// ... rest of app setup
```

#### Step 8: Environment Variables
```bash
# Backend (.env)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Frontend (.env)
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
VITE_GIT_COMMIT=${RENDER_GIT_COMMIT}
```

---

## LOGGING INFRASTRUCTURE

### Current Logging
✅ Winston logger configured  
✅ Log levels: error, warn, info, debug  
✅ No PII in logs  
✅ Structured logging  

### Recommended: Centralized Logging

#### Option 1: Render Logs (Free)
**Pros:**
- ✅ Built-in to Render
- ✅ No additional cost
- ✅ Easy access via dashboard

**Cons:**
- ❌ Limited retention (7 days)
- ❌ No advanced search
- ❌ No alerting

#### Option 2: Logtail (Recommended)
**Pros:**
- ✅ Free tier (1GB/month)
- ✅ 30-day retention
- ✅ Advanced search
- ✅ Alerting
- ✅ Easy integration

**Pricing:**
- Free: 1GB/month
- Starter: $5/month (5GB)
- Pro: $25/month (25GB)

**Integration:**
```bash
npm install @logtail/node
```

```javascript
// server/config/logger.js
import { Logtail } from "@logtail/node";

const logtail = new Logtail(process.env.LOGTAIL_TOKEN);

export const logger = {
  info: (message, meta) => {
    console.log(message, meta);
    logtail.info(message, meta);
  },
  error: (message, meta) => {
    console.error(message, meta);
    logtail.error(message, meta);
  },
  // ... other levels
};
```

---

## UPTIME MONITORING

### Recommended: UptimeRobot (Free)
**Features:**
- ✅ Free tier (50 monitors)
- ✅ 5-minute checks
- ✅ Email/SMS alerts
- ✅ Status page

**Setup:**
1. Create account at uptimerobot.com
2. Add monitors:
   - `https://pryde-backend.onrender.com/health`
   - `https://pryde-frontend.onrender.com`
3. Configure alerts (email, SMS, Slack)

**Estimated Time:** 15 minutes

---

## METRICS DASHBOARD

### Current Metrics Endpoint
```bash
GET /api/monitoring/metrics
```

**Returns:**
```json
{
  "errors": { "unhandled": 0, "auth": 0, "socket": 0 },
  "socket": { "connections": 150, "disconnections": 10 },
  "cache": { "hits": 1000, "misses": 100, "hitRate": "90.9%" },
  "performance": { "slowQueries": 0, "slowRequests": 0 }
}
```

### Recommended: Grafana Dashboard (Optional)
**Use Case:** Real-time metrics visualization  
**Effort:** 6-8 hours  
**Priority:** LOW (nice-to-have)

---

## IMPLEMENTATION ROADMAP

### Phase 1: Error Tracking (2-3 hours) ✅ RECOMMENDED
- [ ] Install Sentry (backend + frontend)
- [ ] Configure Sentry
- [ ] Add error handlers
- [ ] Test error reporting
- [ ] Deploy to production

**Impact:** HIGH - Catch production errors immediately

### Phase 2: Uptime Monitoring (15 minutes) ✅ RECOMMENDED
- [ ] Create UptimeRobot account
- [ ] Add health check monitors
- [ ] Configure alerts
- [ ] Test alerts

**Impact:** HIGH - Know when site is down

### Phase 3: Centralized Logging (1-2 hours) ⏳ OPTIONAL
- [ ] Install Logtail
- [ ] Configure logger
- [ ] Test log aggregation
- [ ] Set up alerts

**Impact:** MEDIUM - Better debugging

### Phase 4: APM (4-6 hours) ⏳ OPTIONAL
- [ ] Choose APM solution (New Relic/Datadog)
- [ ] Install and configure
- [ ] Set up dashboards
- [ ] Configure alerts

**Impact:** MEDIUM - Performance insights

---

## ACCEPTANCE CRITERIA

✅ **Error Tracking**
- All production errors sent to Sentry
- No PII in error reports
- Release tracking enabled
- Source maps uploaded

✅ **Uptime Monitoring**
- Health checks every 5 minutes
- Alerts configured (email/SMS)
- Status page available

✅ **Logging**
- Centralized log aggregation
- 30-day retention
- Advanced search enabled
- Alerts for critical errors

✅ **Performance Monitoring**
- Slow queries tracked
- Slow requests tracked
- Cache performance monitored
- Socket health monitored

---

## CONCLUSION

**Pryde Social has solid monitoring foundation:**
- ✅ Internal metrics tracking
- ✅ Request monitoring
- ✅ Database performance monitoring
- ✅ Error tracking infrastructure

**Recommended Next Steps:**
1. ✅ **Integrate Sentry** (2-3 hours, HIGH impact)
2. ✅ **Set up UptimeRobot** (15 minutes, HIGH impact)
3. ⏳ **Add Logtail** (1-2 hours, MEDIUM impact)
4. ⏳ **Consider APM** (4-6 hours, MEDIUM impact)

**Status:** ✅ **READY FOR APM INTEGRATION**  
**Estimated Total Time:** 3-4 hours (Phases 1-2)  
**Confidence Level:** **VERY HIGH** 🚀

