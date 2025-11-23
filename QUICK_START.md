# 🚀 Quick Start - Deploy Pryde Social

This is the fastest way to get your Pryde Social app deployed and running.

## ⏱️ Time Required

- **Backend Setup**: 30-45 minutes
- **Frontend Setup**: 15-30 minutes
- **Total**: ~1 hour

## 📋 What You Need

1. **Render.com account** (free) - [Sign up here](https://render.com)
2. **MongoDB Atlas account** (free) - [Sign up here](https://www.mongodb.com/cloud/atlas)
3. **SiteGround hosting** - Your existing account
4. **GitHub account** - To host your code

## 🎯 Step 1: Setup MongoDB (10 minutes)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a **free cluster**
3. Create a **database user** (save username & password!)
4. **Network Access** → Add IP → **Allow from Anywhere** (0.0.0.0/0)
5. **Connect** → Get connection string
6. Replace `<password>` with your password
7. Replace `<dbname>` with `pryde-social`

**Save this connection string!** You'll need it for Render.

Example: `mongodb+srv://myuser:mypass@cluster0.xxxxx.mongodb.net/pryde-social?retryWrites=true&w=majority`

## 🎯 Step 2: Generate Secrets (2 minutes)

Open terminal and run these commands:

### JWT Secret
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
**Copy the output** - this is your JWT_SECRET

### VAPID Keys (for notifications)
```bash
npx web-push generate-vapid-keys
```
**Copy both keys** - you'll need them for Render

## 🎯 Step 3: Deploy Backend to Render (20 minutes)

### A. Push to GitHub
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### B. Create Render Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New** → **Web Service**
3. Connect your **GitHub repository**
4. Configure:
   - **Name**: `pryde-backend` (or your choice)
   - **Region**: Oregon (or closest to you)
   - **Branch**: `main`
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && npm start`
   - **Plan**: Free

### C. Add Environment Variables

Click **Environment** and add these:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `MONGO_URL` | Your MongoDB connection string |
| `MONGODB_URI` | Same as MONGO_URL |
| `JWT_SECRET` | Your generated JWT secret |
| `BASE_URL` | `https://your-service-name.onrender.com` |
| `FRONTEND_URL` | `https://prydeapp.com` |
| `VAPID_PUBLIC_KEY` | Your VAPID public key |
| `VAPID_PRIVATE_KEY` | Your VAPID private key |

**Important**: Replace `your-service-name` with your actual Render service name!

### D. Deploy

1. Click **Create Web Service**
2. Wait 5-10 minutes for deployment
3. Check logs for errors
4. Visit: `https://your-service-name.onrender.com/api/health`
5. Should see: `{"status":"ok","message":"Pryde Social API is running"}`

**✅ Backend is live!** Copy your Render URL for the next step.

## 🎯 Step 4: Deploy Frontend to SiteGround (20 minutes)

### A. Update Environment Variables

1. Open `.env.production` file
2. Update with your Render URL:
```env
VITE_API_URL=https://your-service-name.onrender.com/api
VITE_SOCKET_URL=https://your-service-name.onrender.com
```

### B. Build Frontend

**Windows (PowerShell)**:
```powershell
.\build-for-production.ps1
```

**Mac/Linux**:
```bash
chmod +x build-for-production.sh
./build-for-production.sh
```

**Or manually**:
```bash
npm run build
```

This creates a `dist` folder with all your files.

### C. Upload to SiteGround

1. Log in to **SiteGround cPanel**
2. Open **File Manager**
3. Navigate to `public_html`
4. **Delete all existing files** (backup first!)
5. **Upload all files** from the `dist` folder:
   - `index.html`
   - `.htaccess` (important!)
   - `assets` folder (complete)
   - Any other files

### D. Enable SSL

1. In cPanel, go to **Security** → **SSL Manager**
2. Install **Let's Encrypt SSL** (free)
3. Enable **Force HTTPS Redirect**

### E. Test Your Site

Visit: `https://prydeapp.com`

**✅ Frontend is live!**

## 🎉 Step 5: Test Everything (10 minutes)

### Backend Tests
- [ ] Visit: `https://your-backend.onrender.com/api/health`
- [ ] Should return: `{"status":"ok",...}`

### Frontend Tests
- [ ] Visit your domain
- [ ] No errors in browser console (F12)
- [ ] Login page loads
- [ ] Register page loads
- [ ] Can create an account
- [ ] Can log in
- [ ] Can create a post
- [ ] Real-time features work

## 🐛 Common Issues

### "Cannot connect to backend"
- Check `.env.production` has correct Render URL
- Rebuild frontend: `npm run build`
- Re-upload to SiteGround

### "404 on page refresh"
- Ensure `.htaccess` is uploaded to SiteGround
- Check file is in `public_html` directory

### "Database connection failed"
- Verify MongoDB connection string
- Check IP whitelist (should be 0.0.0.0/0)
- Verify username/password in connection string

### "CORS error"
- Check `FRONTEND_URL` in Render matches your domain
- Ensure domain includes `https://`

## 📚 Need More Help?

- **Detailed Backend Guide**: [DEPLOYMENT_BACKEND.md](./DEPLOYMENT_BACKEND.md)
- **Detailed Frontend Guide**: [DEPLOYMENT_FRONTEND.md](./DEPLOYMENT_FRONTEND.md)
- **Complete Checklist**: [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
- **Full Documentation**: [DEPLOYMENT_README.md](./DEPLOYMENT_README.md)

## 🎊 You're Done!

Your Pryde Social app is now live and running!

- **Frontend**: https://prydeapp.com
- **Backend**: https://your-backend.onrender.com

### Next Steps

1. Test all features thoroughly
2. Share with friends
3. Monitor Render logs for issues
4. Set up backups
5. Consider upgrading from free tier for better performance

---

**Need help?** Check the detailed guides or review the error logs in:
- Render Dashboard (for backend)
- Browser Console (for frontend)

