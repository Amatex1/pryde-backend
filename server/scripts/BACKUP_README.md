# 🔐 Pryde Social Backup System

## Overview

This backup system protects your data from loss by creating regular backups of all important collections in your MongoDB database.

**What gets backed up:**
- ✅ Comments
- ✅ Messages (DMs)
- ✅ Conversations
- ✅ Posts
- ✅ Users (excluding passwords)
- ✅ Notifications

---

## 📋 Available Scripts

### 1. **Backup Comments Only**
```bash
node server/scripts/backupComments.js
```
Creates a backup of all comments (both from Comment collection and embedded comments in posts).

### 2. **Backup Everything**
```bash
node server/scripts/backupAll.js
```
Creates a complete backup of all important data (comments, messages, posts, users, etc.).

### 3. **Restore Comments**
```bash
# Restore from latest backup
node server/scripts/restoreComments.js

# Restore from specific backup file
node server/scripts/restoreComments.js comments-backup-2024-12-16.json
```

### 4. **Scheduled Automatic Backups**
```bash
node server/scripts/scheduledBackup.js
```
Runs a backup service that automatically backs up comments daily at 3:00 AM.

**To run in background (production):**
```bash
# Using PM2 (recommended)
pm2 start server/scripts/scheduledBackup.js --name "backup-service"

# Or using nohup
nohup node server/scripts/scheduledBackup.js > backup.log 2>&1 &
```

---

## 📁 Backup Files

All backups are stored in: `server/backups/`

**File naming:**
- `comments-backup-YYYY-MM-DDTHH-MM-SS.json` - Timestamped comment backups
- `comments-backup-latest.json` - Most recent comment backup
- `full-backup-YYYY-MM-DDTHH-MM-SS.json` - Timestamped full backups
- `full-backup-latest.json` - Most recent full backup

---

## 🚀 Quick Start

### First Time Setup

1. **Create your first backup:**
```bash
node server/scripts/backupAll.js
```

2. **Set up automatic daily backups:**
```bash
pm2 start server/scripts/scheduledBackup.js --name "backup-service"
pm2 save
```

3. **Verify backups are working:**
```bash
ls server/backups/
```

---

## 🔄 Restore Process

### To restore comments from a backup:

1. **List available backups:**
```bash
ls server/backups/
```

2. **Restore from latest backup:**
```bash
node server/scripts/restoreComments.js
```

3. **Or restore from specific backup:**
```bash
node server/scripts/restoreComments.js comments-backup-2024-12-16T10-30-00.json
```

**⚠️ WARNING:** The restore script will:
- Update existing comments with the same ID
- Create new comments that don't exist
- Wait 5 seconds before starting (press Ctrl+C to cancel)

---

## 📊 Backup File Structure

```json
{
  "timestamp": "2024-12-16T10:30:00.000Z",
  "stats": {
    "totalComments": 150,
    "totalMessages": 500,
    "totalPosts": 200
  },
  "data": {
    "comments": [...],
    "messages": [...],
    "posts": [...]
  }
}
```

---

## 🛡️ Best Practices

1. **Run backups regularly** - Set up the scheduled backup service
2. **Keep multiple backups** - Don't delete old backups immediately
3. **Test restores** - Periodically test that backups can be restored
4. **Store backups off-server** - Copy backups to cloud storage (Google Drive, Dropbox, etc.)
5. **Monitor backup size** - Large backups may indicate issues

---

## 💡 Tips

- **Backup before major changes** - Always backup before migrations or updates
- **Check backup logs** - Review logs to ensure backups are successful
- **Automate off-site storage** - Use a cron job to copy backups to cloud storage
- **Set up alerts** - Get notified if backups fail

---

## 🆘 Troubleshooting

**Backup fails with "MONGODB_URI not found":**
- Make sure `.env` file exists in `server/` directory
- Check that `MONGODB_URI` or `MONGO_URL` is set

**Restore fails with "Backup file not found":**
- Check that the backup file exists in `server/backups/`
- Use the exact filename (case-sensitive)

**Scheduled backups not running:**
- Check that the process is still running: `pm2 list`
- Check logs: `pm2 logs backup-service`

---

## 📞 Support

If you encounter issues, check:
1. MongoDB connection is working
2. `.env` file has correct credentials
3. `server/backups/` directory exists and is writable
4. Sufficient disk space for backups

