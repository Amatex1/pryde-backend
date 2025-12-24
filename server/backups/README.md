# Database Backups

This directory contains database backup files. **These files are excluded from Git** to prevent bloating the repository.

## ⚠️ Important Notes

- Backup files can be **very large** (several MB to hundreds of MB)
- They contain **sensitive user data** and should never be committed to Git
- The `.gitignore` file excludes this entire directory from version control

## Backup Types

### Manual Backups (Recommended)

Run backups manually when needed:

```bash
# Full backup to local file
npm run backup:all

# Backup with cloud notification (if webhook configured)
npm run backup
```

### Automatic Backups (Disabled by Default)

Automatic backups are **disabled by default** to prevent unnecessary disk usage.

To enable automatic daily backups:
1. Set `ENABLE_AUTO_BACKUP=true` in your `.env` file
2. Backups will run automatically once per day

**Schedule:**
- **Once per day** at 3:00 AM UTC
- **30-day retention** (old backups auto-deleted)
- **~23 MB total** disk usage (for current data size)
- **No startup backup** (prevents issues during restarts)

## Backup Files

Backup files are named with timestamps:
- `full-backup-2025-12-24T11-15-33.json` - Timestamped backup
- `full-backup-latest.json` - Always points to the most recent backup

## What's Backed Up

Each backup includes:
- 💬 Comments
- 💌 Messages (DMs)
- 🗨️ Conversations
- 📝 Posts
- 👤 Users (excluding passwords)
- 🔔 Notifications

## Backup Retention

- **Automatic cleanup**: Backups older than 30 days are automatically deleted
- **Manual cleanup**: Delete old backups manually if needed
- **Maximum backups**: ~30 backups (one per day for 30 days)

## Restoring from Backup

To restore data from a backup:

```bash
# Restore comments
node server/scripts/restoreComments.js

# Or specify a specific backup file
node server/scripts/restoreComments.js full-backup-2025-12-24T11-15-33.json
```

## Security

⚠️ **Backup files contain sensitive data:**
- User information
- Private messages
- Email addresses
- Session data

**Never:**
- Commit backups to Git
- Share backups publicly
- Store backups in unsecured locations

**Always:**
- Keep backups in secure, encrypted storage
- Use environment variables for webhook URLs
- Regularly test your restore process

## Troubleshooting

### Too many backup files

If you have hundreds of backup files:
1. Stop the server
2. Delete old backups: `rm server/backups/full-backup-2025-*.json`
3. Keep only `full-backup-latest.json`
4. Make sure `ENABLE_AUTO_BACKUP` is not set to `true`

### Backups filling up disk space

1. Disable automatic backups (set `ENABLE_AUTO_BACKUP=false`)
2. Run manual backups only when needed
3. Set up external backup storage (S3, Google Cloud Storage, etc.)
4. Reduce backup retention period

### Server restarting frequently

If backups are being created every few seconds:
- Check server logs for errors
- Fix MongoDB connection issues
- Check for application crashes
- Review deployment logs on Render

## Best Practices

1. **Use manual backups** for most use cases
2. **Only enable automatic backups** if you have:
   - Adequate disk space (100+ GB)
   - External backup storage configured
   - Monitoring and alerting set up
3. **Test your restore process** regularly
4. **Monitor backup file sizes** and disk usage
5. **Set up backup notifications** using webhooks

## Configuration

Add to your `.env` file:

```env
# Enable automatic backups (default: false)
ENABLE_AUTO_BACKUP=false

# Optional: Webhook for backup notifications
BACKUP_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-url
```

## Need Help?

- Check server logs: `npm run server:dev`
- Test MongoDB connection: `npm run test:mongo`
- Review backup scripts in `server/scripts/`

