# MongoDB Atlas Setup - Quick Start Guide

**Time Required:** 15-20 minutes  
**Difficulty:** Beginner-friendly

---

## 🎯 Goal

Configure your MongoDB Atlas database for optimal performance and security in production.

---

## 📋 Prerequisites

- [ ] MongoDB Atlas account (free tier is fine to start)
- [ ] Render.com account (or your hosting provider)
- [ ] Access to your backend repository

---

## 🚀 Step-by-Step Setup

### Step 1: Configure Network Access (5 minutes)

**Location:** MongoDB Atlas → Security → Network Access

1. Click "Add IP Address"
2. Choose one of these options:

   **Option A: Development (Quick Start)**
   ```
   IP Address: 0.0.0.0/0
   Description: Allow from anywhere (TEMPORARY - for testing only)
   ```
   ⚠️ **Remove this before going to production!**

   **Option B: Production (Recommended)**
   ```
   Get your Render.com outbound IPs:
   1. Go to Render Dashboard → Your Service
   2. Find "Outbound IP Addresses" section
   3. Add each IP to MongoDB Atlas whitelist
   ```

3. Click "Confirm"

✅ **Checkpoint:** You should see your IP(s) in the whitelist

---

### Step 2: Create Database User (3 minutes)

**Location:** MongoDB Atlas → Security → Database Access

1. Click "Add New Database User"
2. Fill in the form:
   ```
   Authentication Method: Password
   Username: pryde-app-user
   Password: [Click "Autogenerate Secure Password" - SAVE THIS!]
   Database User Privileges: Read and write to any database
   ```

3. Click "Add User"

✅ **Checkpoint:** Save the password in a secure location (you'll need it for the connection string)

---

### Step 3: Get Your Connection String (2 minutes)

**Location:** MongoDB Atlas → Deployment → Database → Connect

1. Click "Connect" on your cluster
2. Choose "Connect your application"
3. Select "Node.js" and version "5.5 or later"
4. Copy the connection string

   **Example:**
   ```
   mongodb+srv://pryde-app-user:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

5. Replace `<password>` with your actual password
6. Add database name: `/pryde-social` before the `?`

   **Final string:**
   ```
   mongodb+srv://pryde-app-user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/pryde-social?retryWrites=true&w=majority&readPreference=primaryPreferred&authSource=admin
   ```

✅ **Checkpoint:** Your connection string should have the password and database name filled in

---

### Step 4: Update Render Environment Variables (3 minutes)

**Location:** Render Dashboard → Your Service → Environment

1. Go to your backend service on Render
2. Click "Environment" tab
3. Add/Update these variables:
   ```
   MONGO_URI = [paste your connection string from Step 3]
   MONGO_MAX_POOL_SIZE = 50
   MONGO_MIN_POOL_SIZE = 10
   ```

4. Click "Save Changes"
5. Render will automatically redeploy

✅ **Checkpoint:** Your service should redeploy and connect to MongoDB

---

### Step 5: Enable Backups (2 minutes)

**Location:** MongoDB Atlas → Deployment → Backups

**For Free Tier (M0):**
- ⚠️ Automated backups not available
- Recommendation: Run manual backups weekly
- See `scripts/backup-database.sh` (coming soon)

**For Paid Tier (M10+):**
1. Click "Enable Cloud Backup"
2. Configure retention:
   ```
   Snapshot Frequency: Every 6 hours
   Daily Snapshots: Keep for 7 days
   Weekly Snapshots: Keep for 4 weeks
   ```
3. Click "Enable"

✅ **Checkpoint:** Backups are enabled (or you have a manual backup plan)

---

### Step 6: Create Database Indexes (5 minutes)

**Run the automated index creation script:**

```bash
# In your backend directory
cd f:/Desktop/pryde-backend

# Install dependencies (if not already installed)
npm install

# Run the index creation script
node scripts/create-indexes.js
```

**Expected output:**
```
📡 Connecting to MongoDB...
✅ Connected to MongoDB

🔨 Creating indexes...

📝 Creating indexes for users collection...
✅ Users indexes created

📝 Creating indexes for posts collection...
✅ Posts indexes created

... (more collections)

🎉 All indexes created successfully!
```

✅ **Checkpoint:** All indexes created without errors

---

### Step 7: Set Up Monitoring (3 minutes)

**Location:** MongoDB Atlas → Alerts

1. Click "Add Alert"
2. Create these critical alerts:

   **Alert 1: Cluster Unavailable**
   ```
   Condition: Cluster becomes unavailable
   Threshold: Immediate
   Notification: Email
   ```

   **Alert 2: High Connections**
   ```
   Condition: Connections > 80% of max
   Threshold: 1,200 (for M10) or 80 (for M0)
   Notification: Email
   ```

   **Alert 3: Disk Space**
   ```
   Condition: Disk usage > 80%
   Threshold: 80%
   Notification: Email
   ```

3. Click "Save"

✅ **Checkpoint:** You'll receive email notifications for critical issues

---

## ✅ Verification Checklist

After completing all steps, verify everything is working:

### 1. Check Backend Logs (Render)
```
Expected logs:
📡 Connecting to MongoDB...
✅ MongoDB Connected Successfully
📊 Connection Pool: 10-50 connections
🔧 Environment: production
```

### 2. Test Database Connection
```bash
# Run the test script
node server/scripts/testMongoConnection.js
```

### 3. Check MongoDB Atlas Metrics
- Go to MongoDB Atlas → Metrics
- You should see:
  - ✅ Active connections
  - ✅ Operations per second
  - ✅ Network traffic

---

## 🎉 Success!

Your MongoDB Atlas database is now configured for production with:

- ✅ Secure network access
- ✅ Optimized connection settings
- ✅ Database indexes for fast queries
- ✅ Monitoring and alerts
- ✅ Backup strategy

---

## 📚 Next Steps

1. **Review Performance:**
   - Monitor MongoDB Atlas Performance Advisor
   - Check for slow queries
   - Review index usage

2. **Security Hardening:**
   - Enable 2FA for MongoDB Atlas account
   - Rotate database password quarterly
   - Review audit logs (M10+ only)

3. **Scaling:**
   - Monitor connection pool usage
   - Upgrade cluster tier if needed (M0 → M10 → M20)
   - Enable auto-scaling (M10+)

---

## 🆘 Troubleshooting

### Connection Failed
```
Error: MongoServerSelectionError: connection timed out

Solutions:
1. Check IP whitelist in MongoDB Atlas
2. Verify connection string is correct
3. Check Render outbound IPs haven't changed
```

### Too Many Connections
```
Error: Too many connections

Solutions:
1. Reduce MONGO_MAX_POOL_SIZE
2. Upgrade cluster tier
3. Check for connection leaks in code
```

### Slow Queries
```
Solutions:
1. Run Performance Advisor in MongoDB Atlas
2. Create missing indexes
3. Review query patterns
```

---

## 📖 Additional Resources

- **Detailed Configuration:** See `MONGODB_ATLAS_CONFIGURATION_GUIDE.md`
- **Index Guide:** See `MONGODB_INDEXES_GUIDE.md`
- **MongoDB Atlas Docs:** https://docs.atlas.mongodb.com/
- **Render Docs:** https://render.com/docs

---

**Questions?** Check the troubleshooting section or review the detailed guides.

