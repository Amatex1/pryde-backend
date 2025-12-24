import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function estimateBackupSize() {
  try {
    const mongoURL = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI;
    
    if (!mongoURL) {
      console.error('❌ No MongoDB connection string found');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoURL);
    console.log('✅ Connected!\n');

    const db = mongoose.connection.db;
    
    console.log('📊 Estimating Backup Size...\n');
    
    const collections = [
      'users',
      'posts', 
      'comments',
      'messages',
      'conversations',
      'notifications',
      'blocks',
      'reports',
      'friendrequests',
      'chats',
      'groupchats'
    ];

    let totalDocuments = 0;
    let estimatedSize = 0;

    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        const count = await collection.countDocuments({});
        
        if (count > 0) {
          // Get sample document to estimate size
          const sample = await collection.findOne({});
          const sampleSize = JSON.stringify(sample).length;
          const collectionEstimate = (sampleSize * count) / 1024 / 1024; // MB
          
          console.log(`   ${collectionName.padEnd(20)} ${count.toString().padStart(6)} docs  ~${collectionEstimate.toFixed(2)} MB`);
          
          totalDocuments += count;
          estimatedSize += collectionEstimate;
        }
      } catch (error) {
        // Collection might not exist
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`   Total Documents:     ${totalDocuments}`);
    console.log(`   Estimated Size:      ~${estimatedSize.toFixed(2)} MB per backup`);
    console.log('='.repeat(50));

    console.log('\n📅 Backup Schedule (if enabled):');
    console.log('   - On startup: 1 backup');
    console.log('   - Every 30 min: 48 backups/day');
    console.log('   - Every hour: 24 backups/day');
    console.log('   - Total: ~48-72 backups/day (duplicates)');
    console.log('   - Retention: 90 days');

    console.log('\n💾 Disk Space Estimate:');
    const dailyBackups = 48; // Conservative estimate
    const dailySize = estimatedSize * dailyBackups;
    const weeklySize = dailySize * 7;
    const monthlySize = dailySize * 30;
    
    console.log(`   Per day:    ~${dailySize.toFixed(2)} MB (${dailyBackups} backups)`);
    console.log(`   Per week:   ~${weeklySize.toFixed(2)} MB (${(dailyBackups * 7).toFixed(0)} backups)`);
    console.log(`   Per month:  ~${monthlySize.toFixed(2)} MB (${(dailyBackups * 30).toFixed(0)} backups)`);
    console.log(`   90 days:    ~${(dailySize * 90).toFixed(2)} MB (${(dailyBackups * 90).toFixed(0)} backups)`);

    console.log('\n⚠️  Important Notes:');
    console.log('   - Backups are stored locally in server/backups/');
    console.log('   - Backups are NOT committed to Git (in .gitignore)');
    console.log('   - Old backups (90+ days) are auto-deleted');
    console.log('   - On Render free tier, disk space is limited');
    console.log('   - Consider external backup storage for production');

    console.log('\n💡 Recommendations:');
    if (estimatedSize < 5) {
      console.log('   ✅ Your data is small - auto-backups are safe to enable');
    } else if (estimatedSize < 20) {
      console.log('   ⚠️  Moderate size - monitor disk usage if enabling auto-backups');
    } else {
      console.log('   ❌ Large data - use manual backups or external storage');
    }

    await mongoose.disconnect();
    console.log('\n✅ Estimation completed!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

estimateBackupSize();

