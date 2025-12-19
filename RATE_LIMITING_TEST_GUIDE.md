# 🧪 RATE LIMITING TEST GUIDE

**Test Date:** 2025-12-19  
**Purpose:** Verify all rate limiting is working correctly  
**Environment:** Development/Staging

---

## 📋 PRE-TEST SETUP

### **1. Start the Server**
```bash
cd server
npm start
```

### **2. Get Authentication Token**
```bash
# Login to get JWT token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Save the token from response
export TOKEN="your_jwt_token_here"
```

### **3. Create Test Content**
```bash
# Create a test post to use for reactions/comments
curl -X POST http://localhost:5000/api/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Test post for rate limiting"}'

# Save the post ID from response
export POST_ID="post_id_here"
```

---

## 🧪 TEST SCENARIOS

### **TEST 1: Reaction Rate Limiting** ⭐ NEW

**Limit:** 60 reactions per minute (1 per second)

**Test Steps:**
```bash
# Send 61 reactions rapidly
for i in {1..61}; do
  echo "Reaction $i"
  curl -X POST http://localhost:5000/api/posts/$POST_ID/react \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"emoji":"❤️"}'
  echo ""
done
```

**Expected Result:**
- ✅ First 60 reactions succeed (200 OK)
- ✅ 61st reaction fails with 429 error
- ✅ Error message: "You are reacting too frequently. Please slow down."
- ✅ Response includes `retryAfter` field
- ✅ Log shows: `🚨 Rate limit exceeded - reaction`

---

### **TEST 2: Report Rate Limiting** ⭐ NEW

**Limit:** 10 reports per hour

**Test Steps:**
```bash
# Send 11 reports
for i in {1..11}; do
  echo "Report $i"
  curl -X POST http://localhost:5000/api/reports \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "reportType":"post",
      "reason":"spam",
      "reportedContent":"'$POST_ID'",
      "description":"Test report '$i'"
    }'
  echo ""
done
```

**Expected Result:**
- ✅ First 10 reports succeed (201 Created)
- ✅ 11th report fails with 429 error
- ✅ Error message: "You are submitting reports too frequently. Please slow down."
- ✅ Log shows: `🚨 Rate limit exceeded - report`

---

### **TEST 3: Comment Rate Limiting**

**Limit:** 20 comments per minute

**Test Steps:**
```bash
# Send 21 comments
for i in {1..21}; do
  echo "Comment $i"
  curl -X POST http://localhost:5000/api/posts/$POST_ID/comment \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"content":"Test comment '$i'"}'
  echo ""
done
```

**Expected Result:**
- ✅ First 20 comments succeed (200 OK)
- ✅ 21st comment fails with 429 error
- ✅ Error message: "You are commenting too frequently. Please slow down."
- ✅ Log shows: `🚨 Rate limit exceeded - comment`

---

### **TEST 4: Post Creation Rate Limiting**

**Limit:** 50 posts per hour

**Test Steps:**
```bash
# Send 51 posts (this will take a while)
for i in {1..51}; do
  echo "Post $i"
  curl -X POST http://localhost:5000/api/posts \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"content":"Test post '$i' for rate limiting"}'
  echo ""
done
```

**Expected Result:**
- ✅ First 50 posts succeed (201 Created)
- ✅ 51st post fails with 429 error
- ✅ Error message: "You are posting too frequently. Please slow down."
- ✅ Log shows: `🚨 Rate limit exceeded - post`

---

### **TEST 5: Message Rate Limiting**

**Limit:** 30 messages per minute

**Prerequisites:**
```bash
# Get another user's ID to send messages to
export RECIPIENT_ID="recipient_user_id_here"
```

**Test Steps:**
```bash
# Send 31 messages
for i in {1..31}; do
  echo "Message $i"
  curl -X POST http://localhost:5000/api/messages \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "recipient":"'$RECIPIENT_ID'",
      "content":"Test message '$i'"
    }'
  echo ""
done
```

**Expected Result:**
- ✅ First 30 messages succeed (201 Created)
- ✅ 31st message fails with 429 error
- ✅ Error message: "You are sending messages too quickly. Please slow down."
- ✅ Log shows: `🚨 Rate limit exceeded - message`

---

### **TEST 6: Rate Limit Headers**

**Test Steps:**
```bash
# Send a single reaction and check headers
curl -i -X POST http://localhost:5000/api/posts/$POST_ID/react \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"emoji":"👍"}'
```

**Expected Headers:**
```
RateLimit-Limit: 60
RateLimit-Remaining: 59
RateLimit-Reset: <timestamp>
```

**Verification:**
- ✅ `RateLimit-Limit` shows maximum allowed (60)
- ✅ `RateLimit-Remaining` decrements with each request
- ✅ `RateLimit-Reset` shows when limit resets

---

### **TEST 7: Rate Limit Reset**

**Test Steps:**
1. Trigger rate limit (e.g., send 61 reactions)
2. Wait for the window to expire (1 minute for reactions)
3. Send another reaction

**Expected Result:**
- ✅ After window expires, rate limit resets
- ✅ New requests succeed
- ✅ `RateLimit-Remaining` resets to maximum

---

### **TEST 8: Multiple Endpoint Rate Limits**

**Test Steps:**
```bash
# Test that different endpoints have independent limits
# Send 60 reactions
for i in {1..60}; do
  curl -s -X POST http://localhost:5000/api/posts/$POST_ID/react \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"emoji":"❤️"}' > /dev/null
done

# Then send 20 comments (should still work)
for i in {1..20}; do
  curl -s -X POST http://localhost:5000/api/posts/$POST_ID/comment \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"content":"Comment '$i'"}' > /dev/null
done
```

