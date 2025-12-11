# 📦 Cloudflare Security Setup - Files Summary

This directory contains everything you need to set up comprehensive security for Pryde Social using Cloudflare's FREE PLAN.

---

## 📁 Files Included

### **1. CLOUDFLARE-SETUP-README.md** 📖
**The complete guide** - Start here!

**Contains:**
- Why use the API instead of manual setup
- Detailed explanation of all 5 security rules
- Step-by-step instructions to get API credentials
- How to run the setup scripts
- Verification steps
- Troubleshooting guide
- Post-setup recommendations

**Read this first!**

---

### **2. cloudflare-setup.js** 🟨 (Node.js Script)
**Automated setup script for Node.js users**

**Features:**
- Adds all 5 security rules automatically
- Configures security settings (TLS, HTTPS, etc.)
- Lists existing rules
- Deletes old rules (optional)
- Enables Bot Fight Mode (if available)

**Usage:**
```bash
node cloudflare-setup.js --setup
```

**Requirements:**
- Node.js installed
- Cloudflare API token
- Zone ID

---

### **3. cloudflare-setup.py** 🐍 (Python Script)
**Automated setup script for Python users**

**Features:**
- Same functionality as the Node.js version
- Adds all 5 security rules automatically
- Configures security settings
- Lists/deletes existing rules

**Usage:**
```bash
pip install requests
python cloudflare-setup.py --setup
```

**Requirements:**
- Python 3.x installed
- `requests` library (`pip install requests`)
- Cloudflare API token
- Zone ID

---

### **4. CLOUDFLARE-RULES-QUICK-REFERENCE.md** ⚡
**Quick copy-paste reference for manual setup**

**Use this if:**
- You prefer manual setup via Cloudflare dashboard
- You don't want to use the API scripts
- You need to quickly copy rule expressions

**Contains:**
- All 5 rule expressions ready to copy-paste
- Step-by-step manual setup instructions
- Additional security settings checklist
- DNS records for email security
- Quick verification commands

---

### **5. cloudflare-security-rules.md** 📋
**Comprehensive documentation of all rules**

**Contains:**
- Detailed explanation of each rule
- Why each rule is important
- Rate limiting configurations
- Bot management settings
- WAF settings
- Email security (DMARC, SPF, DKIM)
- Performance & security settings

**Use this for:**
- Understanding what each rule does
- Reference when customizing rules
- Learning about Cloudflare security features

---

## 🚀 Quick Start Guide

### **Option 1: Automated Setup (Recommended)**

**For Node.js users:**
```bash
# 1. Edit cloudflare-setup.js and add your API token and Zone ID
# 2. Run the script
node cloudflare-setup.js --setup
```

**For Python users:**
```bash
# 1. Install dependencies
pip install requests

# 2. Edit cloudflare-setup.py and add your API token and Zone ID
# 3. Run the script
python cloudflare-setup.py --setup
```

---

### **Option 2: Manual Setup**

1. Open `CLOUDFLARE-RULES-QUICK-REFERENCE.md`
2. Go to Cloudflare Dashboard: https://dash.cloudflare.com
3. Navigate to: Security → WAF → Custom rules
4. Copy-paste each rule expression from the reference guide
5. Follow the verification checklist

---

## 🎯 What Gets Installed

### **5 Security Rules (Optimized for FREE PLAN):**

1. **Block AI Bots & Scrapers** 🔴 CRITICAL
   - Protects LGBTQ+ user privacy
   - Blocks OpenAI, Anthropic, Google, Meta AI bots
   - Blocks malicious scrapers and scanners

2. **Protect Admin & Auth Endpoints** 🟠 HIGH
   - Challenges suspicious traffic to `/api/admin`
   - Protects login, signup, password reset
   - Blocks high threat score traffic

3. **Block Attack Patterns** 🟠 HIGH
   - Blocks SQL injection attempts
   - Blocks XSS attacks
   - Blocks malicious file uploads

4. **Geographic Restrictions** 🟡 MEDIUM
   - Blocks signups from high-risk countries
   - Allows browsing for LGBTQ+ users
   - Balances security with access

