import cron from 'node-cron';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🕐 Starting scheduled backup service...');
console.log('📅 Backups will run daily at 3:00 AM UTC');
console.log('📅 Current time:', new Date().toISOString());

// Clean up old backups (keep last 30 days)
const cleanupOldBackups = () => {
  const backupDir = path.join(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) return;

  const files = fs.readdirSync(backupDir);
  const now = Date.now();
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

  files.forEach(file => {
    if (file.includes('latest')) return; // Don't delete "latest" files

    const filePath = path.join(backupDir, file);
    const stats = fs.statSync(filePath);

    if (stats.mtimeMs < thirtyDaysAgo) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Deleted old backup: ${file}`);
    }
  });
};

// Run backup function
const runBackup = () => {
  console.log('\n⏰ Running scheduled backup...');
  console.log('📅 Time:', new Date().toISOString());

  const backupScript = path.join(__dirname, 'backupAll.js');

  exec(`node "${backupScript}"`, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Backup failed:', error);
      console.error('Error details:', error.message);
      return;
    }
    if (stderr) {
      console.error('⚠️ Backup warnings:', stderr);
    }
    console.log(stdout);
    console.log('✅ Scheduled backup completed successfully!');
    console.log('📅 Next backup: Tomorrow at 3:00 AM UTC\n');

    // Clean up old backups after successful backup
    cleanupOldBackups();
  });
};

// Schedule backup to run daily at 3:00 AM UTC
cron.schedule('0 3 * * *', runBackup);

// Also run backup every 6 hours as extra safety
cron.schedule('0 */6 * * *', () => {
  console.log('\n⏰ Running 6-hour safety backup...');
  runBackup();
});

console.log('✅ Scheduled backup service started!');
console.log('📅 Daily backup: 3:00 AM UTC');
console.log('📅 Safety backup: Every 6 hours');
console.log('💡 Tip: You can also run manual backups with: node scripts/backupAll.js\n');

// Run initial backup on startup
console.log('🚀 Running initial backup on startup...');
runBackup();

// Keep the process running
process.on('SIGINT', () => {
  console.log('\n👋 Stopping scheduled backup service...');
  process.exit(0);
});

