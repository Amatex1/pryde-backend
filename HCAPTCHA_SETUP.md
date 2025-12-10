# 🔐 hCaptcha Setup Instructions

## ✅ Files Created

I've created the necessary `.env` files for you:

1. **Frontend `.env`**: `F:\Desktop\pryde-backend\.env`
2. **Backend `.env`**: `F:\Desktop\pryde-backend\server\.env` (updated)

---

## 📝 What You Need to Do

### Step 1: Get Your Keys from hCaptcha Dashboard

1. Go to: https://dashboard.hcaptcha.com/sites
2. Click on **"Pryde Social"** (the one with "Always Challenge - Auto")
3. Copy your **Site Key** (long alphanumeric string)
4. Copy your **Secret Key** (another long alphanumeric string)

---

### Step 2: Update Frontend `.env`

**File**: `F:\Desktop\pryde-backend\.env`

**Find this line:**
```env
VITE_HCAPTCHA_SITE_KEY=your_site_key_here
```

**Replace with:**
```env
VITE_HCAPTCHA_SITE_KEY=paste_your_actual_site_key_here
```

---

### Step 3: Update Backend `.env`

**File**: `F:\Desktop\pryde-backend\server\.env`

**Find this line:**
```env
HCAPTCHA_SECRET=your_secret_key_here
```

**Replace with:**
```env
HCAPTCHA_SECRET=paste_your_actual_secret_key_here
```

---

### Step 4: Restart Your Development Server

```powershell
# Stop the current server (Ctrl+C in the terminal)
# Then restart
npm run dev
```

---

## 🎯 Example (DO NOT USE THESE - THEY'RE EXAMPLES!)

**Frontend `.env`:**
```env
VITE_HCAPTCHA_SITE_KEY=a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Backend `.env`:**
```env
HCAPTCHA_SECRET=0xABCDEF1234567890ABCDEF1234567890ABCDEF12
```

---

## 🚀 For Production Deployment

### When deploying to Render.com (Backend):

1. Go to your Render dashboard
2. Select your backend service
3. Go to **Environment** tab
4. Add new environment variable:
   - **Key**: `HCAPTCHA_SECRET`
   - **Value**: Your actual secret key
5. Click **Save Changes**

### When deploying to SiteGround (Frontend):

You'll need to create a `.env.production` file:

**File**: `F:\Desktop\pryde-backend\.env.production`

```env
# Production Environment Variables
VITE_API_URL=https://pryde-social.onrender.com/api
VITE_SOCKET_URL=https://pryde-social.onrender.com
VITE_HCAPTCHA_SITE_KEY=your_actual_site_key_here
```

Then rebuild:
```powershell
npm run build
```

---

## ✅ Verification

After updating the keys and restarting:

1. Go to: http://localhost:5173/register
2. You should see the **real hCaptcha widget** (not the test one)
3. Try registering a new account
4. The CAPTCHA should work properly

---

## 🔒 Security Notes

- ✅ `.env` files are in `.gitignore` - they won't be committed to Git
- ✅ Never share your Secret Key publicly
- ✅ Site Key is safe to expose (it's used in frontend)
- ✅ Secret Key must stay private (it's used in backend)

---

## 📂 Your Project Structure

```
F:\Desktop\pryde-backend\
├── .env                    ← Frontend environment variables (CREATED)
├── src/                    ← Frontend code
├── server/
│   ├── .env               ← Backend environment variables (UPDATED)
│   ├── routes/
│   ├── models/
│   └── ...
├── package.json
└── ...
```

---

## ❓ Need Help?

If you see errors after updating:
1. Make sure you copied the keys correctly (no extra spaces)
2. Make sure you're using the "Pryde Social" site (not the "99.9% Passive" one)
3. Restart your development server
4. Check the browser console for errors

