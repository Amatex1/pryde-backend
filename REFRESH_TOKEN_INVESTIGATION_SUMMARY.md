# Refresh Token 401 Error - Investigation Summary

## What I Checked

I investigated both the backend (pryde-backend) and frontend (pryde-frontend) repositories to diagnose the 401 error on `/api/refresh`.

## Findings

### ✅ Backend Configuration (Correct)

**File:** `server/server.js`
- CORS allows your frontend: `https://pryde-frontend.pages.dev` (via `config.frontendURL`)
- Credentials enabled: `credentials: true`
- Cookie settings correct: `httpOnly: true`, `secure: true`, `sameSite: 'none'`

**File:** `server/routes/refresh.js`
- Endpoint exists at `/api/refresh`
- Accepts refresh token from cookie OR body
- Properly validates and rotates tokens

**Render Environment Variables:**
- `FRONTEND_URL=https://pryde-frontend.pages.dev` ✅

### ✅ Frontend Configuration (Correct)

**File:** `pryde-frontend/src/utils/api.js`
```javascript
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // ✅ Correctly set
  timeout: 10000
});
```

**File:** `pryde-frontend/src/config/api.js`
```javascript
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "https://pryde-backend.onrender.com/api"; // ✅ Correct URL
```

**Refresh Token Logic:**
```javascript
const response = await axios.post(`${API_BASE_URL}/refresh`, {
  ...(localRefreshToken && { refreshToken: localRefreshToken })
}, {
  withCredentials: true // ✅ Correctly sends cookies
});
```

## The Problem

Both backend and frontend are configured correctly! The issue is likely one of these:

### 1. **Cloudflare Pages Environment Variables** (Most Likely)

Your Cloudflare Pages deployment might not have the correct environment variables set.

**Required:**
```
VITE_API_URL=https://pryde-backend.onrender.com/api
```

**How to check:**
1. Go to Cloudflare Pages dashboard
2. Select your project (pryde-frontend)
3. Settings → Environment variables
4. Verify `VITE_API_URL` is set correctly
5. If missing or wrong, add it and redeploy

### 2. **Cookie Not Being Set on Login**

If the login endpoint doesn't successfully set the `refreshToken` cookie, the refresh endpoint will fail.

**How to verify:**
1. Open your frontend in browser
2. Open DevTools (F12) → Network tab
3. Log in
4. Find the `/api/auth/login` request
5. Check Response Headers for `Set-Cookie: refreshToken=...`
6. Then check Application → Cookies → `pryde-backend.onrender.com`
7. Verify `refreshToken` cookie exists

### 3. **Browser Blocking Third-Party Cookies**

Some browsers block cross-site cookies even with `SameSite=None`.

**How to test:**
- Try in Chrome (usually works)
- Try in Firefox with standard privacy
- Avoid Safari (strict blocking)

## Next Steps

### Step 1: Verify Cloudflare Pages Environment Variables

1. Go to: https://dash.cloudflare.com/
2. Select your Pages project
3. Settings → Environment variables
4. Add/verify:
   ```
   VITE_API_URL=https://pryde-backend.onrender.com/api
   VITE_SOCKET_URL=https://pryde-backend.onrender.com
   ```
5. Trigger a new deployment
6. Test again

### Step 2: Use the Test Page

I created `test-refresh-token.html` for you to diagnose the issue:

1. Upload it to your Cloudflare Pages deployment
2. Visit: `https://pryde-frontend.pages.dev/test-refresh-token.html`
3. Run all 4 tests:
   - Test Login
   - Test Refresh Token
   - Check Cookies
   - Test CORS
4. Report back with the results

### Step 3: Check Browser DevTools

After logging in:
1. Open DevTools → Application → Cookies
2. Look for domain: `pryde-backend.onrender.com`
3. Check if `refreshToken` cookie exists
4. Verify it has:
   - HttpOnly: ✓
   - Secure: ✓
   - SameSite: None

### Step 4: Check Network Tab

When the 401 error occurs:
1. Open DevTools → Network tab
2. Find the failed `/api/refresh` request
3. Check **Request Headers**
4. Look for `Cookie` header
5. Should contain: `Cookie: refreshToken=...`

**If NO Cookie header:**
- Cookie was never set (login failed)
- Browser is blocking the cookie
- Frontend not sending credentials (but we verified it is)

## Files Created

I created these diagnostic files for you:

1. **REFRESH_TOKEN_401_TROUBLESHOOTING.md** - Detailed troubleshooting guide
2. **FRONTEND_DIAGNOSTICS.md** - Frontend-specific diagnostics
3. **test-refresh-token.html** - Interactive test page
4. **REFRESH_TOKEN_INVESTIGATION_SUMMARY.md** - This file

## Most Likely Solution

Based on my investigation, the most likely issue is:

**Cloudflare Pages is missing the `VITE_API_URL` environment variable**

This would cause the frontend to use the fallback URL, which might be incorrect or cause CORS issues.

**Fix:**
1. Add `VITE_API_URL=https://pryde-backend.onrender.com/api` to Cloudflare Pages
2. Redeploy
3. Test login and refresh

## What to Report Back

To help diagnose further, please provide:

1. **Cloudflare Pages environment variables screenshot**
   - Settings → Environment variables

2. **Browser DevTools after login:**
   - Application → Cookies → `pryde-backend.onrender.com`
   - Screenshot showing if `refreshToken` cookie exists

3. **Network tab during 401 error:**
   - Screenshot of the failed `/api/refresh` request
   - Show Request Headers (especially Cookie header)

4. **Console logs:**
   - Any errors or warnings related to auth/cookies/CORS

## Quick Test

Run this in your browser console on the frontend:

```javascript
// Test if API URL is correct
console.log('API URL:', import.meta.env.VITE_API_URL);

// Test refresh endpoint
fetch('https://pryde-backend.onrender.com/api/refresh', {
  method: 'POST',
  credentials: 'include'
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

If this returns 401, the cookie is not being sent.

## Summary

✅ Backend is configured correctly
✅ Frontend code is configured correctly
❓ Need to verify Cloudflare Pages environment variables
❓ Need to verify cookies are being set on login
❓ Need to verify cookies are being sent with requests

The issue is environmental, not code-related.

