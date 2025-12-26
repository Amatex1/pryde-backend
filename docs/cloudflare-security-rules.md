# 🔥 Cloudflare Security Rules for Pryde Social

## 📋 Table of Contents
1. [AI Bot Blocking](#1-ai-bot-blocking-critical)
2. [Admin Panel Protection](#2-admin-panel-protection)
3. [Auth Endpoint Protection](#3-auth-endpoint-protection)
4. [Rate Limiting Rules](#4-rate-limiting-rules)
5. [Geographic Access Control](#5-geographic-access-control-modified)
6. [Additional Security Rules](#6-additional-security-rules)

---

## 🚨 **CRITICAL RULES (Add These First)**

### **1. AI Bot Blocking (CRITICAL)**

**Priority:** 🔴 **CRITICAL** - Protects LGBTQ+ user privacy

**Rule Name:** `Block AI Bots and Scrapers`

**Expression:**
```
(cf.bot_management.score lt 30) or 
(http.user_agent contains "GPTBot") or 
(http.user_agent contains "ChatGPT") or 
(http.user_agent contains "Claude-Web") or 
(http.user_agent contains "anthropic-ai") or 
(http.user_agent contains "Google-Extended") or 
(http.user_agent contains "CCBot") or 
(http.user_agent contains "FacebookBot") or 
(http.user_agent contains "Bytespider") or 
(http.user_agent contains "Applebot-Extended") or 
(http.user_agent contains "PerplexityBot") or 
(http.user_agent contains "Diffbot") or 
(http.user_agent contains "Scrapy") or 
(http.user_agent contains "python-requests") or 
(http.user_agent contains "curl") or 
(http.user_agent contains "wget")
```

**Action:** `Block`

**Why:** Prevents AI companies from scraping LGBTQ+ user content, photos, and personal information to train their models.

---

### **2. Admin Panel Protection**

**Priority:** 🟠 **HIGH** - Reduces attack surface

**Rule Name:** `Protect Admin Panel`

**Expression:**
```
(http.request.uri.path contains "/api/admin") and 
(cf.threat_score gt 10 or cf.bot_management.score lt 30)
```

**Action:** `Managed Challenge`

**Why:** Blocks malicious traffic to admin endpoints before it reaches your server, saving resources and preventing reconnaissance.

---

### **3. Auth Endpoint Protection**

**Priority:** 🟠 **HIGH** - Prevents brute force attacks

**Rule Name:** `Protect Auth Endpoints`

**Expression:**
```
(http.request.uri.path contains "/api/auth/login" or 
 http.request.uri.path contains "/api/auth/signup" or 
 http.request.uri.path contains "/api/auth/reset-password") and 
(cf.threat_score gt 5)
```

**Action:** `Managed Challenge`

**Why:** Challenges suspicious login attempts before they consume server resources.

---

## ⏱️ **4. Rate Limiting Rules**

### **4a. Login Rate Limit**

**Rule Name:** `Rate Limit Login Attempts`

**Expression:**
```
http.request.uri.path eq "/api/auth/login"
```

**Characteristics:** `IP Address`

**Period:** `1 minute`

**Requests per period:** `5`

**Action when rate limit exceeded:** `Block`

**Duration:** `15 minutes`

**Why:** Prevents distributed brute force attacks across multiple IPs.

---

### **4b. Signup Rate Limit**

**Rule Name:** `Rate Limit Signups`

**Expression:**
```
http.request.uri.path eq "/api/auth/signup"
```

**Characteristics:** `IP Address`

**Period:** `1 hour`

**Requests per period:** `3`

**Action when rate limit exceeded:** `Block`

**Duration:** `1 hour`

**Why:** Prevents mass account creation and spam.

---

### **4c. API Rate Limit**

**Rule Name:** `Rate Limit API Requests`

**Expression:**
```
http.request.uri.path contains "/api/"
```

**Characteristics:** `IP Address`

**Period:** `1 minute`

**Requests per period:** `100`

**Action when rate limit exceeded:** `Block`

**Duration:** `5 minutes`

**Why:** Prevents API abuse and DDoS attacks.

---

### **4d. Upload Rate Limit**

**Rule Name:** `Rate Limit Uploads`

**Expression:**
```
http.request.uri.path contains "/api/upload"
```

**Characteristics:** `IP Address`

**Period:** `1 hour`

**Requests per period:** `50`

**Action when rate limit exceeded:** `Block`

**Duration:** `1 hour`

**Why:** Prevents storage abuse and bandwidth exhaustion.

---

## 🌍 **5. Geographic Access Control (Modified)**

### **5a. Block Account Creation from High-Risk Countries**

**Rule Name:** `Restrict Signups from High-Risk Countries`

**Expression:**
```
(ip.geoip.country in {"IR" "AF" "PK" "IQ" "UG" "SA" "RU" "CN" "KP"}) and 
(http.request.uri.path contains "/api/auth/signup")
```

**Action:** `Block`

**Why:** Prevents abuse while still allowing LGBTQ+ users in these countries to browse content and access resources.

**Countries blocked from signup:**
- 🇮🇷 Iran - LGBTQ+ illegal, death penalty
- 🇦🇫 Afghanistan - LGBTQ+ illegal, death penalty
- 🇵🇰 Pakistan - LGBTQ+ illegal
- 🇮🇶 Iraq - LGBTQ+ illegal
- 🇺🇬 Uganda - LGBTQ+ illegal, life imprisonment
- 🇸🇦 Saudi Arabia - LGBTQ+ illegal, death penalty
- 🇷🇺 Russia - LGBTQ+ "propaganda" banned
- 🇨🇳 China - LGBTQ+ content censored
- 🇰🇵 North Korea - LGBTQ+ illegal

---

## 🛡️ **6. Additional Security Rules**

### **6a. Block Known Attack Patterns**

**Rule Name:** `Block SQL Injection and XSS Attempts`

**Expression:**
```
(http.request.uri.query contains "UNION SELECT") or
(http.request.uri.query contains "DROP TABLE") or
(http.request.uri.query contains "<script>") or
(http.request.uri.query contains "javascript:") or
(http.request.uri.query contains "onerror=") or
(http.request.uri.query contains "onload=") or
(http.request.body contains "UNION SELECT") or
(http.request.body contains "DROP TABLE")
```

**Action:** `Block`

**Why:** Blocks common SQL injection and XSS attack patterns.

---

### **6b. Block Suspicious User Agents**

**Rule Name:** `Block Suspicious User Agents`

**Expression:**
```
(http.user_agent eq "") or
(http.user_agent contains "sqlmap") or
(http.user_agent contains "nikto") or
(http.user_agent contains "nmap") or
(http.user_agent contains "masscan") or
(http.user_agent contains "ZmEu") or
(http.user_agent contains "Havij") or
(http.user_agent contains "acunetix")
```

**Action:** `Block`

**Why:** Blocks known hacking tools and scanners.

---

### **6c. Challenge High Threat Score**

**Rule Name:** `Challenge High Threat Traffic`

**Expression:**
```
cf.threat_score gt 20
```

**Action:** `Managed Challenge`

**Why:** Challenges traffic that Cloudflare identifies as potentially malicious.

---

### **6d. Block Tor Exit Nodes (Optional)**

**Rule Name:** `Block Tor Exit Nodes`

**Expression:**
```
ip.geoip.is_tor_exit_node
```

**Action:** `Block`

**Why:** Prevents abuse from anonymous Tor users. **⚠️ WARNING:** This may block legitimate LGBTQ+ users seeking privacy. Consider using `Managed Challenge` instead of `Block`.

**Alternative (Recommended):**
```
Action: Managed Challenge
```

---

### **6e. Protect Password Reset**

**Rule Name:** `Rate Limit Password Resets`

**Expression:**
```
http.request.uri.path contains "/api/auth/reset-password"
```

**Characteristics:** `IP Address`

**Period:** `1 hour`

**Requests per period:** `3`

**Action when rate limit exceeded:** `Block`

**Duration:** `1 hour`

**Why:** Prevents password reset abuse and email bombing.

---

### **6f. Block File Upload Exploits**

**Rule Name:** `Block Malicious File Uploads`

**Expression:**
```
(http.request.uri.path contains "/api/upload") and
(http.request.body contains ".php" or
 http.request.body contains ".exe" or
 http.request.body contains ".sh" or
 http.request.body contains ".bat" or
 http.request.body contains ".cmd")
```

**Action:** `Block`

**Why:** Prevents malicious file upload attempts.

---

## 📊 **7. Bot Management Settings**

### **Enable Bot Fight Mode**

**Location:** Security → Bots

**Settings:**
- ✅ **Bot Fight Mode:** ON
- ✅ **Super Bot Fight Mode:** ON (if available on your plan)
- ✅ **Verified Bots:** Allow (Google, Bing, etc.)
- ❌ **AI Crawlers:** Block

---

## 🔐 **8. WAF (Web Application Firewall) Settings**

### **Enable Managed Rulesets**

**Location:** Security → WAF

**Rulesets to Enable:**
- ✅ **Cloudflare Managed Ruleset**
- ✅ **Cloudflare OWASP Core Ruleset**
- ✅ **Cloudflare Exposed Credentials Check** (already enabled)

**Sensitivity Level:** `Medium` (or `High` if you experience false positives)

---

## 🌐 **9. Page Rules for SPA Routing**

### **Rule Name:** `SPA Routing - Serve index.html`

**URL Pattern:** `prydeapp.com/*`

**Settings:**
- **Cache Level:** Standard
- **Browser Cache TTL:** 4 hours
- **Always Use HTTPS:** ON
- **Automatic HTTPS Rewrites:** ON

**Why:** Ensures your React SPA routes work correctly.

---

## 📧 **10. Email Security (DNS Records)**

### **DMARC Record**

**Type:** `TXT`

**Name:** `_dmarc`

**Content:**
```
v=DMARC1; p=quarantine; rua=mailto:dmarc@prydeapp.com; ruf=mailto:dmarc@prydeapp.com; fo=1; adkim=s; aspf=s; pct=100
```

**Why:** Prevents email spoofing and phishing attacks using your domain.

---

### **SPF Record**

**Type:** `TXT`

**Name:** `@`

**Content:**
```
v=spf1 include:_spf.google.com include:sendgrid.net ~all
```

**Why:** Authorizes which mail servers can send email on behalf of your domain.

**Note:** Adjust based on your email provider (Google Workspace, SendGrid, etc.)

---

### **DKIM Record**

**Type:** `TXT`

**Name:** `default._domainkey` (or as provided by your email provider)

**Content:** (Provided by your email service - Google Workspace, SendGrid, etc.)

**Why:** Cryptographically signs your emails to prove authenticity.

---

## 🚀 **11. Performance & Security Settings**

### **SSL/TLS Settings**

**Location:** SSL/TLS → Overview

**Settings:**
- **SSL/TLS Encryption Mode:** `Full (strict)`
- **Minimum TLS Version:** `TLS 1.2`
- **TLS 1.3:** `ON`
- **Automatic HTTPS Rewrites:** `ON`
- **Always Use HTTPS:** `ON`

---

### **Security Settings**

**Location:** Security → Settings

**Settings:**
- **Security Level:** `Medium`
- **Challenge Passage:** `30 minutes`
- **Browser Integrity Check:** `ON`
- **Privacy Pass Support:** `ON`

---

## 📝 **How to Add These Rules in Cloudflare**

### **For Security Rules (WAF Custom Rules):**

1. Log in to Cloudflare Dashboard
2. Select your domain: `prydeapp.com`
3. Go to **Security → WAF**
4. Click **Create rule**
5. Enter the **Rule Name**
6. Paste the **Expression** (use "Edit expression" for complex rules)
7. Select the **Action** (Block, Challenge, etc.)
8. Click **Deploy**

---

### **For Rate Limiting Rules:**

1. Go to **Security → WAF → Rate limiting rules**
2. Click **Create rule**
3. Enter the **Rule Name**
4. Paste the **Expression**
5. Set **Characteristics:** IP Address
6. Set **Period** and **Requests per period**
7. Choose **Action when rate limit exceeded**
8. Set **Duration**
9. Click **Deploy**

---

## ⚠️ **IMPORTANT NOTES**

### **Testing Your Rules**

1. **Test in "Log" mode first** - Set action to "Log" instead of "Block" to see what would be blocked
2. **Monitor for false positives** - Check Security → Events for blocked legitimate traffic
3. **Whitelist your own IP** - Create a rule to bypass challenges for your development IP
4. **Test from different locations** - Use VPN to test geographic rules

---

### **Whitelisting Legitimate Traffic**

If you need to whitelist specific IPs or user agents:

**Rule Name:** `Whitelist Legitimate Traffic`

**Expression:**
```
(ip.src in {YOUR_IP_ADDRESS}) or
(http.user_agent contains "YourLegitimateBot")
```

**Action:** `Skip` → Select which rules to skip

---

### **Order of Rules Matters**

Cloudflare processes rules in order. Recommended order:

1. **Whitelist rules** (Skip)
2. **Block malicious patterns** (Block)
3. **Geographic restrictions** (Block)
4. **AI bot blocking** (Block)
5. **Admin/Auth protection** (Challenge)
6. **Rate limiting** (varies)
7. **General threat score** (Challenge)

---

## 🎯 **Priority Implementation Plan**

### **Day 1 (Critical):**
1. ✅ Add AI Bot Blocking rule
2. ✅ Add Admin Panel Protection
3. ✅ Add Auth Endpoint Protection
4. ✅ Enable Bot Fight Mode

### **Day 2 (High Priority):**
5. ✅ Add all Rate Limiting rules
6. ✅ Modify Geographic blocking (signup only)
7. ✅ Enable WAF Managed Rulesets

### **Week 1 (Medium Priority):**
8. ✅ Add additional security rules (SQL injection, XSS, etc.)
9. ✅ Configure SSL/TLS settings
10. ✅ Set up email security (DMARC, SPF, DKIM)

### **Ongoing:**
11. 📊 Monitor Security Events
12. 🔍 Review and adjust rules based on traffic patterns
13. 🛡️ Update bot user agent list as new AI crawlers emerge

---

## 📞 **Support & Resources**

- **Cloudflare Docs:** https://developers.cloudflare.com/waf/
- **Expression Builder:** https://developers.cloudflare.com/ruleset-engine/rules-language/
- **Bot Management:** https://developers.cloudflare.com/bots/

---

## ✅ **Summary**

This configuration provides:
- 🔴 **AI bot blocking** - Protects LGBTQ+ user privacy
- 🟠 **Admin/Auth protection** - Reduces attack surface
- 🟡 **Rate limiting** - Prevents abuse and DDoS
- 🌍 **Smart geo-blocking** - Balances security with LGBTQ+ access
- 🛡️ **WAF protection** - Blocks common attacks
- 📧 **Email security** - Prevents phishing
- 🔐 **SSL/TLS** - Encrypts all traffic

**Your Pryde Social platform will be significantly more secure with these rules in place!** 🏳️‍🌈

---

**Questions or need help implementing? Let me know!** 🚀

