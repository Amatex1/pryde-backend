# 🚀 Quick Start - Deploy Pryde Social

This is the shortest current path to production using **Render for the backend** and **Vercel for the frontend**.

## ⏱️ Time Required

- **Backend setup**: 30-45 minutes
- **Frontend setup**: 15-30 minutes
- **Total**: about 1 hour

## 📋 What You Need

1. **Render account** - https://render.com
2. **MongoDB Atlas account** - https://www.mongodb.com/cloud/atlas
3. **Vercel account** - https://vercel.com
4. **GitHub account**
5. A frontend domain such as `prydeapp.com` and an API domain such as `api.prydeapp.com`

## 🎯 Step 1: Setup MongoDB

1. Create a MongoDB Atlas cluster
2. Create a database user and save the password
3. Allow network access from the required locations
4. Copy the connection string for the `pryde-social` database

## 🎯 Step 2: Generate Secrets

Generate strong secrets before configuring Render:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
npx web-push generate-vapid-keys
```

You will need values for at least:
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `CSRF_SECRET`
- `MESSAGE_ENCRYPTION_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

## 🎯 Step 3: Deploy Backend to Render

### Service settings

- **Environment**: Node
- **Build Command**: `node scripts/update-version.js && cd server && npm install`
- **Start Command**: `cd server && npm start`
- **Health Check Path**: `/api/health`

### Required backend environment variables

| Variable | Example value |
|----------|---------------|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `MONGO_URL` | MongoDB Atlas connection string |
| `MONGODB_URI` | Same as `MONGO_URL` |
| `JWT_SECRET` | Generated secret |
| `JWT_REFRESH_SECRET` | Generated secret |
| `CSRF_SECRET` | Generated secret |
| `MESSAGE_ENCRYPTION_KEY` | Generated secret |
| `BASE_URL` | `https://pryde-backend.onrender.com` |
| `FRONTEND_URL` | `https://prydeapp.com` |
| `API_DOMAIN` | `https://api.prydeapp.com` |
| `ROOT_DOMAIN` | `prydeapp.com` |
| `VAPID_PUBLIC_KEY` | Generated public key |
| `VAPID_PRIVATE_KEY` | Generated private key |

### Verify backend deployment

Check:
- `https://pryde-backend.onrender.com/api/health`
- `https://pryde-backend.onrender.com/api/version`

If you later wire up `api.prydeapp.com`, verify the same endpoints on that custom domain too.

## 🎯 Step 4: Deploy Frontend to Vercel

### Vercel project settings

- **Framework preset**: Vite
- **Build command**: `npm run build`
- **Output directory**: `dist`

### Frontend environment variables

Set these in **Vercel → Project Settings → Environment Variables**:

```env
VITE_API_DOMAIN=https://api.prydeapp.com
VITE_HCAPTCHA_SITE_KEY=your-hcaptcha-site-key
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key
```

Leave `VITE_API_URL` and `VITE_SOCKET_URL` unset unless you intentionally need an emergency override.

### Verify frontend deployment

Check:
- `https://prydeapp.com`
- `https://www.prydeapp.com` if you use the `www` variant

## 🎉 Step 5: Smoke Test the Full Stack

### Backend
- [ ] `GET /api/health` returns success
- [ ] Render logs show no startup errors

### Frontend
- [ ] Site loads without console errors
- [ ] Login page loads
- [ ] Register page loads
- [ ] Authenticated API calls work

### Auth/session behavior
- [ ] Login works from the production frontend origin
- [ ] Refresh works without duplicate `refreshToken` cookies
- [ ] Logout clears the refresh cookie cleanly

## 🐛 Common Issues

### "Cannot connect to backend"
- Confirm `VITE_API_DOMAIN=https://api.prydeapp.com` in Vercel
- Confirm `API_DOMAIN` and `ROOT_DOMAIN` are set in Render
- Rebuild/redeploy the frontend from Vercel after env changes

### "CORS error"
- Confirm `FRONTEND_URL` in Render matches the production frontend origin
- Ensure the frontend is loading over `https://`

### "Auth works locally but not in production"
- Ensure the frontend talks directly to `https://api.prydeapp.com`
- Do not rely on a frontend proxy for auth cookies in production
- Confirm the refresh cookie is scoped consistently to `.prydeapp.com`

## 📚 Need More Help?

- See **[README.md](./README.md)** for environment expectations
- See **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** for the current production architecture

