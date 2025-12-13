# 🚀 Cloudflare Pages Deployment Guide

Complete guide for deploying Pryde Social to Cloudflare Pages with automatic GitHub integration.

---

## 📋 **Current Infrastructure**

```
┌─────────────────────────────────────────────────┐
│  Domain: prydeapp.com (SiteGround DNS)         │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│  Frontend: Cloudflare Pages                     │
│  - React app (Vite build)                       │
│  - Service worker (sw.js)                       │
│  - Static assets                                │
│  - Auto-deploy from GitHub                      │
└─────────────────────────────────────────────────┘
                      │
                      │ API Calls
                      ▼
┌─────────────────────────────────────────────────┐
│  Backend: Render ($7 Starter Plan)              │
│  - Node.js/Express API                          │
│  - Socket.IO for real-time                      │
│  - MongoDB Atlas database                       │
│  - URL: pryde-social.onrender.com               │
└─────────────────────────────────────────────────┘
```

---

## 🔧 **Task 1: Set Up Automatic Deployment from GitHub**

### **Step 1: Connect GitHub to Cloudflare Pages**

1. **Go to Cloudflare Dashboard**
   - Navigate to: https://dash.cloudflare.com/
   - Click **Pages** in the left sidebar

2. **Create New Project** (or update existing)
   - Click **Create a project** or select your existing project
   - Click **Connect to Git**

3. **Authorize GitHub**
   - Select **GitHub** as your Git provider
   - Click **Authorize Cloudflare Pages**
   - Select your repository: `Amatex1/pryde-frontend---backend`

4. **Configure Build Settings**
   ```
   Production branch:     main
   Build command:         npm run build:prod
   Build output directory: dist
   Root directory:        / (leave empty)
   ```

5. **Environment Variables** (click "Add variable")
   ```
   VITE_API_URL=https://pryde-social.onrender.com/api
   VITE_SOCKET_URL=https://pryde-social.onrender.com
   VITE_HCAPTCHA_SITE_KEY=3ef850da-acb8-4c5e-a86e-cbfee0ae3790
   NODE_VERSION=18
   ```

6. **Save and Deploy**
   - Click **Save and Deploy**
   - Cloudflare will automatically build and deploy your site

### **Step 2: Configure Custom Domain**

1. **Add Custom Domain**
   - In your Cloudflare Pages project, go to **Custom domains**
   - Click **Set up a custom domain**
   - Enter: `prydeapp.com`
   - Click **Continue**

2. **Update DNS Settings** (in SiteGround)
   - Go to your SiteGround DNS management
   - Add/Update CNAME record:
     ```
     Type:  CNAME
     Name:  @ (or prydeapp.com)
     Value: [your-cloudflare-pages-url].pages.dev
     TTL:   Auto
     ```
   - Or use Cloudflare nameservers (recommended):
     ```
     ns1.cloudflare.com
     ns2.cloudflare.com
     ```

3. **Enable HTTPS**
   - Cloudflare automatically provisions SSL certificates
   - Wait 5-10 minutes for SSL to activate
   - Enable **Always Use HTTPS** in Cloudflare SSL/TLS settings

### **Step 3: Enable Automatic Deployments**

Once connected, Cloudflare Pages will automatically:
- ✅ Deploy when you push to `main` branch
- ✅ Create preview deployments for pull requests
- ✅ Run build command and deploy to CDN
- ✅ Invalidate cache on new deployments

---

## 📊 **Task 2: Check Cloudflare Pages Configuration**

### **Verify Build Settings**

1. **Go to Project Settings**
   - Cloudflare Dashboard → Pages → Your Project → Settings

2. **Check Build Configuration**
   ```
   Framework preset:      None (or Vite)
   Build command:         npm run build:prod
   Build output directory: dist
   Node.js version:       18 (or latest)
   ```

3. **Check Environment Variables**
   - Ensure all VITE_* variables are set
   - Verify values match your backend URLs

### **Verify Deployment Settings**

1. **Branch Deployments**
   - Production branch: `main`
   - Preview branches: All branches (optional)

2. **Build Caching**
   - Enable build caching for faster builds
   - Cloudflare caches `node_modules` between builds

