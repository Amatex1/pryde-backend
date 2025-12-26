# ✅ Cloudflare Pages Setup Checklist

Quick checklist to set up automatic deployment from GitHub to Cloudflare Pages.

---

## 📋 **Pre-Deployment Checklist**

- [x] ✅ Code changes committed to GitHub
- [x] ✅ Service worker optimized (v5)
- [x] ✅ Login button added to homepage
- [x] ✅ Vite build configuration optimized
- [x] ✅ Headers and redirects configured
- [ ] 🔲 Cloudflare Pages connected to GitHub
- [ ] 🔲 Custom domain configured
- [ ] 🔲 Environment variables set

---

## 🚀 **Step-by-Step Setup**

### **Step 1: Connect GitHub to Cloudflare Pages** (5 minutes)

1. Go to: https://dash.cloudflare.com/
2. Click **Pages** in left sidebar
3. Click **Create a project** (or select existing project)
4. Click **Connect to Git**
5. Select **GitHub**
6. Authorize Cloudflare Pages
7. Select repository: `Amatex1/pryde-frontend---backend`
8. Click **Begin setup**

### **Step 2: Configure Build Settings** (2 minutes)

```
Production branch:     main
Build command:         npm run build:prod
Build output directory: dist
Root directory:        (leave empty)
```

### **Step 3: Add Environment Variables** (3 minutes)

Click **Add variable** for each:

```
Variable name:         VITE_API_URL
Value:                 https://pryde-social.onrender.com/api

Variable name:         VITE_SOCKET_URL
Value:                 https://pryde-social.onrender.com

Variable name:         VITE_HCAPTCHA_SITE_KEY
Value:                 3ef850da-acb8-4c5e-a86e-cbfee0ae3790

Variable name:         NODE_VERSION
Value:                 18
```

### **Step 4: Save and Deploy** (1 minute)

1. Click **Save and Deploy**
2. Wait for build to complete (2-5 minutes)
3. Check build logs for errors

### **Step 5: Configure Custom Domain** (10 minutes)

#### **Option A: Use Cloudflare Nameservers** (Recommended)

1. In Cloudflare Pages project → **Custom domains**
2. Click **Set up a custom domain**
3. Enter: `prydeapp.com`
4. Cloudflare will show you nameservers:
   ```
   ns1.cloudflare.com
   ns2.cloudflare.com
   ```
5. Go to SiteGround → Domain Management
6. Update nameservers to Cloudflare's
7. Wait 5-60 minutes for DNS propagation

#### **Option B: Use CNAME Record** (Faster)

1. In Cloudflare Pages project → **Custom domains**
2. Click **Set up a custom domain**
3. Enter: `prydeapp.com`
4. Cloudflare will show you a CNAME target
5. Go to SiteGround → DNS Management
6. Add CNAME record:
   ```
   Type:  CNAME
   Name:  @ (or www)
   Value: [your-project].pages.dev
   TTL:   Auto
   ```
7. Wait 5-10 minutes for DNS propagation

### **Step 6: Enable HTTPS** (Automatic)

1. Cloudflare automatically provisions SSL certificates
2. Wait 5-10 minutes for SSL to activate
3. In Cloudflare → SSL/TLS → Overview
4. Set SSL/TLS encryption mode to **Full (strict)**
5. Enable **Always Use HTTPS**

---

## 🧪 **Testing Checklist**

After deployment completes:

- [ ] 🔲 Visit https://prydeapp.com (should load)
- [ ] 🔲 Check homepage has Login button
- [ ] 🔲 Check browser console (no 503 errors)
- [ ] 🔲 Test navigation (all routes work)
- [ ] 🔲 Test login functionality
- [ ] 🔲 Test messaging (Socket.IO connection)
- [ ] 🔲 Check service worker (DevTools → Application → Service Workers)
- [ ] 🔲 Verify backend connectivity: https://pryde-social.onrender.com/api/health

---

## 🔍 **Verification Commands**

Run these in your terminal to verify deployment:

```bash
# Check if site is live
curl -I https://prydeapp.com

# Check service worker
curl -I https://prydeapp.com/sw.js

# Check backend health
curl https://pryde-social.onrender.com/api/health

# Check DNS propagation
nslookup prydeapp.com
```

---

## 🛠️ **Troubleshooting**

### **Build Fails**
1. Check build logs in Cloudflare Dashboard
2. Verify environment variables are set correctly
3. Check `package.json` has all dependencies
4. Try building locally: `npm run build:prod`

### **Site Not Loading**
1. Check DNS propagation (can take up to 24 hours)
2. Clear browser cache (Ctrl+Shift+R)
3. Check Cloudflare SSL/TLS settings
4. Verify custom domain is active in Cloudflare Pages

### **503 Errors**
1. Check backend is running: https://pryde-social.onrender.com/api/health
2. Clear service worker cache (DevTools → Application → Clear storage)
3. Hard refresh browser (Ctrl+Shift+R)

### **Service Worker Not Updating**
1. Check `public/_headers` has correct cache headers for `/sw.js`
2. Hard refresh browser (Ctrl+Shift+R)
3. Manually unregister old service worker (DevTools → Application → Service Workers)

---

## 📊 **Expected Results**

After successful setup:

✅ **Automatic Deployments**
- Push to `main` branch → Cloudflare auto-deploys
- Build time: 2-5 minutes
- Deploy time: 30-60 seconds

✅ **Performance**
- Global CDN (300+ edge locations)
- HTTPS enabled
- Brotli compression
- HTTP/2 and HTTP/3

✅ **Features Working**
- Login button on homepage
- No 503 prefetch errors
- Service worker caching properly
- All routes working (SPA routing)
- Backend API connected

---

## 🎯 **Next Steps After Setup**

1. **Enable Preview Deployments** (optional)
   - Cloudflare Pages → Settings → Builds & deployments
   - Enable preview deployments for pull requests

2. **Set Up Analytics** (optional)
   - Cloudflare Pages → Analytics
   - View traffic, performance, and errors

3. **Configure Notifications** (optional)
   - Cloudflare Pages → Settings → Notifications
   - Get notified on build failures

4. **Monitor Performance**
   - Use Cloudflare Analytics
   - Check Core Web Vitals
   - Monitor backend response times

---

## 📞 **Support Resources**

- **Cloudflare Pages Docs**: https://developers.cloudflare.com/pages/
- **Cloudflare Community**: https://community.cloudflare.com/
- **Vite Docs**: https://vitejs.dev/
- **Your Backend Health**: https://pryde-social.onrender.com/api/health

---

## ✅ **Completion Checklist**

Mark these as complete:

- [ ] 🔲 GitHub connected to Cloudflare Pages
- [ ] 🔲 Build settings configured
- [ ] 🔲 Environment variables set
- [ ] 🔲 First deployment successful
- [ ] 🔲 Custom domain configured
- [ ] 🔲 HTTPS enabled
- [ ] 🔲 Site tested and working
- [ ] 🔲 Automatic deployments verified

---

**Estimated Total Time**: 20-30 minutes (excluding DNS propagation)

**Status**: Ready to deploy! 🚀

