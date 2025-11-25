# 🚀 Cloudflare Pages Setup Guide

## ✅ Step 1: Verify Current Cloudflare Pages Deployment

### Check Your Cloudflare Pages Settings

1. Go to: https://dash.cloudflare.com
2. Click **Workers & Pages** in the left sidebar
3. Click on **pryde-social** project
4. Verify the following settings:

### Required Build Settings

| Setting | Value |
|---------|-------|
| **Framework preset** | Vite |
| **Build command** | `npm run build:prod` |
| **Build output directory** | `dist` |
| **Root directory** | `/` (leave empty or root) |
| **Node version** | 18 or higher |

### Environment Variables (Add These)

Go to **Settings** → **Environment variables** and add:

| Variable Name | Value |
|---------------|-------|
| `VITE_API_URL` | `https://pryde-social.onrender.com/api` |
| `VITE_SOCKET_URL` | `https://pryde-social.onrender.com` |
| `NODE_VERSION` | `18` |

**Important:** Set these for **Production** environment!

---

## ✅ Step 2: Configure Custom Domain

### Add prydeapp.com to Cloudflare Pages

1. In your **pryde-social** Pages project
2. Go to **Custom domains** tab
3. Click **Set up a custom domain**
4. Enter: `prydeapp.com`
5. Click **Continue**
6. Cloudflare will automatically configure DNS

### Add www subdomain (Optional)

1. Click **Set up a custom domain** again
2. Enter: `www.prydeapp.com`
3. Click **Continue**

---

## ✅ Step 3: Verify DNS Settings

### Check DNS Records

1. Go to **DNS** → **Records** for `prydeapp.com`
2. You should see these records (Cloudflare adds them automatically):

| Type | Name | Target | Proxy Status |
|------|------|--------|--------------|
| CNAME | @ | pryde-social.pages.dev | Proxied (orange cloud) |
| CNAME | www | pryde-social.pages.dev | Proxied (orange cloud) |

**Note:** If you see A/AAAA records instead of CNAME, that's fine too!

---

## ✅ Step 4: Trigger a New Deployment

### Option A: Push to GitHub (Automatic)

Cloudflare Pages auto-deploys when you push to your main branch.

```bash
# Make a small change (or just trigger rebuild)
git commit --allow-empty -m "Trigger Cloudflare Pages deployment"
git push origin main
```

### Option B: Manual Deployment

1. In Cloudflare Pages dashboard
2. Go to **Deployments** tab
3. Click **Create deployment**
4. Select branch: `main`
5. Click **Save and Deploy**

---

## ✅ Step 5: Update Backend CORS

Your backend needs to allow requests from Cloudflare Pages.

### Check Backend CORS Settings

The backend should already allow:
- `https://prydeapp.com`
- `https://www.prydeapp.com`
- `https://pryde-social.pages.dev`

This is already configured in your `server/server.js` file! ✅

---

## ✅ Step 6: Test the Deployment

### After Deployment Completes:

1. **Visit:** https://pryde-social.pages.dev
   - Should show your app
   
2. **Visit:** https://prydeapp.com
   - Should show your app (after DNS propagates)

3. **Test Login:**
   - Try logging in
   - Check browser console for errors
   - Verify API calls work

4. **Test Real-time Features:**
   - Send a message
   - Check notifications
   - Verify WebSocket connection

---

## 🎯 Current vs New Architecture

### BEFORE (Current):
```
prydeapp.com (Cloudflare DNS)
    ↓
Render Frontend (pryde-frontend) - Costs money
    ↓
Render Backend (pryde-social) - Free tier
```

### AFTER (New):
```
prydeapp.com (Cloudflare DNS)
    ↓
Cloudflare Pages (Frontend) - FREE + Fast CDN
    ↓
Render Backend (pryde-social) - Free tier
```

**Savings:** Delete Render frontend = Save resources!

---

## 🔧 Troubleshooting

### Issue: Build Fails on Cloudflare

**Check:**
- Build command is `npm run build:prod`
- Output directory is `dist`
- Environment variables are set

### Issue: API Calls Fail

**Check:**
- Environment variables are set in Cloudflare Pages
- Backend CORS allows Cloudflare Pages URLs
- Backend is running on Render

### Issue: Domain Not Working

**Wait:** DNS propagation can take up to 48 hours
**Check:** DNS records are correct
**Try:** Clear browser cache, try incognito mode

---

## ✅ Success Checklist

- [ ] Cloudflare Pages build settings configured
- [ ] Environment variables added to Cloudflare Pages
- [ ] Custom domain `prydeapp.com` added
- [ ] DNS records verified
- [ ] New deployment triggered
- [ ] Deployment successful
- [ ] Site loads at `pryde-social.pages.dev`
- [ ] Site loads at `prydeapp.com`
- [ ] Login works
- [ ] API calls work
- [ ] Real-time features work
- [ ] Render frontend service deleted

---

## 🎉 Next Steps

Once everything is working:

1. **Delete Render Frontend Service:**
   - Go to Render dashboard
   - Find `pryde-frontend` service
   - Settings → Delete Web Service
   
2. **Keep Render Backend:**
   - `pryde-social` backend stays on Render
   - Free tier is perfect for now
   
3. **Monitor Performance:**
   - Cloudflare Pages has analytics
   - Check load times and errors

---

**Questions?** Let me know if you need help with any step!

