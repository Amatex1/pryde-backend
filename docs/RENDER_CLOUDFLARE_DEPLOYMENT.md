# 🚀 Pryde Social - Render + Cloudflare Deployment Guide

## 📋 Overview

This guide will help you deploy Pryde Social with:
- **Backend:** Render Web Service (Node.js)
- **Frontend:** Render Static Site (React)
- **Domain:** Cloudflare DNS + SSL

---

## ✅ Prerequisites

- [x] Render account created
- [x] Cloudflare account created
- [x] Domain transferred to Cloudflare
- [x] MongoDB Atlas database ready
- [x] GitHub repository connected to Render

---

## 🔧 Step 1: Update Environment Variables on Render

### Backend Service (`pryde-social`)

Go to your backend service dashboard and add/update these environment variables:

```bash
NODE_ENV=production
PORT=10000
MONGO_URL=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster.mongodb.net/pryde-social
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster.mongodb.net/pryde-social
JWT_SECRET=YOUR_JWT_SECRET_HERE_GENERATE_WITH_CRYPTO
MESSAGE_ENCRYPTION_KEY=YOUR_ENCRYPTION_KEY_HERE_GENERATE_WITH_CRYPTO
BASE_URL=https://pryde-social.onrender.com
FRONTEND_URL=https://prydeapp.com
RP_ID=pryde-social.onrender.com
ORIGIN=https://prydeapp.com
```

**Optional (for email notifications):**
```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM="Pryde Social" <noreply@prydeapp.com>
```

---

## 🎨 Step 2: Create Frontend Static Site on Render

### Option A: Using Render Dashboard (Recommended)

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Static Site"**
3. Connect your GitHub repository: `Amatex1/pryde-frontend---backend`
4. Configure:
   - **Name:** `pryde-frontend`
   - **Branch:** `main`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
5. Click **"Create Static Site"**

### Option B: Using render.yaml (Automatic)

The `render.yaml` file has been updated to include both services. Just push to GitHub:

```bash
git add render.yaml
git commit -m "Add frontend static site to render.yaml"
git push origin main
```

Render will automatically detect and create the frontend service.

---

## 🌐 Step 3: Configure Cloudflare DNS

### Add DNS Records

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your domain: `prydeapp.com`
3. Go to **DNS** → **Records**
4. Add the following records:

#### For Frontend (Static Site)
```
Type: CNAME
Name: @ (or prydeapp.com)
Target: pryde-frontend.onrender.com
Proxy status: Proxied (orange cloud)
TTL: Auto
```

#### For Backend API (Optional - if you want api.prydeapp.com)
```
Type: CNAME
Name: api
Target: pryde-social.onrender.com
Proxy status: Proxied (orange cloud)
TTL: Auto
```

---

## 🔒 Step 4: Configure Cloudflare SSL

1. Go to **SSL/TLS** → **Overview**
2. Set encryption mode to: **Full (strict)**
3. Go to **SSL/TLS** → **Edge Certificates**
4. Enable:
   - ✅ Always Use HTTPS
   - ✅ Automatic HTTPS Rewrites
   - ✅ Minimum TLS Version: 1.2

---

## 🚀 Step 5: Deploy!

### Deploy Backend
1. Go to your backend service on Render
2. Click **"Manual Deploy"** → **"Deploy latest commit"**
3. Wait for deployment to complete (~2-3 minutes)
4. Verify: Visit `https://pryde-social.onrender.com/api/health`

### Deploy Frontend
1. Go to your frontend static site on Render
2. Click **"Manual Deploy"** → **"Deploy latest commit"**
3. Wait for build to complete (~1-2 minutes)
4. Verify: Visit `https://pryde-frontend.onrender.com`

---

## 🔗 Step 6: Connect Custom Domain

### On Render (Frontend)
1. Go to your frontend static site
2. Click **"Settings"** → **"Custom Domains"**
3. Click **"Add Custom Domain"**
4. Enter: `prydeapp.com`
5. Render will provide DNS instructions (already done in Step 3)

### Verify Domain
- Wait 5-10 minutes for DNS propagation
- Visit `https://prydeapp.com`
- Your app should load! 🎉

---

## ✅ Step 7: Verify Everything Works

### Test Checklist
- [ ] Frontend loads at `https://prydeapp.com`
- [ ] Backend API responds at `https://pryde-social.onrender.com/api/health`
- [ ] Login/Register works
- [ ] Real-time messaging works (Socket.IO)
- [ ] PWA manifest loads (check DevTools → Application → Manifest)
- [ ] HTTPS is enforced (green padlock in browser)

---

## 🎯 URLs Summary

| Service | Render URL | Custom Domain |
|---------|-----------|---------------|
| Frontend | `https://pryde-frontend.onrender.com` | `https://prydeapp.com` |
| Backend | `https://pryde-social.onrender.com` | (optional: `https://api.prydeapp.com`) |

---

## 🐛 Troubleshooting

### Issue: "Failed to fetch" errors
**Fix:** Check CORS settings in `server/server.js` - ensure `prydeapp.com` is in allowed origins

### Issue: WebSocket connection fails
**Fix:** Ensure Cloudflare WebSocket support is enabled (it is by default)

### Issue: DNS not resolving
**Fix:** Wait 5-10 minutes for DNS propagation, clear browser cache

### Issue: SSL certificate errors
**Fix:** Ensure Cloudflare SSL mode is "Full (strict)" and wait for certificate provisioning

---

## 🎉 Deployment Complete!

Your Pryde Social app is now live on:
- **Frontend:** https://prydeapp.com
- **Backend:** https://pryde-social.onrender.com

**Next steps:**
1. Test all features thoroughly
2. Monitor Render logs for any errors
3. Set up Cloudflare analytics (optional)
4. Enable Cloudflare caching rules (optional)

🏳️‍🌈 **Welcome to Pryde Social!** ✨

