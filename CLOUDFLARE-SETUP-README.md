# 🔥 Cloudflare Security Setup for Pryde Social

This guide will help you set up comprehensive security rules for Pryde Social using the **Cloudflare API**, optimized for the **FREE PLAN** (5 rules maximum).

---

## 📋 Table of Contents

1. [Why Use the API?](#why-use-the-api)
2. [What Rules Will Be Added?](#what-rules-will-be-added)
3. [Prerequisites](#prerequisites)
4. [Getting Your API Credentials](#getting-your-api-credentials)
5. [Installation & Usage](#installation--usage)
6. [Verification](#verification)
7. [Troubleshooting](#troubleshooting)

---

## 🤔 Why Use the API?

**Problem:** Cloudflare's free plan only allows **5 custom security rules** via the dashboard.

**Solution:** By using the Cloudflare API, we can:
- ✅ Add all rules programmatically in seconds
- ✅ Combine multiple security checks into single rules
- ✅ Stay within the 5-rule limit
- ✅ Easily update or delete rules
- ✅ Version control your security configuration

---

## 🛡️ What Rules Will Be Added?

### **Rule 1: Block AI Bots & Malicious Scrapers** 🔴 CRITICAL
**Protects:** LGBTQ+ user privacy from AI training data harvesting

**Blocks:**
- OpenAI GPTBot, ChatGPT
- Anthropic Claude-Web
- Google-Extended (Bard/Gemini)
- Facebook/Meta AI bots
- Perplexity, Diffbot, ByteDance
- Scrapy, curl, wget, python-requests
- Security scanners (sqlmap, nikto, nmap)
- Empty user agents

---

### **Rule 2: Protect Admin & Auth Endpoints** 🟠 HIGH
**Protects:** Admin panel and authentication endpoints

**Challenges traffic when:**
- Accessing `/api/admin` with threat score > 10
- Accessing `/api/auth/login`, `/api/auth/signup`, `/api/auth/reset-password` with threat score > 5
- Any request with threat score > 20

---

### **Rule 3: Block Attack Patterns** 🟠 HIGH
**Protects:** Against common web attacks

**Blocks:**
- SQL injection attempts (`UNION SELECT`, `DROP TABLE`)
- XSS attacks (`<script>`, `javascript:`, `onerror=`, `onload=`)
- Malicious file uploads (`.php`, `.exe`, `.sh`, `.bat`, `.cmd`)

---

### **Rule 4: Geographic Restrictions** 🟡 MEDIUM
**Protects:** Against abuse while allowing LGBTQ+ users to browse

**Blocks signups from:**
- 🇮🇷 Iran, 🇦🇫 Afghanistan, 🇵🇰 Pakistan, 🇮🇶 Iraq
- 🇺🇬 Uganda, 🇸🇦 Saudi Arabia
- 🇷🇺 Russia, 🇨🇳 China, 🇰🇵 North Korea

**Note:** Only blocks `/api/auth/signup` - users can still browse content!

---

### **Rule 5: Whitelist (Disabled by Default)** 🟢 OPTIONAL
**Purpose:** Skip security checks for trusted IPs/services

**Default (disabled):**
- Your development IP: `1.2.3.4` (update this!)
- UptimeRobot monitoring service

**To enable:** Update the IP address and enable in Cloudflare dashboard

---

## ✅ Prerequisites

### **Option 1: Node.js (Recommended)**
```bash
# Check if Node.js is installed
node --version

# If not installed, download from: https://nodejs.org
```

### **Option 2: Python**
```bash
# Check if Python is installed
python --version

# Install requests library
pip install requests
```

---

## 🔑 Getting Your API Credentials

### **Step 1: Get Your Cloudflare API Token**

1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click **"Create Token"**
3. Use template: **"Edit zone WAF"**
4. Under **Zone Resources**, select:
   - **Include** → **Specific zone** → **prydeapp.com**
5. Click **"Continue to summary"**
6. Click **"Create Token"**
7. **COPY THE TOKEN** (you won't see it again!)

**Example token:**
```
y_12345abcdefghijklmnopqrstuvwxyz1234567890
```

---

### **Step 2: Get Your Zone ID**

1. Go to: https://dash.cloudflare.com
2. Click on your domain: **prydeapp.com**
3. Scroll down on the **Overview** page
4. Find **"Zone ID"** in the right sidebar (under API section)
5. Click to copy

**Example Zone ID:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

---

## 🚀 Installation & Usage

### **Option 1: Using Node.js**

#### **1. Update the script with your credentials:**

Open `cloudflare-setup.js` and update lines 15-16:

```javascript
const CLOUDFLARE_API_TOKEN = 'your_actual_token_here';
const ZONE_ID = 'your_actual_zone_id_here';
```

#### **2. Run the script:**

```bash
# List existing rules
node cloudflare-setup.js --list

# Add all security rules (will prompt for confirmation)
node cloudflare-setup.js --setup

# Delete existing rules and add new ones
node cloudflare-setup.js --delete --setup
```

---

### **Option 2: Using Python**

#### **1. Install dependencies:**

```bash
pip install requests
```

#### **2. Update the script with your credentials:**

Open `cloudflare-setup.py` and update lines 16-17:

```python
CLOUDFLARE_API_TOKEN = 'your_actual_token_here'
ZONE_ID = 'your_actual_zone_id_here'
```

#### **3. Run the script:**

```bash
# List existing rules
python cloudflare-setup.py --list

# Add all security rules (will prompt for confirmation)
python cloudflare-setup.py --setup

# Delete existing rules and add new ones
python cloudflare-setup.py --setup --delete

# Skip confirmation prompts
python cloudflare-setup.py --setup --force
```

---

## 📊 Expected Output

```
═══════════════════════════════════════════════════════════════
🏳️‍🌈  PRYDE SOCIAL - CLOUDFLARE SECURITY SETUP
═══════════════════════════════════════════════════════════════

📋 Listing existing security rules...

Found 2 existing rules:

1. Block High-Risk Countries
   Action: block
   Enabled: True

2. Leaked credential check
   Action: block
   Enabled: True

🔥 Adding Cloudflare Security Rules...

📝 Adding Rule 1/5: Block AI bots, scrapers, and malicious user agents...
   ✅ Success!

📝 Adding Rule 2/5: Protect admin panel, auth endpoints, and challenge high threat...
   ✅ Success!

📝 Adding Rule 3/5: Block SQL injection, XSS attacks, and malicious file upload...
   ✅ Success!

📝 Adding Rule 4/5: Block signups from high-risk countries while allowing read...
   ✅ Success!

📝 Adding Rule 5/5: Whitelist your development IP and trusted services...
   ✅ Success!

✅ All security rules added!

🔐 Configuring security settings...

✅ Security level set to Medium
✅ Browser Integrity Check enabled
✅ Always Use HTTPS enabled
✅ Minimum TLS version set to 1.2
✅ TLS 1.3 enabled

═══════════════════════════════════════════════════════════════
✅  SETUP COMPLETE!
═══════════════════════════════════════════════════════════════

🎯 Next Steps:
1. Visit https://dash.cloudflare.com and verify the rules
2. Test your website to ensure no false positives
3. Monitor Security → Events for blocked traffic
4. Update Rule 5 with your development IP address
```

---

## ✅ Verification

### **1. Check Rules in Cloudflare Dashboard**

1. Go to: https://dash.cloudflare.com
2. Select your domain: **prydeapp.com**
3. Navigate to: **Security → WAF → Custom rules**
4. You should see 5 rules listed

---

### **2. Test Your Website**

```bash
# Test that your website still works
curl -I https://prydeapp.com

# Should return: HTTP/2 200
```

---

### **3. Test AI Bot Blocking**

```bash
# This should be blocked
curl -A "GPTBot" https://prydeapp.com

# Should return: HTTP/2 403 (Forbidden)
```

---

### **4. Monitor Security Events**

1. Go to: **Security → Events**
2. You should see blocked requests appearing here
3. Filter by:
   - **Action:** Block
   - **Service:** Firewall
   - **Source:** Custom rule

---

## 🔧 Troubleshooting

### **Problem: "API token invalid"**

**Solution:**
1. Make sure you copied the entire token (starts with `y_` or similar)
2. Check that the token has **"Edit zone WAF"** permissions
3. Verify the token is for the correct zone (prydeapp.com)
4. Try creating a new token

---

### **Problem: "Zone ID not found"**

**Solution:**
1. Make sure you copied the Zone ID from the correct domain
2. Zone ID should be 32 characters (letters and numbers)
3. Check for extra spaces or quotes

---

### **Problem: "Rule limit exceeded"**

**Solution:**
1. You already have 5 rules - delete some first:
   ```bash
   node cloudflare-setup.js --delete
   ```
2. Or manually delete rules in the dashboard:
   - Go to: Security → WAF → Custom rules
   - Delete old rules you don't need

---

### **Problem: "False positives - legitimate users blocked"**

**Solution:**
1. Check Security → Events to see what's being blocked
2. If blocking legitimate traffic, you can:
   - **Option A:** Disable the specific rule temporarily
   - **Option B:** Add exceptions to Rule 5 (whitelist)
   - **Option C:** Adjust threat score thresholds in the rules

**Example: Whitelist a specific IP**
```javascript
// In cloudflare-setup.js, update Rule 5:
expression: '(ip.src in {1.2.3.4 5.6.7.8}) or (http.user_agent contains "UptimeRobot")'
```

---

### **Problem: "Script fails with network error"**

**Solution:**
1. Check your internet connection
2. Verify Cloudflare API is accessible:
   ```bash
   curl https://api.cloudflare.com/client/v4/user/tokens/verify \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```
3. Check if your firewall is blocking the API

---

### **Problem: "Bot Fight Mode failed to enable"**

**Solution:**
- Bot Fight Mode may not be available on the free plan
- This is optional - the custom rules still provide excellent protection
- Consider upgrading to Pro plan for advanced bot protection

---

## 🎯 Post-Setup Recommendations

### **1. Update Rule 5 with Your Development IP**

Find your IP address:
```bash
curl https://api.ipify.org
```

Update Rule 5 in Cloudflare dashboard:
1. Go to: Security → WAF → Custom rules
2. Click on Rule 5: "Whitelist your development IP..."
3. Click **Edit**
4. Replace `1.2.3.4` with your actual IP
5. Change **Enabled** to **ON**
6. Click **Deploy**

---

### **2. Set Up Email Security (DMARC, SPF, DKIM)**

Add these DNS records in Cloudflare:

#### **DMARC Record:**
```
Type: TXT
Name: _dmarc
Content: v=DMARC1; p=quarantine; rua=mailto:dmarc@prydeapp.com; fo=1
```

#### **SPF Record:**
```
Type: TXT
Name: @
Content: v=spf1 include:_spf.google.com ~all
```
*(Adjust based on your email provider)*

---

### **3. Enable Additional Cloudflare Features**

#### **Page Rules (for SPA routing):**
1. Go to: **Rules → Page Rules**
2. Create rule:
   - **URL:** `prydeapp.com/*`
   - **Settings:**
     - Cache Level: Standard
     - Always Use HTTPS: ON
     - Automatic HTTPS Rewrites: ON

#### **Transform Rules (optional):**
1. Go to: **Rules → Transform Rules**
2. Add security headers:
   - `X-Frame-Options: DENY`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`

---

### **4. Monitor and Adjust**

**Weekly:**
- Check Security → Events for blocked traffic
- Look for patterns in blocked requests
- Adjust rules if needed

**Monthly:**
- Review threat landscape
- Update AI bot user agents (new bots emerge)
- Check for false positives

---

## 📚 Additional Resources

### **Cloudflare Documentation:**
- WAF Custom Rules: https://developers.cloudflare.com/waf/custom-rules/
- Expression Builder: https://developers.cloudflare.com/ruleset-engine/rules-language/
- Bot Management: https://developers.cloudflare.com/bots/

### **Security Best Practices:**
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- LGBTQ+ Platform Security: https://www.glaad.org/digital-safety

---

## 🆘 Need Help?

If you encounter issues:

1. **Check the logs:**
   - Cloudflare: Security → Events
   - Your server: Check backend logs for errors

2. **Test in stages:**
   - Add rules one at a time
   - Test after each rule
   - Identify which rule causes issues

3. **Temporarily disable rules:**
   - In Cloudflare dashboard
   - Toggle **Enabled** to OFF
   - Test if issue resolves

4. **Contact support:**
   - Cloudflare Community: https://community.cloudflare.com/
   - Cloudflare Support: https://support.cloudflare.com/

---

## 🏳️‍🌈 Why This Matters for Pryde Social

As an LGBTQ+ platform, security and privacy are **critical**:

1. **AI Bot Blocking** - Prevents user content from being used to train AI models without consent
2. **Geographic Restrictions** - Balances security with access for LGBTQ+ users in hostile regions
3. **Attack Protection** - Prevents malicious actors from targeting your community
4. **Privacy First** - Ensures user data stays private and secure

These rules provide **enterprise-level security** on a **free plan**! 🎉

---

## ✅ Summary

**What you get:**
- 🔴 AI bot blocking (protects LGBTQ+ user privacy)
- 🟠 Admin/Auth protection (reduces attack surface)
- 🟠 Attack pattern blocking (SQL injection, XSS, etc.)
- 🟡 Smart geo-blocking (security + LGBTQ+ access)
- 🟢 Whitelist capability (for trusted IPs)
- 🔐 Enhanced security settings (TLS 1.3, HTTPS, etc.)

**All within the 5-rule free plan limit!** 🚀

---

**Ready to secure Pryde Social? Run the setup script now!** 🏳️‍🌈

```bash
# Node.js
node cloudflare-setup.js --setup

# Python
python cloudflare-setup.py --setup
```

---

**Questions? Issues? Let me know!** 💜
