# 🚀 Deploy to Vercel NOW - Quick Guide

**Current Status:**
- ✅ Backend: Running on Render (https://pryde-backend.onrender.com)
- ✅ Frontend: Ready to deploy (Vite + React)
- ⚠️ Currently: Hosted on Cloudflare Pages
- 🎯 Goal: Move to Vercel

---

## 📋 **Pre-Flight Check**

✅ Backend is healthy (checked: 2026-01-13)  
✅ Environment variables ready:
- `VITE_API_URL=https://pryde-backend.onrender.com/api`
- `VITE_SOCKET_URL=https://pryde-backend.onrender.com`
- `VITE_HCAPTCHA_SITE_KEY=3ef850da-acb8-4c5e-a86e-cbfee0ae3790`

---

## 🎯 **Deployment Steps**

### **Step 1: Sign Up for Vercel** (2 minutes)

1. Go to: **https://vercel.com**
2. Click **"Sign Up"**
3. Choose **"Continue with GitHub"**
4. Authorize Vercel to access your GitHub account

---

### **Step 2: Import Your Repository** (3 minutes)

1. After logging in, click **"Add New..."** → **"Project"**
2. Find and select: **`pryde-backend`** repository
3. Click **"Import"**

---

### **Step 3: Configure Build Settings** (2 minutes)

Vercel should **auto-detect** these settings:

| Setting | Value | Status |
|---------|-------|--------|
| **Framework Preset** | Vite | ✅ Auto-detected |
| **Root Directory** | `./` (leave empty) | ✅ Correct |
| **Build Command** | `npm run build` | ✅ Auto-detected |
| **Output Directory** | `dist` | ✅ Auto-detected |
| **Install Command** | `npm install` | ✅ Auto-detected |

**⚠️ IMPORTANT:** If Vercel shows "No Framework Detected":
- Manually select **"Vite"** from the Framework Preset dropdown
- Build Command: `npm run build`
- Output Directory: `dist`

---

### **Step 4: Add Environment Variables** (3 minutes)

In the Vercel deployment screen, scroll down to **"Environment Variables"** section.

Add these **3 variables** (copy-paste exactly):

**Variable 1:**
- **Name:** `VITE_API_URL`
- **Value:** `https://pryde-backend.onrender.com/api`
- **Environment:** Production, Preview, Development (check all 3)

**Variable 2:**
- **Name:** `VITE_SOCKET_URL`
- **Value:** `https://pryde-backend.onrender.com`
- **Environment:** Production, Preview, Development (check all 3)

**Variable 3:**
- **Name:** `VITE_HCAPTCHA_SITE_KEY`
- **Value:** `3ef850da-acb8-4c5e-a86e-cbfee0ae3790`
- **Environment:** Production, Preview, Development (check all 3)

---

### **Step 5: Deploy!** (5-10 minutes)

1. Click **"Deploy"** button
2. Wait for build to complete (usually 3-5 minutes)
3. You'll see a progress screen with build logs
4. When done, you'll get a **preview URL** like:
   - `https://pryde-backend-xyz123.vercel.app`

---

### **Step 6: Test the Deployment** (5 minutes)

1. **Copy the preview URL** from Vercel
2. **Open it in a new browser tab**
3. **Open DevTools Console** (F12)
4. **Log in to your app**
5. **Run this diagnostic:**

```javascript
// Check WebSocket connection
const socket = window.socket;
console.log('=== VERCEL DEPLOYMENT TEST ===');
console.log('Socket connected:', socket?.connected);
console.log('Transport:', socket?.io?.engine?.transport?.name);
console.log('Socket ID:', socket?.id);
console.log('Backend URL:', import.meta.env.VITE_SOCKET_URL);
```

**Expected Output:**
```
Socket connected: true
Transport: websocket  ← MUST BE THIS!
Socket ID: (some random ID)
Backend URL: https://pryde-backend.onrender.com
```

---

### **Step 7: Test Real-Time Features** (5 minutes)

1. **Open app in 2 browser windows** (or 2 devices)
2. **Log in as different users**
3. **Send a DM** from User A to User B
4. **Verify:** User B receives it **instantly** (< 1 second)
5. **Test typing indicator:** Should appear immediately

---

## ✅ **Success Criteria**

- [ ] Vercel deployment successful
- [ ] Preview URL loads correctly
- [ ] Can log in
- [ ] WebSocket transport is `websocket` (NOT `polling`)
- [ ] DMs work instantly
- [ ] No CORS errors in console
- [ ] No 404 errors on API calls

---

## 🔧 **Troubleshooting**

### Issue: Build Fails

**Check:**
1. Build logs in Vercel dashboard
2. Make sure `package.json` has `"build": "vite build"` script
3. Make sure `vite.config.js` exists

**Fix:**
- Check build logs for specific error
- Most common: Missing dependencies (run `npm install` locally first)

---

### Issue: CORS Error

**Symptom:** Console shows CORS error when calling API

**Fix:**
1. Backend already has Vercel URLs in CORS allowlist
2. Hard refresh browser (Ctrl+Shift+R)
3. Check backend logs on Render

---

### Issue: WebSocket Using Polling

**Symptom:** Transport shows `polling` instead of `websocket`

**Fix:**
1. Check `VITE_SOCKET_URL` is set correctly (no `/api` at end)
2. Hard refresh browser
3. Check backend CORS includes your Vercel URL

---

### Issue: Environment Variables Not Working

**Symptom:** API calls go to wrong URL or fail

**Fix:**
1. In Vercel dashboard: Settings → Environment Variables
2. Verify all 3 variables are set
3. **Redeploy** (Deployments → ... → Redeploy)

---

## 🎉 **After Successful Deployment**

### **Option A: Keep Testing on Preview URL**
- Use the Vercel preview URL for now
- Test thoroughly before switching DNS

### **Option B: Add Custom Domain** (Optional)
1. In Vercel: Settings → Domains
2. Add `prydeapp.com`
3. Update DNS in Cloudflare:
   - Change CNAME to point to Vercel
   - **Set to "DNS only"** (gray cloud, not proxied)
4. Wait 5-10 minutes for DNS propagation

---

## 📞 **Need Help?**

**If deployment fails:**
1. Check build logs in Vercel dashboard
2. Share the error message
3. I can help debug!

**If WebSocket doesn't work:**
1. Check browser console for errors
2. Run the diagnostic script above
3. Check backend logs on Render

---

## 🚀 **Ready to Deploy?**

**Go to:** https://vercel.com

**Estimated Time:** 15-20 minutes total

**Difficulty:** 🟢 Easy

**Let's do this!** 🎉

