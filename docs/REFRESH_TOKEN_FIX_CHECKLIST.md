# Refresh Token 401 Error - Fix Checklist

Use this checklist to systematically diagnose and fix the refresh token issue.

## ✅ Pre-Flight Checks

- [ ] Backend is deployed and running on Render
- [ ] Frontend is deployed and running on Cloudflare Pages
- [ ] You can access both URLs in browser

## 🔧 Step 1: Verify Cloudflare Pages Environment Variables

**Why:** If `VITE_API_URL` is missing or wrong, the frontend won't call the correct backend.

- [ ] Go to Cloudflare Pages dashboard
- [ ] Select your project (pryde-frontend)
- [ ] Click Settings → Environment variables
- [ ] Verify these variables exist:
  ```
  VITE_API_URL=https://pryde-backend.onrender.com/api
  VITE_SOCKET_URL=https://pryde-backend.onrender.com
  ```
- [ ] If missing or wrong, add/update them
- [ ] Trigger a new deployment (Settings → Deployments → Retry deployment)
- [ ] Wait for deployment to complete

**Expected Result:** Frontend now uses correct backend URL

## 🔧 Step 2: Verify Render Environment Variables

**Why:** Backend needs to know which frontend URL to allow.

- [ ] Go to Render dashboard
- [ ] Select your backend service (pryde-backend)
- [ ] Click Environment
- [ ] Verify this variable exists:
  ```
  FRONTEND_URL=https://pryde-frontend.pages.dev
  ```
- [ ] If missing or wrong, add/update it
- [ ] Render will auto-redeploy

**Expected Result:** Backend allows requests from your frontend

## 🧪 Step 3: Test Login

**Why:** Refresh token must be set during login.

- [ ] Open your frontend in Chrome (best for testing)
- [ ] Open DevTools (F12)
- [ ] Go to Network tab
- [ ] Clear all network logs
- [ ] Log in with valid credentials
- [ ] Find the `/api/auth/login` request in Network tab
- [ ] Click on it
- [ ] Check Response Headers
- [ ] Look for `Set-Cookie` header
- [ ] Should see: `Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=None`

**Expected Result:** Login response includes Set-Cookie header

**If NOT:**
- Login endpoint failed
- Check Render logs for errors
- Verify credentials are correct

## 🧪 Step 4: Verify Cookie Storage

**Why:** Browser must store the cookie for it to be sent later.

- [ ] After successful login, stay in DevTools
- [ ] Go to Application tab
- [ ] Expand "Cookies" in left sidebar
- [ ] Look for `pryde-backend.onrender.com`
- [ ] Click on it
- [ ] Look for `refreshToken` cookie
- [ ] Verify these attributes:
  - Name: `refreshToken`
  - Value: Long JWT string (starts with `eyJ...`)
  - Domain: `pryde-backend.onrender.com`
  - Path: `/`
  - Expires: ~30 days from now
  - HttpOnly: ✓
  - Secure: ✓
  - SameSite: `None`

**Expected Result:** Cookie exists with correct attributes

**If NOT:**
- Browser blocked the cookie
- Try different browser (Chrome recommended)
- Check browser privacy settings
- Disable ad blockers/privacy extensions

## 🧪 Step 5: Test Refresh Endpoint

**Why:** Verify the refresh endpoint receives the cookie.

- [ ] Stay logged in
- [ ] Open DevTools → Network tab
- [ ] Clear network logs
- [ ] Run this in Console:
  ```javascript
  fetch('https://pryde-backend.onrender.com/api/refresh', {
    method: 'POST',
    credentials: 'include'
  }).then(r => r.json()).then(console.log).catch(console.error);
  ```
- [ ] Check Network tab for `/api/refresh` request
- [ ] Click on the request
- [ ] Check Request Headers
- [ ] Look for `Cookie` header
- [ ] Should see: `Cookie: refreshToken=eyJ...`

**Expected Result:** Request includes Cookie header with refreshToken

**If 200 OK:**
✅ Everything works! The issue might be intermittent.

