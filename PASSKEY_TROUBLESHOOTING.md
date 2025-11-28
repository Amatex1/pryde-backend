# 🔧 Passkey Troubleshooting Guide

## Current Status: 404 Error on `/api/passkey/list`

This means the passkey routes are **not registered** on the Render server.

---

## 🔍 Diagnostic Steps

### Step 1: Check if Render Has Redeployed

1. Go to https://dashboard.render.com
2. Click on your backend service (pryde-social)
3. Check the "Events" tab
4. Look for recent deployments
5. **Expected**: You should see a deployment triggered by the latest commit

**Latest commit pushed:** `2c4365d - Add passkey support indicator to health check endpoint`

---

### Step 2: Check Health Endpoint

Visit: https://pryde-social.onrender.com/

**Expected response (after redeploy):**
```json
{
  "status": "Pryde API running",
  "timestamp": "2025-11-28T...",
  "passkeySupport": true
}
```

**If `passkeySupport` is `false` or missing:**
- The `@simplewebauthn` packages aren't installed
- Check Render build logs for errors

---

### Step 3: Check Render Build Logs

1. Go to Render dashboard → your service
2. Click on "Logs" tab
3. Look for the most recent deployment
4. Search for:
   - ✅ `npm install` - Should show @simplewebauthn packages being installed
   - ❌ `Cannot find module '@simplewebauthn/server'` - Packages not installed
   - ❌ `Error: Cannot find module` - Import failed

---

### Step 4: Verify Environment Variables

1. Go to Render dashboard → your service
2. Click "Environment" tab
3. **Required variables:**
   - `RP_ID` = `pryde-social.onrender.com`
   - `ORIGIN` = `https://prydeapp.com`

**If missing:** Add them and save (will trigger redeploy)

---

## 🐛 Common Issues & Solutions

### Issue 1: Packages Not Installing

**Symptoms:**
- 404 on `/api/passkey/list`
- Build logs show "Cannot find module"
- `passkeySupport: false` in health check

**Solution:**
1. Check `server/package.json` includes:
   ```json
   "@simplewebauthn/server": "^13.2.2"
   ```
2. Trigger manual redeploy in Render:
   - Go to service → "Manual Deploy" → "Deploy latest commit"
3. Watch build logs to ensure packages install

---

### Issue 2: Import Errors

**Symptoms:**
- Server crashes on startup
- Logs show "SyntaxError" or "Cannot find module"

**Solution:**
1. Check `server/routes/passkey.js` exists
2. Check `server/utils/passkeyUtils.js` exists
3. Verify all imports use `.js` extensions
4. Check for syntax errors in passkey files

---

### Issue 3: Routes Not Registered

**Symptoms:**
- 404 on passkey endpoints
- No errors in logs
- `passkeySupport: true` in health check

**Solution:**
1. Check `server/server.js` line 38:
   ```javascript
   import passkeyRoutes from './routes/passkey.js';
   ```
2. Check `server/server.js` line 213:
   ```javascript
   app.use('/api/passkey', passkeyRoutes);
   ```
3. Restart server

---

### Issue 4: Environment Variables Missing

**Symptoms:**
- Passkey creation fails
- "Invalid RP ID" error
- "Origin mismatch" error

**Solution:**
Add to Render environment variables:
- `RP_ID=pryde-social.onrender.com`
- `ORIGIN=https://prydeapp.com`

---

## 🧪 Testing After Fix

### Test 1: Health Check
```bash
curl https://pryde-social.onrender.com/
```
Should return `"passkeySupport": true`

### Test 2: List Passkeys (Authenticated)
```bash
curl https://pryde-social.onrender.com/api/passkey/list \
  -H "Authorization: Bearer YOUR_TOKEN"
```
Should return `{"passkeys": []}` (not 404)

### Test 3: Frontend Test
1. Go to https://prydeapp.com/settings/security
2. Should see "Passkeys" section
3. Click "+ Add Passkey"
4. Should prompt for biometric (not 404 error)

---

## 📋 Checklist

Before passkeys will work, verify:

- [ ] `@simplewebauthn/server` in `server/package.json`
- [ ] `@simplewebauthn/browser` in `package.json` (frontend)
- [ ] `server/routes/passkey.js` exists
- [ ] `server/utils/passkeyUtils.js` exists
- [ ] Passkey routes imported in `server/server.js`
- [ ] Passkey routes registered in `server/server.js`
- [ ] Environment variable `RP_ID` set on Render
- [ ] Environment variable `ORIGIN` set on Render
- [ ] Latest code deployed to Render
- [ ] No errors in Render build logs
- [ ] Health endpoint shows `passkeySupport: true`

---

## 🚀 Force Redeploy

If nothing else works:

1. **Manual Deploy:**
   - Render dashboard → your service
   - Click "Manual Deploy"
   - Select "Deploy latest commit"
   - Wait 2-5 minutes

2. **Clear Build Cache:**
   - Render dashboard → your service
   - Settings → "Clear build cache"
   - Then trigger manual deploy

3. **Check Node Version:**
   - Ensure Render is using Node 18+ (required for ES modules)
   - Check in Render settings or build logs

---

## 📞 Next Steps

1. **Wait for Render to redeploy** (usually 2-5 minutes after push)
2. **Check health endpoint** for `passkeySupport: true`
3. **Check Render logs** for any errors
4. **Test passkey endpoints** from frontend

If still not working after 10 minutes, check Render dashboard for deployment errors.

