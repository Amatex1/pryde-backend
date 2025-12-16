import cron from 'node-cron';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🕐 Starting CONTINUOUS backup service...');
console.log('📅 Backups will run EVERY HOUR');
console.log('📅 Current time:', new Date().toISOString());

// Clean up old backups (keep last 90 days for continuous backups)
const cleanupOldBackups = () => {
  const backupDir = path.join(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) return;

  const files = fs.readdirSync(backupDir);
  const now = Date.now();
  const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000);

  let deletedCount = 0;
  files.forEach(file => {
    if (file.includes('latest')) return; // Don't delete "latest" files
    
    const filePath = path.join(backupDir, file);
    const stats = fs.statSync(filePath);
    
    if (stats.mtimeMs < ninetyDaysAgo) {
      fs.unlinkSync(filePath);
      deletedCount++;
    }
  });

  if (deletedCount > 0) {
    console.log(`🗑️ Cleaned up ${deletedCount} old backup(s)`);
  }
};

// Run backup function
const runBackup = () => {
  const now = new Date();
  console.log('\n⏰ Running continuous backup...');
  console.log('📅 Time:', now.toISOString());
  
  const backupScript = path.join(__dirname, 'backupToCloud.js');
  
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
    console.log('✅ Continuous backup completed successfully!');
    console.log('📅 Next backup: In 1 hour\n');
    
    // Clean up old backups after successful backup
    cleanupOldBackups();
  });
};

// Schedule backup to run EVERY HOUR (continuous backups)
cron.schedule('0 * * * *', () => {
  console.log('\n⏰ Hourly backup triggered...');
  runBackup();
});

// Also run backup every 30 minutes for extra safety (optional - comment out if too frequent)
cron.schedule('*/30 * * * *', () => {
  console.log('\n⏰ 30-minute safety backup triggered...');
  runBackup();
});

console.log('✅ Continuous backup service started!');
console.log('📅 Hourly backup: Every hour at :00');
console.log('📅 Safety backup: Every 30 minutes');
console.log('📅 Retention: 90 days');
console.log('💡 Tip: Set BACKUP_WEBHOOK_URL to get notifications\n');

// Run initial backup on startup
console.log('🚀 Running initial backup on startup...');
runBackup();

// Keep the process running
process.on('SIGINT', () => {
  console.log('\n👋 Stopping continuous backup service...');
  process.exit(0);
});

