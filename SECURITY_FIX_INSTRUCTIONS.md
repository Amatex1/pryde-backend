# 🔐 SECURITY FIX INSTRUCTIONS - PRYDE SOCIAL

**CRITICAL:** Follow these steps IN ORDER to fix the security vulnerabilities.

---

## 📋 **CHECKLIST**

- [ ] Step 1: Rotate MongoDB credentials
- [ ] Step 2: Update JWT secret
- [ ] Step 3: Generate message encryption key
- [ ] Step 4: Update local .env files
- [ ] Step 5: Update Render environment variables
- [ ] Step 6: Remove secrets from Git history
- [ ] Step 7: Force push to GitHub
- [ ] Step 8: Encrypt existing messages
- [ ] Step 9: Verify encryption is working
- [ ] Step 10: Update Privacy Policy

---

## 🔑 **STEP 1: ROTATE MONGODB CREDENTIALS**

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Log in → **Database Access** → Find user `prydeAdmin` → **Edit**
3. Click **"Edit Password"** → **"Autogenerate Secure Password"**
4. **COPY THE NEW PASSWORD** (you'll need it below)
5. Click **"Update User"**

**New Password:** `vJFVwYTkQcfiVHJq` (write it here temporarily)

---

## 🔐 **STEP 2: NEW SECRETS GENERATED**

I've generated new secure secrets for you:

### **JWT Secret:**
```
c5fc121a293eb952ed6876dd2d1af1fdd31b8953e2f0400f4fdb46a29ad74d9e95b0d8a39e6f5b5b581cac2196c9568a2992af16cfd0e44ecfabf1035446c48c
```

### **Message Encryption Key:**
```
d15d07aac79e40e71e5475d329c53444205afb9700e35a99565276c06fccd711
```

---

## 📝 **STEP 3: UPDATE LOCAL .ENV FILES**

### **Update `server/.env`:**

Replace the entire file with:

```env
MONGODB_URI=mongodb+srv://prydeAdmin:<NEW_PASSWORD_HERE>@pryde-social.bvs3dyu.mongodb.net/pryde-social?appName=Pryde-Social
JWT_SECRET=c5fc121a293eb952ed6876dd2d1af1fdd31b8953e2f0400f4fdb46a29ad74d9e95b0d8a39e6f5b5b581cac2196c9568a2992af16cfd0e44ecfabf1035446c48c
MESSAGE_ENCRYPTION_KEY=d15d07aac79e40e71e5475d329c53444205afb9700e35a99565276c06fccd711
PORT=9000
BASE_URL=http://localhost:9000
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

**Replace `<NEW_PASSWORD_HERE>` with your new MongoDB password from Step 1!**

### **Update `.env` (root):**

Replace the entire file with:

```env
VITE_API_URL=http://localhost:9000/api
VITE_SOCKET_URL=http://localhost:9000
MONGO_URL=mongodb+srv://prydeAdmin:<NEW_PASSWORD_HERE>@pryde-social.bvs3dyu.mongodb.net/pryde-social?retryWrites=true&w=majority
```

**Replace `<NEW_PASSWORD_HERE>` with your new MongoDB password from Step 1!**

---

## ☁️ **STEP 4: UPDATE RENDER ENVIRONMENT VARIABLES**

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Select your **backend service**
3. Go to **Environment** tab
4. Update these variables:

```
MONGODB_URI=mongodb+srv://prydeAdmin:<NEW_PASSWORD>@pryde-social.bvs3dyu.mongodb.net/pryde-social?appName=Pryde-Social
JWT_SECRET=c5fc121a293eb952ed6876dd2d1af1fdd31b8953e2f0400f4fdb46a29ad74d9e95b0d8a39e6f5b5b581cac2196c9568a2992af16cfd0e44ecfabf1035446c48c
MESSAGE_ENCRYPTION_KEY=d15d07aac79e40e71e5475d329c53444205afb9700e35a99565276c06fccd711
```

5. Click **"Save Changes"**
6. Render will automatically redeploy with new environment variables

---

## 🗑️ **STEP 5: REMOVE SECRETS FROM GIT HISTORY**

**⚠️ WARNING:** This rewrites Git history. If you're working with a team, coordinate first!

### **Option A: Using PowerShell (Windows):**

```powershell
# Run the script I created
.\Remove-SecretsFromGit.ps1
```

### **Option B: Manual commands:**

```bash
# Remove .env files from all commits
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env server/.env" \
  --prune-empty --tag-name-filter cat -- --all

# Cleanup
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

---

## 🚀 **STEP 6: FORCE PUSH TO GITHUB**

**⚠️ WARNING:** This will rewrite history on GitHub!

```bash
# Force push all branches
git push origin --force --all

# Force push all tags
git push origin --force --tags
```

**If you have team members:** They will need to re-clone the repository or reset their local copies.

---

## 🔒 **STEP 7: ENCRYPT EXISTING MESSAGES**

After deploying the new code with encryption:

```bash
cd server
node scripts/encrypt-existing-messages.js
```

This will encrypt all existing plain-text messages in your database.

---

## ✅ **STEP 8: VERIFY ENCRYPTION IS WORKING**

1. Send a test message in your app
2. Check MongoDB Atlas → Browse Collections → Messages
3. The `content` field should look like encrypted hex: `a1b2c3d4e5f6...`
4. In the app, the message should display normally (decrypted)

---

## 📄 **STEP 9: UPDATE PRIVACY POLICY**

The Privacy Policy currently claims messages are encrypted. Now it's TRUE! ✅

No changes needed - the claim is now accurate.

---

## 🎉 **DONE!**

Your Pryde Social application is now secure:
- ✅ New MongoDB credentials
- ✅ New JWT secret
- ✅ Messages encrypted at rest
- ✅ Secrets removed from Git history
- ✅ Privacy Policy is accurate

---

## 📞 **NEED HELP?**

If you encounter any issues, let me know and I'll help troubleshoot!