5. **Whitelist (Optional)** 🟢 OPTIONAL
   - Skip security checks for your IP
   - Allow trusted monitoring services
   - Disabled by default

---

### **Additional Security Settings:**

- ✅ Security Level: Medium
- ✅ Browser Integrity Check: ON
- ✅ Always Use HTTPS: ON
- ✅ Minimum TLS Version: 1.2
- ✅ TLS 1.3: ON
- ✅ Bot Fight Mode: ON (if available)

---

## 📊 Comparison: API vs Manual Setup

| Feature | API Scripts | Manual Setup |
|---------|-------------|--------------|
| **Speed** | ⚡ 30 seconds | 🐌 15-20 minutes |
| **Accuracy** | ✅ No typos | ⚠️ Copy-paste errors possible |
| **Repeatability** | ✅ Easy to re-run | ❌ Must redo manually |
| **Version Control** | ✅ Can commit to Git | ❌ No version control |
| **Learning Curve** | 🟡 Need API token | 🟢 Familiar dashboard |
| **Customization** | ✅ Edit script | ✅ Edit in dashboard |

**Recommendation:** Use API scripts for initial setup, then customize in dashboard if needed.

---

## ✅ Prerequisites

### **For API Scripts:**
- Cloudflare account with prydeapp.com added
- API token with "Edit zone WAF" permissions
- Zone ID for prydeapp.com
- Node.js OR Python installed

### **For Manual Setup:**
- Cloudflare account with prydeapp.com added
- Access to Cloudflare dashboard
- 10-15 minutes of time

---

## 🔑 Getting API Credentials

### **API Token:**
1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use template: "Edit zone WAF"
4. Select zone: prydeapp.com
5. Copy the token

### **Zone ID:**
1. Go to: https://dash.cloudflare.com
2. Select domain: prydeapp.com
3. Find "Zone ID" in right sidebar (Overview page)
4. Copy the ID

---

## 🆘 Troubleshooting

### **Scripts fail with "API token invalid"**
- Check you copied the entire token
- Verify token has "Edit zone WAF" permissions
- Make sure token is for prydeapp.com zone

### **"Rule limit exceeded" error**
- Free plan allows 5 rules maximum
- Delete existing rules first: `--delete` flag
- Or manually delete in dashboard

### **Website blocked after setup**
- Check Security → Events for false positives
- Temporarily disable rules to identify issue
- Add your IP to Rule 5 whitelist

**Full troubleshooting guide:** See `CLOUDFLARE-SETUP-README.md`

---

## 📚 Additional Resources

- **Cloudflare Dashboard:** https://dash.cloudflare.com
- **API Documentation:** https://developers.cloudflare.com/api/
- **WAF Custom Rules:** https://developers.cloudflare.com/waf/custom-rules/
- **Security Events:** https://dash.cloudflare.com → Security → Events

---

## 🏳️‍🌈 Why This Matters for Pryde Social

As an LGBTQ+ platform, these security rules are **critical**:

1. **Privacy Protection** - Prevents AI companies from harvesting user content
2. **Attack Prevention** - Blocks malicious actors targeting LGBTQ+ communities
3. **Smart Access Control** - Balances security with access for users in hostile regions
4. **Enterprise Security** - Professional-grade protection on a free plan

**Your users' safety and privacy depend on these protections!**

---

## ✅ Next Steps

1. **Read:** `CLOUDFLARE-SETUP-README.md` (complete guide)
2. **Choose:** API scripts OR manual setup
3. **Setup:** Follow the instructions for your chosen method
4. **Verify:** Test your website and check Security → Events
5. **Monitor:** Weekly check for blocked traffic and false positives

---

## 📞 Need Help?

- **Full Guide:** `CLOUDFLARE-SETUP-README.md`
- **Quick Reference:** `CLOUDFLARE-RULES-QUICK-REFERENCE.md`
- **Rule Details:** `cloudflare-security-rules.md`
- **Cloudflare Support:** https://support.cloudflare.com/

---

**Ready to secure Pryde Social? Let's go!** 🚀🏳️‍🌈

