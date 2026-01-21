# Testing Auto-Reactivation Feature

## Quick Test Guide

### Prerequisites
- Backend deployed and running
- Test account credentials ready
- Access to browser DevTools

## Test 1: Standard Email/Password Login

### Step 1: Deactivate Account
```bash
# Using curl or Postman
curl -X PUT https://pryde-backend.onrender.com/api/users/deactivate \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "message": "Account deactivated successfully"
}
```

### Step 2: Verify Deactivation
```bash
# Try to refresh token (should fail)
curl -X POST https://pryde-backend.onrender.com/api/refresh \
  -H "Content-Type: application/json" \
  --cookie "refreshToken=YOUR_REFRESH_TOKEN"
```

**Expected Response:**
```json
{
  "message": "Account deactivated",
  "code": "ACCOUNT_DEACTIVATED"
}
```

### Step 3: Log In Again
```bash
curl -X POST https://pryde-backend.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "uncsnephews4@hotmail.com",
    "password": "your-password"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "accessToken": "eyJ...",
  "user": {
    "id": "...",
    "username": "...",
    "isActive": true
  }
}
```

### Step 4: Check Server Logs
Look for this message in Render logs:
```
✅ Account auto-reactivated for user: YourUsername (uncsnephews4@hotmail.com)
```

### Step 5: Verify Account is Active
```bash
curl -X GET https://pryde-backend.onrender.com/api/auth/me \
  -H "Authorization: Bearer YOUR_NEW_ACCESS_TOKEN"
```

**Expected Response:**
```json
{
  "id": "...",
  "username": "...",
  "isActive": true,
  "deactivatedAt": null
}
```

## Test 2: Wrong Password (Should NOT Reactivate)

### Step 1: Deactivate Account Again
```bash
curl -X PUT https://pryde-backend.onrender.com/api/users/deactivate \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Step 2: Try Login with Wrong Password
```bash
curl -X POST https://pryde-backend.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "uncsnephews4@hotmail.com",
    "password": "wrong-password"
  }'
```

**Expected Response:**
```json
{
  "message": "Invalid email or password",
  "attemptsLeft": 4
}
```

### Step 3: Verify Account is Still Deactivated
```bash
# Try to login with correct password now
curl -X POST https://pryde-backend.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "uncsnephews4@hotmail.com",
    "password": "correct-password"
  }'
```

**Expected:** Should succeed and auto-reactivate

## Test 3: Browser Test

### Step 1: Open Frontend
Go to: `https://pryde-frontend.pages.dev`

### Step 2: Deactivate Account
1. Log in
2. Go to Settings → Account
3. Click "Deactivate Account"
4. Confirm deactivation
5. You'll be logged out

### Step 3: Try to Log In Again
1. Go to login page
2. Enter your email and password
3. Click "Log In"

**Expected:**
- ✅ Login succeeds
- ✅ You're redirected to feed/home
- ✅ No error messages
- ✅ Account is active again

### Step 4: Check Browser Console
Open DevTools → Console

Look for:
```
✅ Login successful
```

No errors about deactivated account.

### Step 5: Check Application Tab
DevTools → Application → Cookies → `pryde-backend.onrender.com`

**Expected:**
- `refreshToken` cookie exists
- Cookie is valid and not expired

## Test 4: Real-Time Event Test

If you have an admin panel or Socket.IO listener:

### Step 1: Connect to Socket.IO
```javascript
const socket = io('https://pryde-backend.onrender.com');

socket.on('user_reactivated', (data) => {
  console.log('User reactivated:', data);
});
```

### Step 2: Deactivate and Reactivate
1. Deactivate account
2. Log in again

**Expected Event:**
```javascript
{
  userId: "...",
  username: "YourUsername",
  automatic: true,
  timestamp: "2025-01-22T..."
}
```

## Verification Checklist

After testing, verify:

- [ ] Deactivated account can log in with correct password
- [ ] Account is automatically reactivated on successful login
- [ ] Wrong password does NOT reactivate account
- [ ] Server logs show reactivation message
- [ ] Real-time event is emitted (if admin panel exists)
- [ ] Refresh token works after reactivation
- [ ] User can access protected routes after reactivation
- [ ] `isActive` is set to `true` in database
- [ ] `deactivatedAt` is set to `null` in database

## Database Verification

Connect to MongoDB and check:

```javascript
db.users.findOne({ email: "uncsnephews4@hotmail.com" }, {
  isActive: 1,
  deactivatedAt: 1,
  username: 1
})
```

**Expected:**
```javascript
{
  "_id": ObjectId("..."),
  "username": "YourUsername",
  "isActive": true,
  "deactivatedAt": null
}
```

## Troubleshooting

### Issue: Login still returns 403
**Cause:** Old code still deployed
**Solution:** Redeploy backend on Render

### Issue: Account not reactivating
**Cause:** Password is wrong
**Solution:** Verify password is correct

### Issue: No server logs
**Cause:** Logger not working
**Solution:** Check Render logs dashboard

### Issue: Real-time event not received
**Cause:** Socket.IO not connected
**Solution:** Verify Socket.IO connection is established

## Success Criteria

✅ **Test passes if:**
1. Deactivated user can log in with correct credentials
2. Account is automatically reactivated
3. User can access all features after reactivation
4. Server logs confirm reactivation
5. No errors in browser console

❌ **Test fails if:**
1. Login returns 403 "Account deactivated"
2. Account remains deactivated after login
3. Errors appear in console or logs
4. User cannot access protected routes

