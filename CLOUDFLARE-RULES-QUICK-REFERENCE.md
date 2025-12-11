# 🔥 Cloudflare Rules - Quick Reference Card

**For manual setup via Cloudflare Dashboard**

If you prefer to add rules manually instead of using the API scripts, copy-paste these expressions directly into the Cloudflare dashboard.

---

## 📍 How to Add Rules Manually

1. Go to: https://dash.cloudflare.com
2. Select your domain: **prydeapp.com**
3. Navigate to: **Security → WAF → Custom rules**
4. Click **"Create rule"**
5. Enter the **Rule name**
6. Click **"Edit expression"** (switch from Form to Expression mode)
7. **Copy-paste** the expression below
8. Select the **Action**
9. Click **"Deploy"**

---

## 🛡️ RULE 1: Block AI Bots & Malicious Scrapers

**Rule Name:** `Block AI Bots and Scrapers`

**Action:** `Block`

**Expression:**
```
(cf.bot_management.score lt 30) or (http.user_agent contains "GPTBot") or (http.user_agent contains "ChatGPT") or (http.user_agent contains "Claude-Web") or (http.user_agent contains "anthropic-ai") or (http.user_agent contains "Google-Extended") or (http.user_agent contains "CCBot") or (http.user_agent contains "FacebookBot") or (http.user_agent contains "Bytespider") or (http.user_agent contains "Applebot-Extended") or (http.user_agent contains "PerplexityBot") or (http.user_agent contains "Diffbot") or (http.user_agent contains "Scrapy") or (http.user_agent contains "python-requests") or (http.user_agent contains "curl") or (http.user_agent contains "wget") or (http.user_agent contains "sqlmap") or (http.user_agent contains "nikto") or (http.user_agent contains "nmap") or (http.user_agent contains "masscan") or (http.user_agent eq "")
```

---

## 🛡️ RULE 2: Protect Admin & Auth Endpoints

**Rule Name:** `Protect Admin and Auth Endpoints`

**Action:** `Managed Challenge`

**Expression:**
```
((http.request.uri.path contains "/api/admin") and (cf.threat_score gt 10)) or ((http.request.uri.path contains "/api/auth/login" or http.request.uri.path contains "/api/auth/signup" or http.request.uri.path contains "/api/auth/reset-password") and (cf.threat_score gt 5)) or (cf.threat_score gt 20)
```

---

## 🛡️ RULE 3: Block Attack Patterns

**Rule Name:** `Block SQL Injection and XSS Attacks`

**Action:** `Block`

**Expression:**
```
(http.request.uri.query contains "UNION SELECT") or (http.request.uri.query contains "DROP TABLE") or (http.request.uri.query contains "<script>") or (http.request.uri.query contains "javascript:") or (http.request.uri.query contains "onerror=") or (http.request.uri.query contains "onload=") or ((http.request.uri.path contains "/api/upload") and (http.request.body contains ".php" or http.request.body contains ".exe" or http.request.body contains ".sh" or http.request.body contains ".bat" or http.request.body contains ".cmd"))
```

---

## 🛡️ RULE 4: Geographic Restrictions

**Rule Name:** `Block Signups from High-Risk Countries`

**Action:** `Block`

**Expression:**
```
(ip.geoip.country in {"IR" "AF" "PK" "IQ" "UG" "SA" "RU" "CN" "KP"}) and (http.request.uri.path contains "/api/auth/signup")
```

---

## 🛡️ RULE 5: Whitelist (Optional)

**Rule Name:** `Whitelist Development IP and Trusted Services`

**Action:** `Skip` → Select: `All remaining custom rules`

**Expression:**
```
(ip.src in {1.2.3.4}) or (http.user_agent contains "UptimeRobot")
```

**⚠️ IMPORTANT:** 
- Replace `1.2.3.4` with your actual IP address
- Find your IP: https://api.ipify.org
- Keep this rule **DISABLED** until you update the IP

---

## 📊 Summary Table

| # | Rule Name | Action | Priority |
|---|-----------|--------|----------|
| 1 | Block AI Bots and Scrapers | Block | 🔴 Critical |
| 2 | Protect Admin and Auth Endpoints | Managed Challenge | 🟠 High |
| 3 | Block SQL Injection and XSS Attacks | Block | 🟠 High |
| 4 | Block Signups from High-Risk Countries | Block | 🟡 Medium |
| 5 | Whitelist Development IP | Skip | 🟢 Optional |

---

## ✅ Verification Checklist

After adding all rules:

- [ ] All 5 rules appear in Security → WAF → Custom rules
- [ ] Rules 1-4 are **Enabled**
- [ ] Rule 5 is **Disabled** (until you update your IP)
- [ ] Test your website: https://prydeapp.com
- [ ] Check Security → Events for blocked traffic
- [ ] Update Rule 5 with your actual IP address
- [ ] Enable Rule 5 after updating IP

---

## 🔐 Additional Security Settings

### **Enable These in Cloudflare Dashboard:**

#### **Security → Settings**
- Security Level: `Medium`
- Challenge Passage: `30 minutes`
- Browser Integrity Check: `ON`
- Privacy Pass Support: `ON`

#### **SSL/TLS → Overview**
- SSL/TLS Encryption Mode: `Full (strict)`
- Minimum TLS Version: `TLS 1.2`
- TLS 1.3: `ON`
- Automatic HTTPS Rewrites: `ON`
- Always Use HTTPS: `ON`

#### **Security → Bots**
- Bot Fight Mode: `ON` (if available)
- Super Bot Fight Mode: `ON` (if available on your plan)

---

## 📧 Email Security DNS Records

Add these in **DNS → Records**:

### **DMARC Record**
```
Type: TXT
Name: _dmarc
Content: v=DMARC1; p=quarantine; rua=mailto:dmarc@prydeapp.com; fo=1
TTL: Auto
```

### **SPF Record**
```
Type: TXT
Name: @
Content: v=spf1 include:_spf.google.com ~all
TTL: Auto
```
*(Adjust based on your email provider)*

---

## 🎯 Quick Commands

### **Find Your IP Address:**
```bash
curl https://api.ipify.org
```

### **Test Your Website:**
```bash
curl -I https://prydeapp.com
```

### **Test AI Bot Blocking:**
```bash
curl -A "GPTBot" https://prydeapp.com
# Should return: 403 Forbidden
```

---

## 🏳️‍🌈 Why These Rules Matter

1. **Rule 1** - Protects LGBTQ+ user content from AI training data harvesting
2. **Rule 2** - Prevents unauthorized access to admin panel and brute force attacks
3. **Rule 3** - Blocks common web attacks (SQL injection, XSS, malicious uploads)
4. **Rule 4** - Balances security with LGBTQ+ access (blocks signups, allows browsing)
5. **Rule 5** - Ensures you can always access your site during development

---

**All 5 rules fit within the Cloudflare FREE PLAN limit!** 🎉

**Questions? Check the full guide:** `CLOUDFLARE-SETUP-README.md`

