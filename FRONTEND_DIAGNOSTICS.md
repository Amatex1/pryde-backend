# Frontend Diagnostics for 401 Refresh Error

## Summary

I've checked your frontend code and found:

✅ **Frontend is configured correctly:**
- `withCredentials: true` is set in axios config
- API base URL points to correct backend
- Refresh token logic is properly implemented

## The Issue

Since the frontend configuration is correct, the 401 error is likely caused by one of these:

### 1. **Cookies Not Being Set on Login** (Most Likely)

When a user logs in, the backend should set a `refreshToken` cookie. If this cookie is never set, the refresh endpoint will return 401.

**How to verify:**
1. Open your frontend in browser
2. Open DevTools → Application → Cookies
3. Log in with valid credentials
4. Check if there's a `refreshToken` cookie for domain `pryde-backend.onrender.com`

**If NO cookie:**
- Login endpoint failed
- Browser blocked the cookie
- CORS issue preventing cookie from being set

### 2. **Cloudflare Pages Environment Variables**

Your Cloudflare Pages deployment needs these environment variables:

```
VITE_API_URL=https://pryde-backend.onrender.com/api
VITE_SOCKET_URL=https://pryde-backend.onrender.com
```

**How to verify:**
1. Go to Cloudflare Pages dashboard
2. Select your project
3. Settings → Environment variables
4. Check if `VITE_API_URL` is set correctly

**If missing or wrong:**
- Frontend will call wrong backend URL
- Cookies won't work across domains

### 3. **Browser Blocking Third-Party Cookies**

Some browsers block cookies from different domains even with `SameSite=None`.

**How to test:**
1. Try in Chrome (usually works)
2. Try in Firefox with standard privacy settings
3. Avoid Safari (strict cookie blocking)

### 4. **Refresh Token Already Expired**

If the user hasn't logged in for 30+ days, the refresh token expires.

**Solution:** User needs to log in again

## Debugging Steps

### Step 1: Check Login Response

1. Open DevTools → Network tab
2. Log in
3. Find the `/api/auth/login` request
4. Check **Response Headers** for `Set-Cookie`
5. Should see: `Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=None`

**If NO Set-Cookie header:**
- Backend login endpoint has an issue
- Check Render logs for errors

### Step 2: Check Cookie Storage

After login, check DevTools → Application → Cookies:

**Expected:**
- Domain: `pryde-backend.onrender.com`
- Name: `refreshToken`
- Value: Long JWT string
- HttpOnly: ✓
- Secure: ✓
- SameSite: None

**If cookie missing:**
- Browser blocked it
- Login failed silently
- CORS issue

### Step 3: Check Refresh Request

1. Wait 15 minutes (or force a 401 by clearing access token)
2. Make any API request
3. Check Network tab for `/api/refresh` request
4. Check **Request Headers** for `Cookie: refreshToken=...`

**If NO Cookie header:**
- Frontend not sending cookies (but we verified `withCredentials: true`)
- Cookie was cleared
- Browser blocking third-party cookies

### Step 4: Check Console Logs

Look for these log messages:
- `🔄 Token expired, attempting refresh via httpOnly cookie...`
- `✅ Token refreshed successfully via httpOnly cookie`
- `❌ Token refresh failed: ...`

## Quick Fix Checklist

- [ ] Cloudflare Pages has correct `VITE_API_URL` environment variable
- [ ] User successfully logged in (check Network tab for login response)
- [ ] `refreshToken` cookie exists in browser (check Application → Cookies)
- [ ] Cookie has correct attributes (HttpOnly, Secure, SameSite=None)
- [ ] Browser allows third-party cookies (test in Chrome)
- [ ] No CORS errors in console
- [ ] Backend `FRONTEND_URL` matches Cloudflare Pages URL

## Testing in Production

### Test 1: Manual Login Test
```javascript
// Open browser console on your frontend
// Run this after logging in:
document.cookie.split(';').forEach(c => console.log(c.trim()));
// Should NOT see refreshToken (it's HttpOnly)

// Check if it exists:
fetch('https://pryde-backend.onrender.com/api/auth/me', {
  credentials: 'include'
}).then(r => r.json()).then(console.log);
```

### Test 2: Manual Refresh Test
```javascript
// Force a refresh token call:
fetch('https://pryde-backend.onrender.com/api/refresh', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' }
}).then(r => r.json()).then(console.log).catch(console.error);
```

If this returns 401, the cookie is not being sent.

## Most Likely Solutions

### Solution 1: Rebuild Frontend with Correct Env Vars

On Cloudflare Pages:
1. Go to Settings → Environment variables
2. Add/update:
   ```
   VITE_API_URL=https://pryde-backend.onrender.com/api
   ```
3. Trigger a new deployment
4. Test login again

### Solution 2: Update Backend FRONTEND_URL

On Render:
1. Go to Environment variables
2. Update:
   ```
   FRONTEND_URL=https://pryde-frontend.pages.dev
   ```
3. Redeploy backend
4. Test login again

### Solution 3: Clear Browser Data

Sometimes old cookies cause issues:
1. Open DevTools → Application → Storage
2. Click "Clear site data"
3. Refresh page
4. Log in again

## Next Steps

1. **Check Cloudflare Pages environment variables** - This is most likely the issue
2. **Test login in browser** with DevTools open
3. **Verify cookie is set** after login
4. **Report back** with:
   - Does login set a `refreshToken` cookie?
   - What's the exact error message in console?
   - Screenshot of Network tab showing the failed `/api/refresh` request

## Contact Points

If issue persists, provide:
1. Screenshot of Cloudflare Pages environment variables
2. Screenshot of browser cookies after login
3. Screenshot of Network tab showing `/api/refresh` request headers
4. Console logs during login and refresh attempt

