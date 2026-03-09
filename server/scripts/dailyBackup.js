/**
 * Daily Backup Service
 * Runs automatic backups once per day at 3:00 AM UTC
 * Keeps backups for 30 days (reasonable retention)
 */

import cron from 'node-cron';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let backupTask = null;
let sigintHandlerRegistered = false;

const handleSigint = () => {
  console.log('\n👋 Stopping daily backup service...');
  process.exit(0);
};

// Clean up old backups (keep last 30 days)
const cleanupOldBackups = () => {
  const backupDir = path.join(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) return;

  const files = fs.readdirSync(backupDir);
  const now = Date.now();
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

  let deletedCount = 0;
  files.forEach(file => {
    if (file.includes('latest') || file === 'README.md') return; // Don't delete "latest" files or README
    
    const filePath = path.join(backupDir, file);
    
    try {
      const stats = fs.statSync(filePath);
      
      if (stats.mtimeMs < thirtyDaysAgo) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    } catch (error) {
      // File might have been deleted already
    }
  });

  if (deletedCount > 0) {
    console.log(`🗑️  Cleaned up ${deletedCount} old backup(s) (older than 30 days)`);
  }
};

// Run backup function
const runBackup = () => {
  const now = new Date();
  console.log('\n⏰ Running daily backup...');
  console.log('📅 Time:', now.toISOString());
  
  const backupScript = path.join(__dirname, 'backupToCloud.js');
  
  exec(`node "${backupScript}"`, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Backup failed:', error);
      console.error('Error details:', error.message);
      return;
    }
    if (stderr) {
      console.error('⚠️  Backup warnings:', stderr);
    }
    console.log(stdout);
    console.log('✅ Daily backup completed successfully!');
    console.log('📅 Next backup: Tomorrow at 3:00 AM UTC\n');
    
    // Clean up old backups after successful backup
    cleanupOldBackups();
  });
};

export const startDailyBackupService = () => {
  if (backupTask) {
    return backupTask;
  }

  console.log('🕐 Starting DAILY backup service...');
  console.log('📅 Backups will run ONCE PER DAY at 3:00 AM UTC');
  console.log('📅 Current time:', new Date().toISOString());
  console.log('📅 Retention: 30 days');

  // Schedule backup to run DAILY at 3:00 AM UTC
  // Cron format: minute hour day month weekday
  // '0 3 * * *' = At 3:00 AM every day
  backupTask = cron.schedule('0 3 * * *', () => {
    console.log('\n⏰ Daily backup triggered (3:00 AM UTC)...');
    runBackup();
  });

  console.log('✅ Daily backup service started!');
  console.log('📅 Schedule: Every day at 3:00 AM UTC');
  console.log('📅 Retention: 30 days (~30 backups max)');
  console.log('📅 Estimated disk usage: ~23 MB');
  console.log('💡 Tip: Set BACKUP_WEBHOOK_URL to get notifications');
  console.log('💡 For manual backups: npm run backup\n');

  // Skip initial backup on startup to prevent database connection conflicts
  // Backups will run on the scheduled time (3:00 AM UTC daily)
  // This prevents connection pool exhaustion during server startup
  console.log('ℹ️  Skipping initial backup on startup (will run at 3:00 AM UTC)');
  console.log('💡 Manual backup: npm run backup');

  if (!sigintHandlerRegistered) {
    process.on('SIGINT', handleSigint);
    sigintHandlerRegistered = true;
  }

  return backupTask;
};

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  startDailyBackupService();
}

