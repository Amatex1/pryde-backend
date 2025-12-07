# 🌐 Transfer Domain from SiteGround to Cloudflare

## 📋 Overview

This guide will help you transfer `prydeapp.com` from SiteGround to Cloudflare for:
- 💰 **Lower costs** (Cloudflare charges at-cost, no markup)
- ⚡ **Better performance** (Cloudflare's global CDN)
- 🔒 **Better security** (DDoS protection, SSL, etc.)

---

## ⏱️ Timeline

- **Total time:** 5-7 days (ICANN requirement)
- **Downtime:** None (if done correctly)
- **Cost:** ~$9-10/year (vs SiteGround's higher renewal rates)

---

## ✅ Prerequisites Checklist

Before starting, make sure:
- [ ] Domain is at least 60 days old (ICANN rule)
- [ ] Domain is unlocked at SiteGround
- [ ] You have access to the admin email for the domain
- [ ] Domain is not expired or within 15 days of expiration
- [ ] You have a Cloudflare account

---

## 🚀 Step 1: Prepare Domain at SiteGround

### 1.1 Unlock the Domain

1. Log in to [SiteGround Client Area](https://my.siteground.com)
2. Go to **Websites** → **Domain Registrar**
3. Find `prydeapp.com`
4. Click **Manage Domain**
5. Look for **Domain Lock** or **Transfer Lock**
6. **Disable/Unlock** the domain
7. ✅ Confirm the domain shows as "Unlocked"

### 1.2 Get Authorization Code (EPP Code)

1. Still in the domain management page
2. Look for **Authorization Code**, **EPP Code**, or **Transfer Code**
3. Click **Get Auth Code** or **Request Transfer Code**
4. SiteGround will either:
   - Display the code on screen (copy it!)
   - Email it to your admin email
5. ✅ Save this code - you'll need it for Cloudflare

**Example code format:** `ABC123def456GHI789` (random letters/numbers)

### 1.3 Disable WHOIS Privacy (Temporarily)

1. In domain management, find **WHOIS Privacy** or **Privacy Protection**
2. **Disable** it temporarily (you can re-enable on Cloudflare)
3. This ensures the transfer approval email reaches you

### 1.4 Verify Admin Email

1. Check the **Administrative Contact Email** for the domain
2. Make sure you have access to this email
3. The transfer approval email will be sent here

---

## 🌩️ Step 2: Initiate Transfer on Cloudflare

### 2.1 Add Domain to Cloudflare (If Not Already Added)

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click **Add a Site**
3. Enter: `prydeapp.com`
4. Click **Add Site**
5. Select **Free Plan** (or any plan you prefer)
6. Click **Continue**

### 2.2 Update Nameservers (IMPORTANT - Do This First!)

Cloudflare will show you two nameservers like:
```
ava.ns.cloudflare.com
bob.ns.cloudflare.com
```

**Update nameservers at SiteGround:**
1. Go back to SiteGround domain management
2. Find **Nameservers** section
3. Change from SiteGround nameservers to Cloudflare nameservers
4. Save changes
5. Wait 24-48 hours for DNS propagation

**Why do this first?** This ensures zero downtime during transfer.

### 2.3 Configure DNS Records on Cloudflare

Before transferring, set up your DNS records:

1. In Cloudflare, go to **DNS** → **Records**
2. Add these records:

**Frontend (Render Static Site):**
```
Type: CNAME
Name: @ (or prydeapp.com)
Target: pryde-frontend.onrender.com
Proxy: Enabled (orange cloud)
```

**WWW Redirect:**
```
Type: CNAME
Name: www
Target: prydeapp.com
Proxy: Enabled (orange cloud)
```

**Backend API (Optional):**
```
Type: CNAME
Name: api
Target: pryde-social.onrender.com
Proxy: Enabled (orange cloud)
```

3. Click **Save**

### 2.4 Verify DNS is Working

1. Wait 5-10 minutes
2. Visit `https://prydeapp.com`
3. Your site should load normally
4. ✅ If it works, you're ready to transfer!

---

## 🔄 Step 3: Start Domain Transfer

### 3.1 Initiate Transfer on Cloudflare

1. In Cloudflare Dashboard, go to **Domain Registration** → **Transfer Domains**
2. Click **Transfer Domain**
3. Enter: `prydeapp.com`
4. Click **Continue**

### 3.2 Enter Authorization Code

1. Cloudflare will ask for the **Authorization Code**
2. Paste the EPP code you got from SiteGround
3. Click **Continue**

### 3.3 Review and Pay

1. Review the transfer details
2. Cloudflare will charge at-cost (usually $9-10/year)
3. This adds 1 year to your domain registration
4. Enter payment details
5. Click **Confirm Transfer**

---

## 📧 Step 4: Approve Transfer

### 4.1 Check Your Email

Within a few minutes, you'll receive an email at your admin email:
- **Subject:** "Transfer Approval for prydeapp.com"
- **From:** Your domain registrar or ICANN

### 4.2 Approve the Transfer

1. Open the email
2. Click the **Approve Transfer** link
3. Or follow the instructions to approve

**Important:** If you don't approve, the transfer will auto-approve after 5 days.

---

## ⏳ Step 5: Wait for Transfer Completion

- **Timeline:** 5-7 days (ICANN requirement)
- **Status:** Check Cloudflare dashboard for updates
- **Email:** You'll get confirmation when complete

**During this time:**
- ✅ Your site will continue working normally
- ✅ DNS is already on Cloudflare (no downtime)
- ✅ You can still manage DNS on Cloudflare

---

## ✅ Step 6: Post-Transfer Cleanup

### 6.1 Verify Transfer Complete

1. Go to Cloudflare Dashboard → **Domain Registration**
2. You should see `prydeapp.com` listed
3. Status should be **Active**

### 6.2 Re-enable WHOIS Privacy

1. In Cloudflare, go to **Domain Registration** → **Manage Domain**
2. Find **WHOIS Privacy** or **Redact Contact Information**
3. **Enable** it (usually free on Cloudflare)

### 6.3 Set Auto-Renewal

1. In domain settings, enable **Auto-Renewal**
2. This prevents accidental expiration

### 6.4 Cancel SiteGround Hosting (Optional)

Since you're now on Render for hosting:
1. You can cancel SiteGround hosting
2. Keep the domain registered until transfer completes
3. After transfer, you can fully close SiteGround account

---

## 🎯 Quick Reference

| Step | Action | Time |
|------|--------|------|
| 1 | Unlock domain at SiteGround | 5 min |
| 2 | Get auth code | 2 min |
| 3 | Update nameservers to Cloudflare | 24-48 hrs |
| 4 | Configure DNS on Cloudflare | 10 min |
| 5 | Initiate transfer on Cloudflare | 5 min |
| 6 | Approve transfer email | 1 min |
| 7 | Wait for completion | 5-7 days |

---

## 🐛 Troubleshooting

### "Domain is locked"
**Fix:** Go back to SiteGround and unlock the domain

### "Invalid authorization code"
**Fix:** Request a new code from SiteGround, codes can expire

### "Transfer denied"
**Fix:** Check if domain is less than 60 days old or recently transferred

### "Site is down after nameserver change"
**Fix:** Make sure DNS records are correctly set up on Cloudflare

---

## 💰 Cost Comparison

| Registrar | Annual Cost | Features |
|-----------|-------------|----------|
| SiteGround | $15-20/year | Basic DNS |
| Cloudflare | $9-10/year | DNS + CDN + DDoS + SSL |

**Savings:** ~$5-10/year + better performance!

---

## 🎉 You're Done!

Once the transfer completes:
- ✅ Domain registered with Cloudflare
- ✅ DNS managed by Cloudflare
- ✅ Frontend hosted on Render
- ✅ Backend hosted on Render
- ✅ Lower costs, better performance!

**Questions? Let me know!** 🚀

