# ✅ Migration to Cloudflare Pages - Quick Checklist

## 🎯 Goal
Move frontend from Render to Cloudflare Pages (FREE + Faster)
Keep backend on Render (FREE tier)

---

## 📋 Step-by-Step Checklist

### ✅ Step 1: Verify Cloudflare Pages Settings

1. [ ] Go to https://dash.cloudflare.com
2. [ ] Click **Workers & Pages**
3. [ ] Click on **pryde-social** project
4. [ ] Go to **Settings** → **Builds & deployments**
5. [ ] Verify build settings:
   - [ ] Build command: `npm run build:prod`
   - [ ] Build output directory: `dist`
   - [ ] Root directory: `/` (empty or root)

### ✅ Step 2: Add Environment Variables

1. [ ] In Cloudflare Pages, go to **Settings** → **Environment variables**
2. [ ] Click **Add variable** for Production:
   - [ ] `VITE_API_URL` = `https://pryde-social.onrender.com/api`
   - [ ] `VITE_SOCKET_URL` = `https://pryde-social.onrender.com`
   - [ ] `NODE_VERSION` = `18`
3. [ ] Click **Save**

### ✅ Step 3: Configure Custom Domain

1. [ ] In **pryde-social** Pages project
2. [ ] Go to **Custom domains** tab
3. [ ] Click **Set up a custom domain**
4. [ ] Enter: `prydeapp.com`
5. [ ] Click **Continue**
6. [ ] Wait for DNS to configure (automatic)
7. [ ] (Optional) Add `www.prydeapp.com` as well

### ✅ Step 4: Verify DNS Records

1. [ ] Go to **DNS** → **Records** for `prydeapp.com`
2. [ ] Verify you see CNAME records pointing to Cloudflare Pages
3. [ ] Records should be **Proxied** (orange cloud icon)

### ✅ Step 5: Trigger New Deployment

**Option A: Automatic (Recommended)**
1. [ ] Cloudflare Pages auto-deploys from GitHub
2. [ ] Just wait for next push, or...

**Option B: Manual**
1. [ ] Go to **Deployments** tab in Cloudflare Pages
2. [ ] Click **Create deployment**
3. [ ] Select branch: `main`
4. [ ] Click **Save and Deploy**
5. [ ] Wait for build to complete (2-5 minutes)

### ✅ Step 6: Test the Deployment

1. [ ] Visit: https://pryde-social.pages.dev
   - [ ] Site loads correctly
   - [ ] No console errors
   
2. [ ] Visit: https://prydeapp.com (may take time for DNS)
   - [ ] Site loads correctly
   
3. [ ] Test functionality:
   - [ ] Login works
   - [ ] Can create a post
   - [ ] Can send a message
   - [ ] Notifications work
   - [ ] Real-time features work

### ✅ Step 7: Delete Render Frontend Service

**ONLY do this after confirming Cloudflare Pages works!**

1. [ ] Go to https://dashboard.render.com
2. [ ] Find **pryde-frontend** service
3. [ ] Click on it
4. [ ] Go to **Settings** (bottom of left sidebar)
5. [ ] Scroll to bottom
6. [ ] Click **Delete Web Service**
7. [ ] Confirm deletion

### ✅ Step 8: Keep Render Backend Running

1. [ ] Verify **pryde-social** backend is still running
2. [ ] Check: https://pryde-social.onrender.com/api/health
3. [ ] Should return: `{"status":"ok","message":"Pryde Social API is running"}`

---

## 🎉 Success Criteria

After completing all steps:

- ✅ Frontend hosted on Cloudflare Pages (FREE)
- ✅ Backend hosted on Render (FREE tier)
- ✅ Domain `prydeapp.com` points to Cloudflare Pages
- ✅ All features working (login, posts, messages, real-time)
- ✅ Render frontend service deleted
- ✅ Saving money and getting better performance!

---

## 📊 Before vs After

### BEFORE:
```
Cloudflare DNS → Render Frontend ($) → Render Backend (Free)
```

### AFTER:
```
Cloudflare DNS → Cloudflare Pages (FREE) → Render Backend (Free)
```

**Total Cost: $0/month** 🎉

---

## 🆘 Troubleshooting

### Build Fails on Cloudflare Pages
- Check build command is `npm run build:prod`
- Check environment variables are set
- Check build logs for errors

### Site Loads But API Calls Fail
- Check environment variables in Cloudflare Pages
- Check backend is running on Render
- Check browser console for CORS errors

### Domain Not Working
- Wait up to 48 hours for DNS propagation
- Clear browser cache
- Try incognito mode
- Check DNS records in Cloudflare

### Real-time Features Not Working
- Check WebSocket connection in browser console
- Verify `VITE_SOCKET_URL` is set correctly
- Check backend logs on Render

---

## 📞 Need Help?

If you get stuck:
1. Check the detailed guide: `CLOUDFLARE_PAGES_SETUP.md`
2. Check Cloudflare Pages build logs
3. Check Render backend logs
4. Check browser console for errors

---

## 🔗 Quick Links

- Cloudflare Dashboard: https://dash.cloudflare.com
- Render Dashboard: https://dashboard.render.com
- GitHub Repo: https://github.com/Amatex1/pryde-frontend---backend

---

**Ready to start?** Follow the checklist step by step! ✅

