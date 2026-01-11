# Render Environment Variables Setup

**Date:** 2026-01-11  
**Service:** pryde-backend (srv-d53m9q6r433s73cefo20)

---

## 🔧 **Required Environment Variables**

### **1. Redis Configuration**

Your Redis instance has been created on Render:
- **Name:** pryde-redis
- **ID:** red-d5i30gp5pdvs73bpqrpg
- **Region:** Singapore
- **Plan:** Free
- **Version:** 8.1.4

**Add these to Render:**

Go to: https://dashboard.render.com/web/srv-d53m9q6r433s73cefo20

Click **Environment** tab, then add:

```bash
# Redis Connection (Internal URL from Render)
REDIS_URL=redis://red-d5i30gp5pdvs73bpqrpg:6379

# Or use individual settings:
REDIS_HOST=red-d5i30gp5pdvs73bpqrpg
REDIS_PORT=6379
```

**Note:** Render will automatically provide the internal Redis URL. Use the connection string from the Redis instance dashboard.

---

### **2. VAPID Keys for Push Notifications**

**Generated VAPID Keys:**

```bash
VAPID_PUBLIC_KEY=BCg1RMi2eqpL9OC-lS8v5c19cDxZsbDOPEQwWFW2_M2gW9Fxb8Max98YkPuSaD2c6ZGzlDQZK9Af0A2qVFQsbw0

VAPID_PRIVATE_KEY=_-4ew_dyDL1g-7fIIfDRzGV75B8FL8Gkr-AWiDQyJls
```

**⚠️ SECURITY WARNING:**
- Keep the private key SECRET
- Never commit to git
- Only add to Render environment variables

---

## 📋 **Step-by-Step Setup**

### **Step 1: Get Redis Connection URL**

1. Go to: https://dashboard.render.com/redis/red-d5i30gp5pdvs73bpqrpg
2. Copy the **Internal Connection String**
3. It should look like: `redis://red-d5i30gp5pdvs73bpqrpg:6379`

### **Step 2: Add Environment Variables to Backend Service**

1. Go to: https://dashboard.render.com/web/srv-d53m9q6r433s73cefo20
2. Click **Environment** tab
3. Click **Add Environment Variable**
4. Add each variable:

```bash
# Redis
REDIS_URL=<paste-internal-redis-url-here>

# VAPID Keys
VAPID_PUBLIC_KEY=BCg1RMi2eqpL9OC-lS8v5c19cDxZsbDOPEQwWFW2_M2gW9Fxb8Max98YkPuSaD2c6ZGzlDQyJls
VAPID_PRIVATE_KEY=_-4ew_dyDL1g-7fIIfDRzGV75B8FL8Gkr-AWiDQyJls
```

5. Click **Save Changes**

### **Step 3: Trigger Deployment**

After adding environment variables, Render will automatically redeploy your service.

---

## ✅ **Verification**

After deployment, check the logs:

```bash
# Should see:
✅ Redis connected for rate limiting
✅ VAPID keys configured for push notifications
```

**No more warnings:**
- ❌ "Redis not configured - using in-memory rate limiting"
- ❌ "VAPID keys not configured. Push notifications will not work."

---

## 🔗 **Quick Links**

- **Backend Service:** https://dashboard.render.com/web/srv-d53m9q6r433s73cefo20
- **Redis Instance:** https://dashboard.render.com/redis/red-d5i30gp5pdvs73bpqrpg
- **Backend URL:** https://pryde-backend.onrender.com

---

## 📊 **Current Configuration**

### **Backend Service:**
```yaml
Name: pryde-backend
ID: srv-d53m9q6r433s73cefo20
Region: Singapore
Plan: Starter
Branch: main
Root Directory: server
Build Command: npm install
Start Command: node server.js
```

### **Redis Instance:**
```yaml
Name: pryde-redis
ID: red-d5i30gp5pdvs73bpqrpg
Region: Singapore
Plan: Free
Version: 8.1.4
Max Memory Policy: allkeys-lru
```

---

## 🚀 **Next Steps**

1. ✅ Redis instance created
2. ✅ VAPID keys generated
3. [ ] Add environment variables to Render
4. [ ] Deploy backend
5. [ ] Verify in logs

---

**Ready to deploy!** Add the environment variables and your backend will have Redis and push notifications enabled.

