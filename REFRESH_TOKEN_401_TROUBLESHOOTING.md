# 401 Unauthorized Error on /api/refresh - Troubleshooting Guide

## Current Configuration

### Backend (Render)
- URL: `https://pryde-backend.onrender.com`
- `FRONTEND_URL`: `https://pryde-frontend.pages.dev`
- CORS: ✅ Configured to allow your frontend

### Frontend (Cloudflare Pages)
- URL: `https://pryde-frontend.pages.dev`
- `VITE_API_URL`: `https://pryde-backend.onrender.com/api`

## Problem

The `/api/refresh` endpoint returns 401 Unauthorized, which means the **refresh token cookie is not being sent** from the frontend to the backend.

## Root Cause

Cross-origin cookies require:
1. ✅ Backend: `sameSite: 'none'` and `secure: true` (already configured)
2. ✅ Backend: CORS with `credentials: true` (already configured)
3. ❓ **Frontend: `withCredentials: true` in axios** (NEEDS VERIFICATION)

## What to Check on Frontend

### 1. Check Axios Configuration

Your frontend needs an API client file (usually `src/utils/api.js` or similar) that looks like this:

```javascript
// src/utils/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // https://pryde-backend.onrender.com/api
  withCredentials: true  // ← THIS IS CRITICAL!
});

export default api;
```

**Action**: Check your frontend repository for the API client configuration and verify `withCredentials: true` is set.

### 2. Check Browser DevTools

1. Open your frontend in Chrome/Firefox
2. Open DevTools → Network tab
3. Try to log in or trigger a refresh
4. Find the `/api/refresh` request
5. Check **Request Headers**:
   - Is there a `Cookie` header?
   - Does it contain `refreshToken=...`?

If NO cookie header:
- ❌ Frontend is not sending cookies → Check `withCredentials: true`
- ❌ Browser is blocking third-party cookies → Check browser settings

### 3. Check Cookies in Browser

1. Open DevTools → Application → Cookies
2. Look for domain: `pryde-backend.onrender.com`
3. Check if there's a `refreshToken` cookie with:
   - ✅ `Secure`: Yes
   - ✅ `SameSite`: None
   - ✅ `HttpOnly`: Yes

If NO cookie exists:
- User never logged in successfully
- Cookie was cleared
- Login endpoint failed to set the cookie

## Common Issues & Solutions

### Issue 1: Frontend axios missing `withCredentials: true`

**Symptom**: No `Cookie` header in requests

**Solution**: Add to your frontend API client:
```javascript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true  // Add this
});
```

### Issue 2: Browser blocking third-party cookies

**Symptom**: Cookie exists but not sent with requests

**Solution**: 
- Safari: Settings → Privacy → Disable "Prevent cross-site tracking"
- Firefox: Settings → Privacy → Standard (not Strict)
- Chrome: Usually works by default with `SameSite=None; Secure`

### Issue 3: Wrong frontend URL in backend

**Symptom**: CORS errors in console

**Solution**: Verify Render environment variable:
```
FRONTEND_URL=https://pryde-frontend.pages.dev
```

### Issue 4: HTTP instead of HTTPS

**Symptom**: Cookies not set or not sent

**Solution**: Ensure both frontend and backend use HTTPS (which they do)

## Testing Steps

### Step 1: Verify Login Works
1. Go to your frontend
2. Log in with valid credentials
3. Check DevTools → Application → Cookies
4. Verify `refreshToken` cookie exists for `pryde-backend.onrender.com`

### Step 2: Verify Refresh Works
1. Wait 15 minutes (access token expires)
2. Make any API request
3. Check Network tab for `/api/refresh` request
4. Should return 200 OK with new tokens

### Step 3: Check Console for Errors
Look for:
- CORS errors
- Cookie warnings
- Network errors

## Quick Fix Checklist

- [ ] Frontend has `withCredentials: true` in axios config
- [ ] Backend `FRONTEND_URL` matches actual frontend URL
- [ ] Both frontend and backend use HTTPS
- [ ] Browser allows third-party cookies
- [ ] User successfully logged in (cookie exists)
- [ ] No CORS errors in console

## Next Steps

1. **Check your frontend repository** (pryde-frontend) for the axios configuration
2. **Verify `withCredentials: true`** is set
3. **Test in browser** with DevTools open
4. **Report back** with:
   - Does the `Cookie` header appear in `/api/refresh` requests?
   - Does the `refreshToken` cookie exist in Application → Cookies?
   - Any CORS errors in console?

## Backend Configuration (Already Correct)

✅ CORS allows your frontend:
```javascript
allowedOrigins = [
  'https://pryde-frontend.pages.dev',  // From FRONTEND_URL env var
  // ... other origins
]
```

✅ Cookies configured correctly:
```javascript
{
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  maxAge: 30 days
}
```

✅ CORS credentials enabled:
```javascript
corsOptions = {
  credentials: true,
  // ...
}
```

The backend is configured correctly. The issue is almost certainly on the frontend side.

