# 🔐 Pryde Social - Complete Backup Guide

## ⚠️ **IMPORTANT: Why You Need Backups**

### **Current Situation:**
- ❌ **MongoDB Atlas M0 (Free Tier)** = **NO automatic backups**
- ❌ **Render Free Tier** = **NO automatic backups**
- ❌ **Cloudflare Pages** = Only hosts frontend files (no database)

**If something goes wrong, ALL your data (posts, comments, DMs, users) will be LOST FOREVER!**

---

## 📊 **Backup Coverage**

### **What Gets Backed Up:**
✅ **Comments** - All comments from Comment collection  
✅ **Messages (DMs)** - All direct messages  
✅ **Conversations** - All conversation threads  
✅ **Posts** - All posts and their data  
✅ **Users** - User profiles (excluding passwords for security)  
✅ **Notifications** - All notifications  

### **What Doesn't Get Backed Up:**
❌ **Uploaded media files** (images, videos) - These are stored in MongoDB GridFS  
❌ **Passwords** (excluded for security)  

---

## 🚀 **Quick Start: Set Up Automatic Backups**

### **Step 1: Start the Backup Service on Render**

1. **Go to Render Dashboard** → Your service → Shell tab

2. **Install PM2** (process manager):
```bash
npm install -g pm2
```

3. **Start the backup service**:
```bash
cd /project/src/server
pm2 start scripts/scheduledBackup.js --name "backup-service"
pm2 save
pm2 startup
```

4. **Verify it's running**:
```bash
pm2 list
pm2 logs backup-service
```

---

### **Step 2: Backup Schedule**

The service will automatically:
- ✅ **Run initial backup** on startup
- ✅ **Daily backup** at 3:00 AM UTC
- ✅ **Safety backup** every 6 hours
- ✅ **Auto-cleanup** old backups (keeps last 30 days)

---

## 📁 **Where Are Backups Stored?**

**Location**: `server/backups/`

**Files**:
- `full-backup-YYYY-MM-DDTHH-MM-SS.json` - Timestamped full backups
- `full-backup-latest.json` - Most recent backup (always up-to-date)

---

## 💾 **Manual Backup (Anytime)**

### **Run a backup manually**:
```bash
cd /project/src/server
node scripts/backupAll.js
```

This will:
1. Connect to MongoDB
2. Fetch all data
3. Create a backup file
4. Show you statistics (how many posts, comments, DMs, etc.)

---

## 🔄 **How to Restore from Backup**

### **Restore Comments**:
```bash
cd /project/src/server

# Restore from latest backup
node scripts/restoreComments.js

# Or restore from specific backup
node scripts/restoreComments.js comments-backup-2024-12-16.json
```

⚠️ **Warning**: Restore will update existing data and create missing data.

---

## 📥 **Download Backups to Your Computer**

### **Option 1: Using Render Shell**
```bash
# View backup files
ls -lh /project/src/server/backups/

# Display backup content (copy and save locally)
cat /project/src/server/backups/full-backup-latest.json
```

### **Option 2: Add to Git (Not Recommended - Large Files)**
```bash
# Only if backups are small
git add server/backups/full-backup-latest.json
git commit -m "Add backup"
git push
```

### **Option 3: Use Cloud Storage (Recommended)**
Set up automatic upload to Google Drive, Dropbox, or AWS S3 (requires additional setup).

---

## 🛡️ **Best Practices**

1. ✅ **Run backups regularly** - Set up the scheduled service
2. ✅ **Download backups** - Store copies on your computer or cloud storage
3. ✅ **Test restores** - Periodically test that backups can be restored
4. ✅ **Monitor backup logs** - Check PM2 logs to ensure backups are successful
5. ✅ **Keep multiple backups** - Don't rely on just one backup file

---

## 📊 **Check Backup Status**

```bash
# View PM2 process list
pm2 list

# View backup service logs
pm2 logs backup-service

# View last 100 lines of logs
pm2 logs backup-service --lines 100

# Stop backup service (if needed)
pm2 stop backup-service

# Restart backup service
pm2 restart backup-service
```

---

## 🆘 **Troubleshooting**

### **Backup service not running**:
```bash
pm2 list
pm2 restart backup-service
```

### **Backup fails with MongoDB connection error**:
- Check that `MONGODB_URI` is set in environment variables
- Verify MongoDB Atlas is accessible

### **Backups taking too much space**:
- Old backups are auto-deleted after 30 days
- Manually delete old backups: `rm server/backups/full-backup-2024-*.json`

---

## 💡 **Upgrade Options (Paid)**

### **MongoDB Atlas Paid Tier** ($9/month):
- ✅ Automatic daily backups
- ✅ Point-in-time recovery
- ✅ More storage and performance

### **Render Paid Tier** ($7/month):
- ✅ Persistent disk storage
- ✅ Better performance
- ✅ More resources

---

## 📞 **Support**

If backups fail or you need help restoring data:
1. Check PM2 logs: `pm2 logs backup-service`
2. Check MongoDB connection
3. Verify disk space: `df -h`
4. Run manual backup to see detailed errors

