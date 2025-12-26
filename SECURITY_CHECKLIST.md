# 🔒 Security Checklist for Pryde Backend

## ✅ Completed Actions

- [x] Changed MongoDB password
- [x] `.env` file is in `.gitignore`
- [x] `.env` has never been committed to git
- [x] Created `.env.example` with safe placeholders
- [x] Created security scanner script

---

## 🚨 IMMEDIATE ACTIONS REQUIRED

### 1. Rotate ALL Credentials (Since .env was potentially exposed)

Even though `.env` wasn't committed to git, you should rotate these credentials as a best practice:

#### MongoDB (✅ Already Done)
- [x] Changed MongoDB password
- [ ] Update `MONGO_URI` in Render environment variables
- [ ] Update local `.env` file with new connection string

#### Resend API Key
- [ ] Go to https://resend.com/api-keys
- [ ] Delete old API key: `re_iioho97D_CMaXhgXHHqV8JUNkGsSY2gTC`
- [ ] Create new API key
- [ ] Update in Render environment variables
- [ ] Update in local `.env`

#### JWT Secrets
- [ ] Generate new JWT_SECRET:
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
- [ ] Generate new JWT_REFRESH_SECRET
- [ ] Generate new CSRF_SECRET
- [ ] Generate new MESSAGE_ENCRYPTION_KEY
- [ ] Update all in Render environment variables
- [ ] Update all in local `.env`

#### VAPID Keys (Push Notifications)
- [ ] Generate new VAPID keys:
  ```bash
  npx web-push generate-vapid-keys
  ```
- [ ] Update in Render environment variables
- [ ] Update in local `.env`

#### Backup API Key
- [ ] Generate new backup API key
- [ ] Update in Render environment variables
- [ ] Update in local `.env`

---

## 🛡️ Security Best Practices

### Environment Variables
- ✅ Never commit `.env` files
- ✅ Use `.env.example` for documentation
- ✅ Keep `.env` in `.gitignore`
- [ ] Use different credentials for dev/staging/production
- [ ] Rotate credentials every 90 days

### Git Security
- [ ] Run security scan before every commit:
  ```bash
  node security-scan.js
  ```
- [ ] Review git history for leaked secrets:
  ```bash
  git log --all --full-history --source -- .env
  ```
- [ ] Use git hooks to prevent committing secrets

### MongoDB Atlas Security
- [ ] Enable IP whitelist (don't use 0.0.0.0/0 in production)
- [ ] Use strong passwords (20+ characters)
- [ ] Enable MongoDB Atlas encryption at rest
- [ ] Enable audit logs
- [ ] Set up automated backups

### API Keys
- [ ] Use separate API keys for dev/production
- [ ] Set up API key rotation schedule
- [ ] Monitor API key usage
- [ ] Revoke unused API keys

---

## 🔍 Regular Security Checks

### Weekly
- [ ] Run security scanner: `node security-scan.js`
- [ ] Check for dependency vulnerabilities: `npm audit`
- [ ] Review access logs

### Monthly
- [ ] Review and rotate API keys
- [ ] Check MongoDB Atlas security settings
- [ ] Review user permissions
- [ ] Update dependencies: `npm update`

### Quarterly
- [ ] Rotate all credentials
- [ ] Security audit
- [ ] Penetration testing
- [ ] Review and update security policies

---

## 🚀 Quick Commands

### Run Security Scan
```bash
node security-scan.js
```

### Check for Vulnerabilities
```bash
npm audit
npm audit fix
```

### Generate New Secrets
```bash
# JWT Secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# VAPID Keys
npx web-push generate-vapid-keys

# Random API Key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Check Git History for Secrets
```bash
# Check if .env was ever committed
git log --all --full-history -- .env

# Search for potential secrets in history
git log -p | grep -i "password\|secret\|api_key"
```

---

## 📋 Deployment Checklist

Before deploying to production:

- [ ] All credentials rotated
- [ ] Security scan passes: `node security-scan.js`
- [ ] No vulnerabilities: `npm audit`
- [ ] Environment variables set in Render
- [ ] MongoDB IP whitelist configured
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] HTTPS enforced
- [ ] Security headers configured

---

## 🆘 If Credentials Are Leaked

1. **Immediately rotate ALL credentials**
2. **Check access logs for unauthorized access**
3. **Review recent database changes**
4. **Notify users if data was compromised**
5. **Document the incident**
6. **Implement additional security measures**

---

## 📞 Resources

- MongoDB Atlas Security: https://docs.atlas.mongodb.com/security/
- Resend API: https://resend.com/docs
- OWASP Security Guide: https://owasp.org/
- Node.js Security Best Practices: https://nodejs.org/en/docs/guides/security/

