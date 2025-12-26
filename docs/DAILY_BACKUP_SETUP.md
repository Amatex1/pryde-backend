# Daily Backup System - Setup Complete

## ✅ What Was Created

A **reasonable daily backup system** that runs once per day instead of every 30 minutes.

### New Backup Schedule:
- ✅ **Once per day** at 3:00 AM UTC
- ✅ **30-day retention** (old backups auto-deleted)
- ✅ **~23 MB total** disk usage (30 backups × 0.77 MB)
- ✅ **No startup backup** (prevents restart loops)

### Comparison:

**Old Aggressive Schedule (disabled):**
- ❌ Every 30 minutes (48 backups/day)
- ❌ Every hour (24 backups/day)
- ❌ On every server startup
- ❌ 90-day retention
- ❌ ~3.3 GB disk usage

**New Daily Schedule (recommended):**
- ✅ Once per day at 3:00 AM UTC
- ✅ 30-day retention
- ✅ ~23 MB disk usage
- ✅ No startup backup

## 📊 Your Data Size

Based on your current database:
- **Total documents:** 209
- **Backup size:** ~0.77 MB per backup
- **Collections:** users (37), posts (51), comments (24), messages (3), notifications (91), etc.

## 🚀 How to Enable

### Option 1: Enable Now (Local Development)

Add to your `.env` file:
```env
ENABLE_AUTO_BACKUP=true
```

Then restart your server:
```bash
npm run server:dev
```

### Option 2: Enable on Render (Production)

1. Go to your Render dashboard
2. Select your backend service
3. Go to **Environment** tab
4. Add new environment variable:
   - Key: `ENABLE_AUTO_BACKUP`
   - Value: `true`
5. Click **Save Changes**
6. Render will automatically redeploy

## 📅 Backup Schedule Details

### When Backups Run:
- **Time:** 3:00 AM UTC every day
- **Your timezone:** Check what time 3:00 AM UTC is in your local timezone
  - PST: 7:00 PM (previous day)
  - EST: 10:00 PM (previous day)
  - GMT: 3:00 AM
  - CET: 4:00 AM

### What Gets Backed Up:
- 💬 Comments
- 💌 Messages (DMs)
- 🗨️ Conversations
- 📝 Posts
- 👤 Users (excluding passwords)
- 🔔 Notifications
- 🚫 Blocks
- 🚨 Reports
- 👥 Friend Requests
- 💬 Chats
- 👥 Group Chats

### Retention:
- Backups older than **30 days** are automatically deleted
- Maximum **~30 backups** stored at any time
- Total disk usage: **~23 MB**

## 📝 Manual Backups

You can still run manual backups anytime:

```bash
# Full backup to local file
npm run backup:all

# Backup with webhook notification (if configured)
npm run backup
```

## 🔔 Backup Notifications (Optional)

To receive notifications when backups complete:

1. Create a Discord or Slack webhook
2. Add to your `.env` file:
   ```env
   BACKUP_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-url
   ```
3. You'll receive a notification with backup stats each day

## 📂 Backup Files

Backups are stored in `server/backups/`:
- `full-backup-2025-12-24T03-00-00.json` - Timestamped backups
- `full-backup-latest.json` - Always points to most recent backup

**Note:** These files are excluded from Git (in `.gitignore`)

## 🔒 Security

Backup files contain sensitive data:
- User information
- Private messages
- Email addresses

**Important:**
- ✅ Backups are excluded from Git
- ✅ Stored locally on server only
- ✅ Auto-deleted after 30 days
- ⚠️ Consider external backup storage for production

## 🛠️ Troubleshooting

### Backups not running?

1. Check if `ENABLE_AUTO_BACKUP=true` in `.env`
2. Check server logs for errors
3. Verify MongoDB connection is working: `npm run test:mongo`

### Want to change the schedule?

Edit `server/scripts/dailyBackup.js`:
```javascript
// Current: 3:00 AM UTC daily
cron.schedule('0 3 * * *', () => { ... });

// Examples:
// Every 6 hours: '0 */6 * * *'
// Twice daily (6 AM & 6 PM): '0 6,18 * * *'
// Weekly (Sunday 3 AM): '0 3 * * 0'
```

### Want to restore from backup?

```bash
node server/scripts/restoreComments.js
```

## 📊 Monitoring

To check your backups:

```bash
# List all backups
ls -lh server/backups/

# Count backups
ls server/backups/*.json | wc -l

# Check total size
du -sh server/backups/
```

## ✅ Summary

**Created:**
- ✅ `server/scripts/dailyBackup.js` - New daily backup script
- ✅ Updated `server/server.js` - Uses daily backup instead of continuous
- ✅ Updated `server/.env.example` - Documents new schedule
- ✅ Updated `server/backups/README.md` - Updated documentation

**Benefits:**
- ✅ Reasonable backup frequency (1/day vs 48/day)
- ✅ Low disk usage (~23 MB vs ~3.3 GB)
- ✅ Automatic cleanup (30 days vs 90 days)
- ✅ No startup backups (prevents restart loops)
- ✅ MongoDB connection fixed (no more restart issues)

**To Enable:**
```env
ENABLE_AUTO_BACKUP=true
```

**Next Steps:**
1. Add `ENABLE_AUTO_BACKUP=true` to your `.env` file (local and Render)
2. Restart your server
3. Backups will run automatically at 3:00 AM UTC daily
4. Monitor disk usage occasionally

Your backup system is now ready to use! 🎉

