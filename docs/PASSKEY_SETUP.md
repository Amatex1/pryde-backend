# 🔐 Passkey Setup Guide for Render

## ⚠️ IMPORTANT: Required Environment Variables

For passkeys to work on Render, you **MUST** add these environment variables to your Render backend service.

---

## 📋 Step-by-Step Instructions

### 1. Go to Render Dashboard
- Navigate to: https://dashboard.render.com
- Click on your **backend service** (pryde-social)

### 2. Add Environment Variables
- Click on **"Environment"** in the left sidebar
- Click **"Add Environment Variable"** button
- Add the following two variables:

#### Variable 1: RP_ID
```
Key:   RP_ID
Value: pryde-social.onrender.com
```

#### Variable 2: ORIGIN
```
Key:   ORIGIN
Value: https://prydeapp.com
```

### 3. Save and Redeploy
- Click **"Save Changes"**
- Render will automatically redeploy your service
- Wait for the deployment to complete (usually 2-5 minutes)

---

## 🔍 What These Variables Do

### `RP_ID` (Relying Party ID)
- **Purpose**: Identifies your backend server to the passkey system
- **Value**: Your backend domain (without `https://`)
- **Example**: `pryde-social.onrender.com`
- **Why it's needed**: WebAuthn requires this to bind passkeys to your specific domain

### `ORIGIN` (Origin URL)
- **Purpose**: Specifies which frontend can use the passkeys
- **Value**: Your frontend URL (with `https://`)
- **Example**: `https://prydeapp.com`
- **Why it's needed**: Security measure to prevent other websites from using your passkeys

---

## ✅ Verification

After adding the environment variables and redeploying:

1. **Check Deployment Status**
   - Go to your Render dashboard
   - Wait for "Deploy succeeded" message
   - Check the logs for any errors

2. **Test Passkey Functionality**
   - Go to https://prydeapp.com/settings/security
   - You should see the "Passkeys" section without errors
   - Click "+ Add Passkey"
   - Follow the setup flow
   - If successful, you'll see your passkey listed

---

## 🐛 Troubleshooting

### Still Getting 404 Errors?
1. **Check if deployment completed**
   - Render dashboard should show "Live" status
   - Check deployment logs for errors

2. **Verify environment variables are set**
   - Go to Environment tab in Render
   - Confirm both `RP_ID` and `ORIGIN` are present
   - Values should match exactly (no extra spaces)

3. **Check server logs**
   - Go to "Logs" tab in Render dashboard
   - Look for any errors related to `@simplewebauthn` or passkeys
   - If you see "Cannot find module '@simplewebauthn/server'", the packages weren't installed

### Packages Not Installing?
If `@simplewebauthn` packages aren't installing:
1. Check `server/package.json` includes:
   ```json
   "@simplewebauthn/server": "^13.2.2"
   ```
2. Trigger a fresh deployment:
   - Make a small change to any file
   - Commit and push to trigger redeploy

### Passkey Creation Fails?
- **Error: "Invalid RP ID"**
  - Check `RP_ID` matches your backend domain exactly
  - Should be `pryde-social.onrender.com` (no `https://`)

- **Error: "Origin mismatch"**
  - Check `ORIGIN` matches your frontend URL exactly
  - Should be `https://prydeapp.com` (with `https://`)

---

## 📝 Summary

**Required Actions:**
1. ✅ Add `RP_ID=pryde-social.onrender.com` to Render environment variables
2. ✅ Add `ORIGIN=https://prydeapp.com` to Render environment variables
3. ✅ Save changes and wait for redeploy
4. ✅ Test passkey functionality

**Expected Result:**
- Passkeys section loads without 404 errors
- Users can create passkeys
- Users can login with passkeys
- Passkeys are stored and managed properly

---

## 🎯 Next Steps After Setup

Once passkeys are working:
1. Test the full flow (register → login → delete)
2. Try on multiple devices (phone, laptop, tablet)
3. Test with different browsers (Chrome, Safari, Firefox)
4. Encourage users to set up passkeys for better security

---

**Need Help?** Check the Render logs or contact support if issues persist.

