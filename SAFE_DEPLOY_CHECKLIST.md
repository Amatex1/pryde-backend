# Safe Deploy Checklist — ENFORCED

**Date:** 2026-01-12  
**Objective:** Ensure zero-regression deployments to production  
**Status:** MANDATORY for all production deployments

---

## PRE-DEPLOYMENT CHECKLIST

### ✅ 1. CI Status

- [ ] **CI pipeline is GREEN** on main branch
- [ ] All tests passing (67/67)
- [ ] No skipped critical tests
- [ ] Security audit passed (or reviewed)
- [ ] Build check passed

**Verify:**
```bash
# Check GitHub Actions status
https://github.com/Amatex1/pryde-backend/actions

# Or run tests locally
cd server
npm test
# Expected: 67 passing (6s), 7 pending
```

**Acceptance:** ✅ All CI checks must be green

---

### ✅ 2. Code Review

- [ ] Pull request reviewed and approved
- [ ] All conversations resolved
- [ ] No merge conflicts
- [ ] Branch up to date with main

**Acceptance:** ✅ Code review complete

---

### ✅ 3. Migration Scripts

- [ ] Migration scripts reviewed
- [ ] Migrations tested locally
- [ ] Rollback plan documented
- [ ] No breaking schema changes

**Check migrations:**
```bash
cd server
ls -la migrations/scripts/
# Review each migration file
```

**Acceptance:** ✅ Migrations safe to run

---

### ✅ 4. Environment Variables

- [ ] Production env vars unchanged (unless documented)
- [ ] No new required env vars (or added to Render)
- [ ] No secrets in code
- [ ] .env.example updated if needed

**Verify on Render:**
```
https://dashboard.render.com/web/srv-d53m9q6r433s73cefo20
→ Environment tab
→ Verify all required vars present
```

**Acceptance:** ✅ Env vars correct

---

### ✅ 5. Dependencies

- [ ] No major version bumps without testing
- [ ] package-lock.json committed
- [ ] No security vulnerabilities (high/critical)

**Check:**
```bash
cd server
npm audit --audit-level=high
```

**Acceptance:** ✅ Dependencies safe

---

## DEPLOYMENT STEPS

### Step 1: Pull Latest Main

```bash
cd /path/to/pryde-backend
git checkout main
git pull origin main
```

**Verify:**
- Latest commit matches GitHub
- No local changes

---

### Step 2: Install Dependencies

```bash
cd server
npm ci  # Use ci, not install
```

**Verify:**
- No errors during install
- package-lock.json unchanged

---

### Step 3: Run Migrations (if any)

```bash
cd server
npm run migrate
```

**Verify:**
- Migrations complete successfully
- Database schema updated
- No errors in logs

**Rollback if needed:**
```bash
# Restore database from backup
# Or run rollback migration
```

---

### Step 4: Deploy Backend

**Render Auto-Deploy:**
- Push to main triggers auto-deploy
- Monitor deployment progress
- Wait for "Live" status

**Manual Deploy (if needed):**
```
1. Go to Render Dashboard
2. Click "Manual Deploy"
3. Select "Deploy latest commit"
4. Wait for completion
```

**Verify:**
- Deployment status: Live
- No build errors
- Service healthy

---

### Step 5: Monitor Logs

**Critical Metrics (First 10 Minutes):**

```bash
# Monitor Render logs
https://dashboard.render.com/web/srv-d53m9q6r433s73cefo20
→ Logs tab
```

**Watch for:**

1. **Auth 500 Errors** (MUST BE ZERO)
   ```
   Search logs for: "500" AND "auth"
   Expected: No results
   ```

2. **Socket Errors** (MUST BE ZERO)
   ```
   Search logs for: "socket" AND "error"
   Expected: No results
   ```

3. **Database Errors**
   ```
   Search logs for: "database" AND "error"
   Expected: No results
   ```

4. **Startup Success**
   ```
   Expected logs:
   ✅ MongoDB connected
   ✅ Server running on port 10000
   ✅ Socket.IO initialized
   ✅ System accounts ready
   ```

