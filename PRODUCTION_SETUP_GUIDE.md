# Production Setup Guide - Pryde Social

This guide walks you through deploying the three critical production services:
1. **Redis** - For caching and rate limiting
2. **Firebase** - For push notifications
3. **Load Testing** - Using Artillery

---

## 1. REDIS SETUP (Free Tier Available)

### Option A: Upstash (Recommended - Free Tier)

1. **Sign up at** https://upstash.com
2. **Create a new Redis database:**
   - Name: `pryde-social`
   - Region: Choose closest to your server
   - Enable "Eviction" if needed
3. **Copy the connection details** from the dashboard:
   - `REDIS_HOST` = Endpoint (e.g., `xxx.upstash.io`)
   - `REDIS_PORT` = `443` (for TLS) or `6379` (non-TLS)
   - `REDIS_PASSWORD` = Your password
   - `REDIS_TLS` = `true`

4. **Add to your Render/Render dashboard environment variables:**

```
REDIS_HOST=your-upstash-host.upstash.io
REDIS_PORT=443
REDIS_PASSWORD=your-password
REDIS_TLS=true
```

### Option B: Redis Cloud (Free Tier)

1. **Sign up at** https://redis.com/cloud
2. **Create free database** (30MB limit)
3. **Get connection string** and parse into env vars

### Option C: Railway (Has Free Tier)

1. **Sign up at** https://railway.app
2. **Create new project** → Add Redis plugin
3. **Get connection details** from Railway dashboard

---

## 2. FIREBASE SETUP

### Step 1: Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click "Add project"
3. Enter name: `pryde-social`
4. Disable Google Analytics (optional)
5. Click "Create project"

### Step 2: Enable Cloud Messaging

1. In Firebase console, go to **Project Settings**
2. Scroll to **Your apps** → Click the web icon (`</>`)
3. Register app: `Pryde Social Web`
4. Copy the `firebaseConfig` object (we'll use it later)

### Step 3: Get Service Account JSON

1. In Project Settings → **Service accounts**
2. Click "Generate new private key"
3. Save the JSON file securely

### Step 4: Add Environment Variables

**Option A: JSON directly (for small configs)**
```
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
```

**Option B: File path (recommended)**
```
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```
Place the JSON file in your server directory and add to `.gitignore`!

### Step 5: Generate VAPID Keys (Web Push)

Run this command:
```
bash
npx web-push generate-vapid-keys
```

You'll get:
- Public key (share with frontend)
- Private key (keep secret)

Add to environment:
```
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
VAPID_SUBJECT=mailto:contact@prydesocial.com
```

### Step 6: Configure Frontend

Update your Firebase config in frontend:
```
javascript
// In your firebase initialization file
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "pryde-social.firebaseapp.com",
  projectId: "pryde-social",
  storageBucket: "pryde-social.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

---

## 3. LOAD TESTING (Artillery)

### Prerequisites

```
bash
# Install Artillery globally
npm install -g artillery

# Or use local installation
cd pryde-backend
npm install
```

### Create Test Configuration

Create `tests/load/feed-load.yml`:

```
yaml
config:
  target: "https://your-production-api.prydesocial.com"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Sustained load"
    - duration: 60
      arrivalRate: 100
      name: "Stress test"
  processor: "./load-processor.js"
  
scenarios:
  - name: "Feed browsing"
    flow:
      - post:
          url: "/api/auth/login"
          json:
            username: "testuser"
            password: "testpass"
          capture:
            - json: "$.token"
              as: "authToken"
      
      - get:
          url: "/api/feed?page=1&limit=20"
          headers:
            Authorization: "Bearer {{ authToken }}"
          
      - get:
          url: "/api/users/profile"
          headers:
            Authorization: "Bearer {{ authToken }}"
```

### Create Load Test Processor

Create `tests/load/load-processor.js`:

```
javascript
const { faker } = require('@faker-js/faker');

module.exports = {
  generateUser: () => {
    return {
      username: faker.internet.userName(),
      email: faker.internet.email(),
      password: 'TestPass123!'
    };
  }
};
```

### Run Load Tests

```
bash
# Basic load test
artillery run tests/load/feed-load.yml

# With reporting
artillery run tests/load/feed-load.yml --report json --output test-results.json

# Socket.IO load test (if you have socket tests)
artillery run tests/load/socket-load.yml
```

### Interpreting Results

**Key Metrics to Watch:**
- `p95 response time` - Should be < 500ms
- `p99 response time` - Should be < 1000ms  
- `error rate` - Should be < 1%
- `throughput` - Requests per second

**Recommended Thresholds:**
| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| p95 latency | < 200ms | 200-500ms | > 500ms |
| Error rate | < 0.1% | 0.1-1% | > 1% |
| Throughput | > 100 rps | 50-100 rps | < 50 rps |

---

## 4. VERIFICATION CHECKLIST

After completing setup, verify each service:

### Redis Verification

Check your server logs for:
```
✅ Redis connected successfully for feed caching
✅ Redis rate limiting active
```

Or test manually:
```
bash
# Connect to Redis and ping
redis-cli -h your-redis-host -p your-port -a your-password ping
# Should return: PONG
```

### Firebase Verification

Check your server logs for:
```
✅ Firebase initialized successfully
```

Test push notifications via API:
```
bash
curl -X POST https://your-api.com/api/push/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"TARGET_USER_ID","title":"Test","body":"Push works!"}'
```

### Load Test Verification

Expected results for 100 concurrent users:
- Feed API: < 300ms p95
- No 5xx errors
- Redis cache hit rate: > 70%

---

## 5. ENVIRONMENT VARIABLES SUMMARY

Add these to your production environment:

```
env
# Redis
REDIS_HOST=your-redis-host
REDIS_PORT=443
REDIS_PASSWORD=your-password
REDIS_TLS=true

# Firebase
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:contact@prydesocial.com
```

---

## 6. MONITORING RECOMMENDATIONS

### Redis Monitoring
- Set up Upstash/Redis Cloud dashboard alerts
- Monitor: memory usage, connection count, hit rate

### Firebase Monitoring  
- Firebase Console → Cloud Messaging → Analytics
- Monitor: delivery rate, open rate

### Application Monitoring
- Use Render's built-in metrics
- Consider: Datadog, New Relic, or PM2 Plus

---

## NEED HELP?

If you encounter issues:

1. **Redis connection fails**: Check firewall rules, ensure correct port
2. **Firebase not working**: Verify service account JSON is valid
3. **Load tests fail**: Ensure API is accessible, check rate limits

---

*Generated: 2025-01-01*
*Pryde Social Platform v1.0*
