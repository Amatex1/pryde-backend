# Git History Cleanup Guide

## 🚨 CRITICAL: Remove Exposed Secrets from Git History

Your `.env` files containing MongoDB credentials and JWT secrets were committed to Git history and are publicly visible on GitHub.

---

## ⚡ Quick Start

### Option 1: Run the Batch File (Easiest)
```bash
# Double-click or run:
clean-git-history.bat
```

### Option 2: Manual Commands
```bash
# Remove .env files from all commits
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env server/.env" --prune-empty --tag-name-filter cat -- --all

# Clean up references
rmdir /s /q .git\refs\original
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Verify removal
git log --all --full-history -- ".env" "server/.env"
```

---

## 📋 Complete Process

### Step 1: Clean Git History
Run `clean-git-history.bat` or the manual commands above.

**This will:**
- Remove `.env` and `server/.env` from ALL commits
- Rewrite Git history
- Clean up references

**Time:** 2-5 minutes depending on repository size

---

### Step 2: Generate New Credentials

#### MongoDB Atlas:
1. Go to https://cloud.mongodb.com
2. Navigate to Database Access
3. Delete old user or rotate password
4. Create new user with strong password
5. Update connection string in `.env` files

#### JWT Secret:
```bash
# Generate new random secret (PowerShell)
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

### Step 3: Update .env Files

**Root `.env`:**
```env
MONGODB_URI=mongodb+srv://NEW_USER:NEW_PASSWORD@cluster.mongodb.net/pryde
JWT_SECRET=YOUR_NEW_64_CHAR_SECRET
```

**`server/.env`:**
```env
MONGODB_URI=mongodb+srv://NEW_USER:NEW_PASSWORD@cluster.mongodb.net/pryde
JWT_SECRET=YOUR_NEW_64_CHAR_SECRET
```

**IMPORTANT:** Use the SAME new credentials in both files!

---

### Step 4: Force Push to Remote

```bash
# Push rewritten history
git push origin --force --all
git push origin --force --tags
```

**⚠️ WARNING:** This will overwrite remote history!

---

### Step 5: Notify Team

If you have team members, they MUST:
1. Delete their local repository
2. Re-clone from GitHub
3. Get new `.env` files from you (send securely, NOT via Git)

---

## ✅ Verification

### Check Local History
```bash
# Should return nothing
git log --all --full-history -- ".env" "server/.env"
```

### Check GitHub
1. Go to your repository on GitHub
2. Search for "MONGODB_URI" or "JWT_SECRET"
3. Should find NO results in code or commit history

---

## 🔒 Security Best Practices

### Already Implemented ✅
- `.env` files in `.gitignore`
- `.env.example` templates (no secrets)

### After Cleanup ✅
- [ ] New MongoDB credentials generated
- [ ] New JWT secret generated
- [ ] `.env` files updated
- [ ] Git history cleaned
- [ ] Force pushed to remote
- [ ] Team notified (if applicable)

---

## 🆘 Troubleshooting

### "Cannot rewrite branch" error
```bash
# Remove backup refs
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### "Remote rejected" on force push
```bash
# Ensure you have write access
# May need to temporarily disable branch protection on GitHub
```

### Still see secrets in GitHub
- Wait 5-10 minutes for GitHub to update search index
- Try searching in "Code" and "Commits" tabs
- Check repository settings > Secrets scanning

---

## 📞 Need Help?

If you encounter issues:
1. Don't panic - your local code is safe
2. Check Git status: `git status`
3. Check remote: `git remote -v`
4. Can always restore from backup if needed

---

## ⏱️ Estimated Time

- **Cleanup:** 5 minutes
- **Generate new credentials:** 10 minutes
- **Update and test:** 15 minutes
- **Total:** ~30 minutes

---

**Remember:** After cleanup, the old credentials are still exposed in GitHub's history cache. Rotate them IMMEDIATELY!