3. **Functions** (if using Cloudflare Functions)
   - Not needed for this project (static site only)

---

## ⚡ **Task 3: Optimize Build for Cloudflare Pages**

### **Optimizations Applied**

#### **1. Vite Configuration** (`vite.config.js`)
- ✅ Code splitting for better caching
- ✅ Asset optimization (images, fonts)
- ✅ Terser minification with console removal
- ✅ CSS code splitting and minification
- ✅ Modern browser targeting (ES2015)

#### **2. Headers Configuration** (`public/_headers`)
- ✅ Security headers (XSS, Frame Options, etc.)
- ✅ Long-term caching for static assets (1 year)
- ✅ No caching for HTML and service worker
- ✅ Proper service worker scope

#### **3. Redirects Configuration** (`public/_redirects`)
- ✅ SPA fallback routing (all routes → index.html)

#### **4. Service Worker** (`public/sw.js`)
- ✅ Skip prefetch requests (fixes 503 errors)
- ✅ Only cache successful responses
- ✅ Better error handling and logging
- ✅ Cache version bumped to v5

---

## 🚀 **Deployment Workflow**

### **Automatic Deployment** (Recommended)

```bash
# 1. Make changes to your code
# 2. Commit changes
git add .
git commit -m "Your commit message"

# 3. Push to GitHub
git push origin main

# 4. Cloudflare automatically:
#    - Detects the push
#    - Runs npm run build:prod
#    - Deploys to CDN
#    - Invalidates cache
#    - Updates prydeapp.com
```

### **Manual Deployment** (Fallback)

```bash
# 1. Build locally
npm run build:prod

# 2. Upload dist/ folder to Cloudflare Pages
#    - Go to Cloudflare Dashboard → Pages → Your Project
#    - Click "Create deployment"
#    - Upload dist/ folder
```

---

## 📈 **Performance Optimizations**

### **Cloudflare CDN Benefits**
- ✅ Global CDN with 300+ edge locations
- ✅ Automatic HTTP/2 and HTTP/3
- ✅ Brotli compression
- ✅ Image optimization (Cloudflare Polish)
- ✅ Minification (Auto Minify)
- ✅ DDoS protection

### **Build Optimizations**
- ✅ Tree shaking (removes unused code)
- ✅ Code splitting (smaller initial bundle)
- ✅ Asset hashing (cache busting)
- ✅ Gzip/Brotli compression
- ✅ CSS extraction and minification

---

## 🔍 **Monitoring & Debugging**

### **Check Deployment Status**
1. Go to Cloudflare Dashboard → Pages → Your Project
2. View **Deployments** tab
3. Click on a deployment to see:
   - Build logs
   - Deployment time
   - Build errors (if any)

### **View Build Logs**
- Click on any deployment
- Scroll to **Build logs** section
- Check for errors or warnings

### **Test Deployment**
```bash
# Check if site is live
curl -I https://prydeapp.com

# Check service worker
curl -I https://prydeapp.com/sw.js

# Check API connectivity
curl https://pryde-social.onrender.com/api/health
```

---

## 🛠️ **Troubleshooting**

### **Build Fails**
- Check build logs in Cloudflare Dashboard
- Verify environment variables are set
- Ensure `package.json` has all dependencies

### **Site Not Updating**
- Check if deployment succeeded
- Clear browser cache (Ctrl+Shift+R)
- Wait 5-10 minutes for CDN propagation

### **503 Errors**
- Check if backend is running: https://pryde-social.onrender.com/api/health
- Clear service worker cache
- Check browser console for errors

---

## 📝 **Next Steps**

1. ✅ Push changes to GitHub
2. ✅ Verify automatic deployment works
3. ✅ Test site at prydeapp.com
4. ✅ Monitor build logs
5. ✅ Set up preview deployments for PRs (optional)

---

## 🔗 **Useful Links**

- **Cloudflare Pages Docs**: https://developers.cloudflare.com/pages/
- **Vite Docs**: https://vitejs.dev/
- **Your Backend**: https://pryde-social.onrender.com/api/health
- **Your Frontend**: https://prydeapp.com

