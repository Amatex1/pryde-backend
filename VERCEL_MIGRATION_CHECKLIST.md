# ✅ Vercel Migration Checklist

**Quick reference for migrating frontend from Cloudflare Pages to Vercel**

---

## 🎯 Pre-Flight Check

- [x] ✅ Backend is on Render (https://pryde-backend.onrender.com)
- [x] ✅ Backend supports WebSocket
- [x] ✅ Frontend code is in `pryde-backend` repo
- [x] ✅ Environment variables documented in `.env.production`
- [x] ✅ No Cloudflare Workers dependencies
- [x] ✅ Audit completed (see `FRONTEND_VERCEL_MIGRATION_AUDIT.md`)

**Status:** 🟢 READY TO MIGRATE

---

## 📝 Step-by-Step Migration

### Step 1: Sign Up for Vercel (2 minutes)
- [ ] Go to https://vercel.com
- [ ] Click "Sign Up"
- [ ] Choose "Continue with GitHub"
- [ ] Authorize Vercel

### Step 2: Import Repository (3 minutes)
- [ ] Click "Add New..." → "Project"
- [ ] Find `pryde-backend` repository
- [ ] Click "Import"
- [ ] Verify auto-detection:
  - Framework: Vite ✅
  - Build Command: `npm run build` ✅
  - Output Directory: `dist` ✅

### Step 3: Add Environment Variables (2 minutes)
Add these EXACT variables in Vercel dashboard:

```
VITE_API_URL=https://pryde-backend.onrender.com/api
VITE_SOCKET_URL=https://pryde-backend.onrender.com
VITE_HCAPTCHA_SITE_KEY=3ef850da-acb8-4c5e-a86e-cbfee0ae3790
```

- [ ] `VITE_API_URL` added
- [ ] `VITE_SOCKET_URL` added
- [ ] `VITE_HCAPTCHA_SITE_KEY` added

### Step 4: Deploy (3 minutes)
- [ ] Click "Deploy"
- [ ] Wait for build to complete
- [ ] Copy preview URL (e.g., `https://pryde-backend-xyz.vercel.app`)

### Step 5: Test WebSocket (5 minutes)
- [ ] Open preview URL in browser
- [ ] Open DevTools console (F12)
- [ ] Log in to app
- [ ] Run diagnostic:
```javascript
const socket = window.socket;
console.log('Socket connected:', socket?.connected);
console.log('Transport:', socket?.io?.engine?.transport?.name);
```
- [ ] Verify transport is `websocket` (NOT `polling`)

### Step 6: Test Real-Time Features (5 minutes)
- [ ] Open app in two browsers
- [ ] Send DM between users
- [ ] Verify instant delivery (no delay)
- [ ] Test typing indicators
- [ ] Test lounge chat

### Step 7: Add Custom Domain (Optional, 10 minutes)
- [ ] In Vercel: Settings → Domains → Add Domain
- [ ] Enter `prydeapp.com`
- [ ] Copy DNS records from Vercel
- [ ] In Cloudflare DNS:
  - [ ] Delete old Cloudflare Pages CNAME
  - [ ] Add new Vercel CNAME
  - [ ] **IMPORTANT:** Set to "DNS only" (gray cloud)
- [ ] Wait 5-10 minutes for DNS propagation
- [ ] Test `https://prydeapp.com`

### Step 8: Cleanup (Optional, 5 minutes)
- [ ] Delete Cloudflare Pages project
- [ ] Remove Cloudflare-specific files (optional):
  ```bash
  rm public/_headers
  rm public/_redirects
  rm public/_routes.json
  ```
- [ ] Update documentation

---

## 🔍 Verification Tests

### ✅ WebSocket Test
```javascript
// In browser console
const socket = window.socket;
console.log('=== WEBSOCKET TEST ===');
console.log('Connected:', socket?.connected);
console.log('Transport:', socket?.io?.engine?.transport?.name);
console.log('Socket ID:', socket?.id);
```

**Expected:**
- Connected: `true`
- Transport: `websocket` ← MUST BE THIS!
- Socket ID: (some ID)

### ✅ DM Test
1. User A sends DM to User B
2. User B receives it **instantly** (< 1 second)
3. Typing indicator appears immediately

### ✅ API Test
1. Open Network tab in DevTools
2. Refresh page
3. Check API calls to `https://pryde-backend.onrender.com/api/*`
4. All should return 200 OK

---

## 🚨 Troubleshooting

### Issue: CORS Error
**Symptom:** Console shows CORS error

**Fix:**
1. Backend already has Vercel URLs in CORS allowlist
2. Wait for backend to redeploy (auto-deploys on Render)
3. Hard refresh browser (Ctrl+Shift+R)

### Issue: WebSocket Using Polling
**Symptom:** Transport shows `polling` instead of `websocket`

**Fix:**
1. Check backend CORS includes your Vercel URL
2. Hard refresh browser
3. Clear browser cache
4. Check Render backend logs

### Issue: 404 on API Calls
**Symptom:** API calls return 404

**Fix:**
1. Verify `VITE_API_URL` ends with `/api`
2. Verify `VITE_SOCKET_URL` does NOT end with `/api`
3. Redeploy on Vercel

---

## 📊 Success Criteria

- [ ] ✅ Vercel deployment successful
- [ ] ✅ Preview URL works
- [ ] ✅ WebSocket transport is `websocket`
- [ ] ✅ DMs work instantly
- [ ] ✅ Lounge chat works
- [ ] ✅ Typing indicators work
- [ ] ✅ No CORS errors
- [ ] ✅ No console errors
- [ ] ✅ Custom domain works (if added)

---

## 🎉 Post-Migration

**Once everything works:**
1. ✅ Frontend on Vercel
2. ✅ Backend on Render
3. ✅ WebSocket working
4. ✅ Real-time features working
5. ✅ Custom domain working

**You can now:**
- Delete Cloudflare Pages project
- Enjoy instant real-time messaging! ⚡
- Save money (Vercel free tier)

---

## 📞 Need Help?

**Resources:**
- Full guide: `VERCEL_MIGRATION_GUIDE.md`
- Audit report: `FRONTEND_VERCEL_MIGRATION_AUDIT.md`
- Vercel docs: https://vercel.com/docs
- Render docs: https://render.com/docs

**Common Issues:**
- Check browser console for errors
- Check Render backend logs
- Verify environment variables in Vercel
- Hard refresh browser (Ctrl+Shift+R)

---

**Estimated Total Time:** 30-45 minutes  
**Difficulty:** 🟢 Easy  
**Success Rate:** 🟢 95%+

**Good luck! 🚀**