**If 401 Unauthorized:**
- Check if `Cookie` header is present in Request Headers
- If NO Cookie header: Browser is not sending the cookie
- If Cookie header present: Token is invalid/expired

## 🧪 Step 6: Test with Diagnostic Page

**Why:** Automated testing of all components.

- [ ] Upload `test-refresh-token.html` to your Cloudflare Pages
- [ ] Visit: `https://pryde-frontend.pages.dev/test-refresh-token.html`
- [ ] Run "Test Login" with your credentials
- [ ] Check results
- [ ] Run "Test Refresh Token"
- [ ] Check results
- [ ] Run "Check Cookies"
- [ ] Check results
- [ ] Run "Test CORS"
- [ ] Check results

**Expected Result:** All tests pass

## 🔍 Step 7: Check Browser Console

**Why:** Frontend logs helpful debug messages.

- [ ] Open DevTools → Console tab
- [ ] Clear console
- [ ] Log in
- [ ] Look for these messages:
  - `✅ Token refreshed successfully via httpOnly cookie`
  - `🔄 Token expired, attempting refresh via httpOnly cookie...`
- [ ] If you see errors, note them down

**Expected Result:** No errors related to auth/cookies/CORS

## 🔍 Step 8: Check Render Logs

**Why:** Backend logs show what's happening server-side.

- [ ] Go to Render dashboard
- [ ] Select your backend service
- [ ] Click "Logs"
- [ ] Look for refresh-related logs:
  - `Refresh endpoint - Cookies received: ...`
  - `✅ Token refresh successful for ...`
  - `❌ Refresh token not found!`
- [ ] Note any errors

**Expected Result:** Logs show successful refresh

## 🐛 Common Issues & Solutions

### Issue: No `Set-Cookie` in login response
**Solution:** Check Render logs for login errors

### Issue: Cookie not stored in browser
**Solution:** 
- Try Chrome instead of Safari/Firefox
- Disable privacy extensions
- Check browser allows third-party cookies

### Issue: Cookie not sent with refresh request
**Solution:**
- Verify `withCredentials: true` in frontend (already verified ✅)
- Check browser privacy settings
- Try incognito mode

### Issue: 401 even with cookie present
**Solution:**
- Token might be expired (30 days)
- JWT secret might have changed on backend
- User needs to log in again

### Issue: CORS errors
**Solution:**
- Verify `FRONTEND_URL` on Render
- Verify frontend URL matches exactly
- Check for typos in URLs

## ✅ Success Criteria

You'll know it's fixed when:

- [ ] Login sets `refreshToken` cookie
- [ ] Cookie visible in DevTools → Application → Cookies
- [ ] Refresh endpoint returns 200 OK
- [ ] No 401 errors in console
- [ ] No CORS errors in console
- [ ] User stays logged in after 15+ minutes

## 📊 Report Template

If issue persists, provide this information:

```
## Environment
- Frontend URL: https://pryde-frontend.pages.dev
- Backend URL: https://pryde-backend.onrender.com
- Browser: Chrome/Firefox/Safari (version)

## Cloudflare Pages Env Vars
VITE_API_URL: [value or "not set"]
VITE_SOCKET_URL: [value or "not set"]

## Render Env Vars
FRONTEND_URL: [value or "not set"]

## Login Test
- Login response status: [200/400/500]
- Set-Cookie header present: [Yes/No]
- Cookie stored in browser: [Yes/No]

## Refresh Test
- Refresh response status: [200/401/500]
- Cookie header in request: [Yes/No]
- Error message: [if any]

## Console Errors
[paste any errors from browser console]

## Render Logs
[paste relevant logs from Render]
```

## 🎯 Most Likely Fix

Based on investigation, the issue is most likely:

**Missing or incorrect `VITE_API_URL` in Cloudflare Pages**

**Quick Fix:**
1. Add `VITE_API_URL=https://pryde-backend.onrender.com/api` to Cloudflare Pages
2. Redeploy
3. Clear browser cache
4. Log in again
5. Test refresh

This should resolve the issue in 90% of cases.

