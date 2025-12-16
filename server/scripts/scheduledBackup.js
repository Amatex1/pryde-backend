import cron from 'node-cron';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🕐 Starting scheduled backup service...');
console.log('📅 Backups will run daily at 3:00 AM');

// Schedule backup to run daily at 3:00 AM
cron.schedule('0 3 * * *', () => {
  console.log('\n⏰ Running scheduled backup...');
  const backupScript = path.join(__dirname, 'backupComments.js');
  
  exec(`node ${backupScript}`, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Backup failed:', error);
      return;
    }
    if (stderr) {
      console.error('⚠️ Backup warnings:', stderr);
    }
    console.log(stdout);
    console.log('✅ Scheduled backup completed successfully!');
  });
});

console.log('✅ Scheduled backup service started!');
console.log('💡 Tip: You can also run manual backups with: node server/scripts/backupComments.js');

// Keep the process running
process.on('SIGINT', () => {
  console.log('\n👋 Stopping scheduled backup service...');
  process.exit(0);
});

