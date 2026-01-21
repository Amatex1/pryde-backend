# 🔧 CI Test Timeout Fix

## 🚨 Problem

CI tests are **timing out after 10 minutes** and being cancelled.

**Evidence:**
- GitHub Actions Run: https://github.com/Amatex1/pryde-backend/actions/runs/20923150982
- Job: "Run Tests (18.x)" and "Run Tests (20.x)"
- Status: **Cancelled** after 10 minutes
- Error: "The job has exceeded the maximum execution time of 10m0s"

---

## 🔍 Root Cause

The tests are **hanging** because they import `server.js` which:
1. Starts the full Express server
2. Connects to MongoDB
3. Initializes Socket.IO
4. Never exits

**Problematic Code:**
```javascript
// server/test/auth.test.js line 36
const serverModule = await import('../server.js');
app = serverModule.default || serverModule.app;
```

This causes the test process to hang indefinitely waiting for the server to close.

---

## ✅ Solution 1: Increase Timeout (Quick Fix)

**Update `.github/workflows/ci.yml`:**
```yaml
jobs:
  test:
    name: Run Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15  # Increased from 10 to 15
```

**Pros:**
- Quick fix
- No code changes needed

**Cons:**
- Doesn't solve root cause
- Tests still take too long

---

## ✅ Solution 2: Fix Test Setup (Recommended)

### Step 1: Export App from server.js

**Add to `server/server.js` (at the end):**
```javascript
// Export app for testing
export default app;
```

### Step 2: Create Separate Test Server

**Create `server/test/testServer.js`:**
```javascript
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Add only necessary middleware for tests
app.use(express.json());

// Import routes
import authRoutes from '../routes/auth.js';
import messageRoutes from '../routes/messages.js';

app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);

export default app;
```

### Step 3: Update Tests to Use Test Server

**Update `server/test/auth.test.js`:**
```javascript
// Replace line 36
const app = await import('./testServer.js');
```

---

## ✅ Solution 3: Add Test Timeout Guards

**Update `server/package.json`:**
```json
{
  "scripts": {
    "test": "mocha --require test/setup.js test/**/*.test.js --timeout 5000 --exit"
  }
}
```

**Key Changes:**
- `--timeout 5000` - Fail individual tests after 5 seconds
- `--exit` - Force exit after tests complete (prevents hanging)

---

## ✅ Solution 4: Skip Slow Tests in CI

**Add to `server/test/setup.js`:**
```javascript
// Skip integration tests in CI
if (process.env.CI) {
  console.log('[Test Setup] CI environment detected, skipping integration tests');
  process.env.SKIP_INTEGRATION_TESTS = 'true';
}
```

**Update integration tests:**
```javascript
describe('Integration Tests', function() {
  before(function() {
    if (process.env.SKIP_INTEGRATION_TESTS) {
      this.skip();
    }
  });
  // ... tests
});
```

---

## 🎯 Recommended Action Plan

1. **Immediate Fix (5 minutes):**
   - Add `--exit` flag to test script
   - Increase CI timeout to 15 minutes

2. **Short-term Fix (30 minutes):**
   - Create separate test server
   - Update tests to use test server
   - Add timeout guards

3. **Long-term Fix (2 hours):**
   - Refactor tests to not require full server
   - Add unit tests for individual functions
   - Add integration tests that properly clean up

---

## 📝 Implementation Steps

### Step 1: Quick Fix (Do This Now)

```bash
# Update package.json
cd server
npm pkg set scripts.test="mocha --require test/setup.js test/**/*.test.js --timeout 10000 --exit"
```

### Step 2: Update CI Workflow

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    timeout-minutes: 15
```

### Step 3: Test Locally

```bash
cd server
npm test
```

**Expected Output:**
```
  Authentication Tests
    POST /api/auth/signup
      ✓ should pass (123ms)
    ...

  15 passing (2s)
```

### Step 4: Commit and Push

```bash
git add server/package.json .github/workflows/ci.yml
git commit -m "fix: add --exit flag to tests to prevent hanging"
git push
```

---

## 🔍 Verification

After implementing the fix:

1. **Check CI:** https://github.com/Amatex1/pryde-backend/actions
2. **Verify tests complete** in < 5 minutes
3. **Verify all tests pass**
4. **Verify no timeout errors**

---

## 📊 Current Test Status

**Passing:**
- ✅ Lint Code
- ✅ Security Audit

**Failing:**
- ❌ Run Tests (18.x) - Timeout
- ❌ Run Tests (20.x) - Timeout
- ❌ All Checks Passed - Depends on tests

**After Fix:**
- ✅ All checks should pass