**Acceptance:** ✅ No errors in first 10 minutes

---

## POST-DEPLOYMENT VERIFICATION

### ✅ 1. Health Check

```bash
# Test health endpoint
curl https://pryde-backend.onrender.com/api/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2026-01-12T..."
}
```

---

### ✅ 2. Critical Endpoints

Test critical functionality:

```bash
# Test auth endpoint
curl -X POST https://pryde-backend.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Expected: 401 (not 500)
```

---

### ✅ 3. Socket Connection

```bash
# Test socket connection
# Use browser console:
const socket = io('https://pryde-backend.onrender.com');
socket.on('connect', () => console.log('✅ Connected'));
socket.on('error', (err) => console.error('❌ Error:', err));
```

**Expected:** Connection successful

---

### ✅ 4. Database Queries

```bash
# Check database connectivity
# Monitor logs for successful queries
# Expected: No "database connection" errors
```

---

### ✅ 5. Monitoring Metrics

Check production monitoring:

```bash
# Get metrics
curl https://pryde-backend.onrender.com/api/monitoring/metrics

# Expected metrics:
{
  "errors": {
    "unhandled": 0,
    "auth": 0,
    "socket": 0
  },
  "socket": {
    "connections": >0,
    "reconnects": <10
  },
  "cache": {
    "hitRate": ">50%"
  }
}
```

---

## ROLLBACK PROCEDURE

### When to Rollback

Rollback immediately if:
- ❌ Auth 500 errors detected
- ❌ Socket errors preventing connections
- ❌ Database errors
- ❌ Service crashes repeatedly
- ❌ Critical functionality broken

### How to Rollback

**Option 1: Render Dashboard (Fastest)**
```
1. Go to: https://dashboard.render.com/web/srv-d53m9q6r433s73cefo20
2. Click "Deployments" tab
3. Find previous stable deployment
4. Click "Redeploy"
5. Wait for deployment to complete
```

**Option 2: Git Revert**
```bash
# Revert the problematic commit
git revert HEAD
git push origin main

# Render will auto-deploy the reverted version
```

**Option 3: Database Rollback (if migration failed)**
```bash
# Restore from backup
# Or run rollback migration
npm run migrate:rollback
```

---

## SUCCESS CRITERIA

### ✅ Deployment Successful If:

1. ✅ CI pipeline green before deploy
2. ✅ Deployment completed without errors
3. ✅ Service status: Live
4. ✅ Health check passing
5. ✅ Auth 500 errors: 0
6. ✅ Socket errors: 0
7. ✅ Database errors: 0
8. ✅ Critical endpoints working
9. ✅ Monitoring metrics healthy
10. ✅ No rollback needed

---

## DEPLOYMENT LOG TEMPLATE

```markdown
# Deployment Log

**Date:** YYYY-MM-DD HH:MM UTC
**Deployer:** [Your Name]
**Commit:** [Commit SHA]
**Description:** [Brief description of changes]

## Pre-Deployment Checklist
- [x] CI green
- [x] Code reviewed
- [x] Migrations reviewed
- [x] Env vars verified
- [x] Dependencies checked

## Deployment Steps
- [x] Pulled latest main
- [x] Installed dependencies
- [x] Ran migrations (if any)
- [x] Deployed to Render
- [x] Monitored logs (10 min)

## Post-Deployment Verification
- [x] Health check: PASS
- [x] Auth endpoint: PASS
- [x] Socket connection: PASS
- [x] Database queries: PASS
- [x] Monitoring metrics: HEALTHY

## Issues Encountered
- None

## Rollback Required
- No

## Status
✅ DEPLOYMENT SUCCESSFUL
```

---

## MONITORING DASHBOARD

**Render Dashboard:**
https://dashboard.render.com/web/srv-d53m9q6r433s73cefo20

**GitHub Actions:**
https://github.com/Amatex1/pryde-backend/actions

**Production URL:**
https://pryde-backend.onrender.com

---

**Status:** ✅ CHECKLIST READY  
**Usage:** MANDATORY for all production deployments  
**Violations:** NOT PERMITTED

