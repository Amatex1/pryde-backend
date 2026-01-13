# 🚀 Vercel Migration Guide - Step by Step

## ✅ Benefits of Migrating to Vercel

1. **WebSocket Works!** - Real-time DMs will work instantly
2. **Better Performance** - Optimized for React/Vite apps
3. **Save Money** - Free tier (vs. paid Cloudflare)
4. **Auto-Deploy** - Pushes to GitHub auto-deploy
5. **Better CDN** - Fast global edge network

---

## 📋 Step-by-Step Migration

### **Step 1: Sign Up for Vercel**

1. Go to: https://vercel.com
2. Click **"Sign Up"**
3. Choose **"Continue with GitHub"**
4. Authorize Vercel to access your GitHub repos

---

### **Step 2: Import Your Frontend Repo**

1. In Vercel Dashboard, click **"Add New..."** → **"Project"**
2. Find **`pryde-frontend`** in the repo list
3. Click **"Import"**

**Vercel will auto-detect:**
- Framework: Vite ✅
- Build Command: `npm run build` ✅
- Output Directory: `dist` ✅

**DON'T CLICK DEPLOY YET!**

---

### **Step 3: Add Environment Variables**

In the import screen, scroll to **"Environment Variables"** section.

**Add these EXACTLY:**

| Variable Name | Value |
|--------------|-------|
| `VITE_API_URL` | `https://pryde-backend.onrender.com/api` |
| `VITE_SOCKET_URL` | `https://pryde-backend.onrender.com` |

**Important:**
- Click **"Add"** after each one
- NO trailing slashes
- `VITE_API_URL` has `/api` at the end
- `VITE_SOCKET_URL` does NOT have `/api`

---

### **Step 4: Deploy!**

1. Click **"Deploy"**
2. Wait 2-3 minutes for build to complete
3. You'll see a success screen with a URL like:
   - `https://pryde-frontend-abc123.vercel.app`

**Copy this URL!** You'll need it for the next step.

---

### **Step 5: Update Backend CORS**

**Your Vercel URL will look like:**
- `https://pryde-frontend-abc123.vercel.app`
- OR `https://pryde-frontend.vercel.app`

**Add this URL to your backend's allowed origins:**

1. Open `server/server.js` in your backend repo
2. Find the `allowedOrigins` array (around line 153)
3. Add your Vercel URL:

```javascript
const allowedOrigins = [
  // Production domains
  'https://prydesocial.com',
  'https://www.prydesocial.com',
  'https://prydeapp.com',
  'https://www.prydeapp.com',
  // Vercel deployment URLs
  'https://pryde-frontend-abc123.vercel.app', // ← ADD YOUR VERCEL URL HERE
  // ... rest of the origins
];
```

4. Commit and push to GitHub:
```bash
git add server/server.js
git commit -m "feat: add Vercel URL to CORS allowlist"
git push origin main
```

5. Wait for Render to auto-deploy (2-3 minutes)

---

### **Step 6: Test WebSocket Connection**

1. Open your Vercel URL in browser
2. Open browser console (F12)
3. Log in to your app
4. Run this diagnostic:

```javascript
const socket = window.socket;
console.log('=== WEBSOCKET TEST ===');
console.log('Socket exists:', !!socket);
console.log('Socket connected:', socket?.connected);
console.log('Transport:', socket?.io?.engine?.transport?.name);
console.log('Socket ID:', socket?.id);
console.log('======================');
```

**Expected Output:**
```
Socket exists: true
Socket connected: true
Transport: websocket  ← MUST BE "websocket" NOT "polling"!
Socket ID: abc123xyz
```

**If you see `Transport: websocket`** → ✅ SUCCESS!

---

### **Step 7: Test Direct Messages**

1. Open app in two different browsers (or incognito mode)
2. Log in as User A in one, User B in the other
3. User A sends a DM to User B
4. **User B should receive it INSTANTLY!**

**If it works:** 🎉 WebSocket is working!

---

### **Step 8: Add Custom Domain (Optional)**

#### **In Vercel Dashboard:**

1. Go to your project
2. Click **"Settings"** → **"Domains"**
3. Click **"Add Domain"**
4. Enter: `prydeapp.com`
5. Vercel will show you DNS records to add

#### **In Cloudflare Dashboard:**

1. Go to **DNS** settings for `prydeapp.com`
2. **Delete** the old Cloudflare Pages CNAME
3. **Add** new Vercel CNAME:
   - Type: `CNAME`
   - Name: `@` (or `prydeapp.com`)
   - Target: `cname.vercel-dns.com` (Vercel will give you exact value)
   - **Proxy Status: DNS only (gray cloud, NOT orange)**

**Important:** Turn OFF Cloudflare proxy (gray cloud) so Vercel handles the connection.

4. Wait 5-10 minutes for DNS propagation

#### **Update Backend CORS Again:**

Add `https://prydeapp.com` to backend's `allowedOrigins` (it's already there, so you're good!)

---

### **Step 9: Verify Everything Works**

1. Visit `https://prydeapp.com` (after DNS propagates)
2. Test WebSocket connection (same diagnostic as Step 6)
3. Test DMs (same as Step 7)
4. Test lounge chat
5. Test typing indicators

**Everything should work instantly now!** ⚡

---

## 🎯 Troubleshooting

### **Issue: CORS Error**

**Symptom:** Console shows CORS error

**Fix:**
1. Make sure you added your Vercel URL to backend's `allowedOrigins`
2. Make sure backend redeployed after the change
3. Check Render logs for: `CORS blocked origin: <your-vercel-url>`

---

### **Issue: WebSocket Still Using Polling**

**Symptom:** `Transport: polling` instead of `websocket`

**Fix:**
1. Hard refresh browser (Ctrl+Shift+R)
2. Clear browser cache
3. Check if backend CORS allows your Vercel URL
4. Check Render logs for connection errors

---

### **Issue: 404 on API Calls**

**Symptom:** API calls return 404

**Fix:**
1. Check environment variables in Vercel
2. Make sure `VITE_API_URL` ends with `/api`
3. Make sure `VITE_SOCKET_URL` does NOT end with `/api`

---

## 📊 After Migration Checklist

- [ ] Vercel deployment successful
- [ ] Environment variables added
- [ ] Backend CORS updated with Vercel URL
- [ ] WebSocket connection works (transport: websocket)
- [ ] DMs work instantly
- [ ] Lounge chat works
- [ ] Typing indicators work
- [ ] Custom domain added (optional)
- [ ] DNS updated (optional)

---

## 🎉 Success!

Once everything works, you can:
1. Delete Cloudflare Pages deployment (save money)
2. Enjoy instant real-time messaging! ⚡
3. Celebrate! 🎊

---

**Need help? Check the console logs and Render backend logs for errors!**