**Expected Result:**
- ✅ Reaction limit doesn't affect comment limit
- ✅ Each endpoint has independent rate limiting
- ✅ All 20 comments succeed even after hitting reaction limit

---

## 📊 LOG VERIFICATION

### **Check Server Logs**
```bash
# View rate limit violations
tail -f logs/app.log | grep "Rate limit exceeded"

# Count violations by type
grep "Rate limit exceeded" logs/app.log | grep -o "exceeded - [a-z_]*" | sort | uniq -c
```

**Expected Log Format:**
```
🚨 Rate limit exceeded - reaction {
  ip: '::1',
  userId: '507f1f77bcf86cd799439011',
  path: '/api/posts/123/react',
  method: 'POST',
  userAgent: 'curl/7.68.0',
  timestamp: '2025-12-19T10:30:00.000Z'
}
```

---

## 🔍 TROUBLESHOOTING

### **Issue: Rate Limit Not Triggering**

**Possible Causes:**
1. Server not restarted after changes
2. Using different IP addresses (e.g., VPN switching)
3. Rate limit window hasn't filled yet

**Solutions:**
```bash
# Restart server
npm restart

# Check if rate limiter is imported
grep "reactionLimiter\|reportLimiter" server/routes/*.js

# Verify middleware is applied
curl -i http://localhost:5000/api/posts/$POST_ID/react \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"emoji":"❤️"}' | grep RateLimit
```

---

### **Issue: All Requests Blocked**

**Possible Causes:**
1. Global rate limit exceeded (1000 requests per 15 minutes)
2. IP address changed mid-test
3. Server time misconfigured

**Solutions:**
```bash
# Wait 15 minutes for global limit to reset
# OR restart server to clear in-memory limits
npm restart

# Check server time
date
```

---

### **Issue: Logs Not Showing Violations**

**Possible Causes:**
1. Logger not configured
2. Log level too high
3. Logs going to different file

**Solutions:**
```bash
# Check logger configuration
grep "logger.warn" server/middleware/rateLimiter.js

# Check log file location
ls -la logs/

# Try console output
tail -f logs/combined.log
```

---

## ✅ TEST COMPLETION CHECKLIST

### **Rate Limiting Tests:**
- [ ] Reaction rate limiting works (60/min)
- [ ] Report rate limiting works (10/hour)
- [ ] Comment rate limiting works (20/min)
- [ ] Post rate limiting works (50/hour)
- [ ] Message rate limiting works (30/min)
- [ ] Rate limit headers present
- [ ] Rate limits reset after window
- [ ] Independent limits per endpoint

### **Error Handling:**
- [ ] 429 status code returned
- [ ] Error message is user-friendly
- [ ] `retryAfter` field included
- [ ] Standard rate limit headers present

### **Logging:**
- [ ] Violations logged with 🚨 emoji
- [ ] IP address logged
- [ ] User ID logged (when authenticated)
- [ ] Path and method logged
- [ ] Timestamp logged

### **User Experience:**
- [ ] Legitimate usage not blocked
- [ ] Error messages are clear
- [ ] No false positives
- [ ] Performance not degraded

---

## 📈 PERFORMANCE TESTING

### **Load Test: Concurrent Users**

**Test Steps:**
```bash
# Install Apache Bench (if not installed)
# sudo apt-get install apache-bench

# Test 100 concurrent users sending reactions
ab -n 1000 -c 100 -H "Authorization: Bearer $TOKEN" \
  -p reaction.json -T application/json \
  http://localhost:5000/api/posts/$POST_ID/react
```

**Expected Result:**
- ✅ Server handles concurrent requests
- ✅ Rate limiting applies per IP
- ✅ No server crashes or errors
- ✅ Response times remain consistent

---

## 🎯 SUCCESS CRITERIA

### **All Tests Must Pass:**
- ✅ Reaction rate limiting prevents spam (60/min)
- ✅ Report rate limiting prevents abuse (10/hour)
- ✅ Comment rate limiting prevents spam (20/min)
- ✅ Post rate limiting prevents spam (50/hour)
- ✅ Message rate limiting prevents spam (30/min)
- ✅ Proper 429 errors returned
- ✅ Rate limit violations logged
- ✅ Headers show limit status
- ✅ Limits reset after window
- ✅ No legitimate usage blocked

### **Production Readiness:**
- ✅ All tests pass in development
- ✅ No performance degradation
- ✅ Logs are clean and informative
- ✅ Error messages are user-friendly
- ✅ Documentation is complete

---

## 📞 NEXT STEPS

### **After Testing:**
1. ✅ Verify all tests pass
2. ✅ Review logs for any issues
3. ✅ Adjust limits if needed
4. ✅ Deploy to staging environment
5. ✅ Run tests in staging
6. ✅ Monitor for 24 hours
7. ✅ Deploy to production
8. ✅ Monitor production metrics

### **Monitoring in Production:**
```bash
# Track rate limit violations
grep "Rate limit exceeded" /var/log/pryde/app.log | wc -l

# Find top offending IPs
grep "Rate limit exceeded" /var/log/pryde/app.log | \
  grep -o "ip: '[^']*'" | sort | uniq -c | sort -rn | head -10

# Monitor specific violation types
grep "Rate limit exceeded - reaction" /var/log/pryde/app.log | wc -l
grep "Rate limit exceeded - report" /var/log/pryde/app.log | wc -l
```

---

## ✅ TEST GUIDE COMPLETE

**This guide covers all rate limiting test scenarios.**

Use this guide to verify that rate limiting is working correctly before deploying to production.


