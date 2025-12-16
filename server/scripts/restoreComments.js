import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Comment from '../models/Comment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const BACKUP_DIR = path.join(__dirname, '../backups');

async function restoreComments(backupFile) {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URL;
    if (!mongoURI) {
      throw new Error('MONGODB_URI or MONGO_URL not found in environment variables');
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    // Read backup file
    const filepath = path.join(BACKUP_DIR, backupFile || 'comments-backup-latest.json');
    
    if (!fs.existsSync(filepath)) {
      console.error(`❌ Backup file not found: ${filepath}`);
      console.log('\n📁 Available backups:');
      const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
      files.forEach(f => console.log(`   - ${f}`));
      process.exit(1);
    }

    console.log(`\n📥 Reading backup from ${backupFile || 'comments-backup-latest.json'}...`);
    const backup = JSON.parse(fs.readFileSync(filepath, 'utf8'));

    console.log(`✅ Backup loaded (created: ${backup.timestamp})`);
    console.log(`📊 Backup contains ${backup.stats.totalComments} comments`);

    // Ask for confirmation
    console.log('\n⚠️  WARNING: This will restore comments from the backup.');
    console.log('   Existing comments with the same ID will be updated.');
    console.log('   New comments will be created.');
    console.log('\n   Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Restore comments
    console.log('\n📤 Restoring comments...');
    let restored = 0;
    let updated = 0;
    let failed = 0;

    for (const comment of backup.comments) {
      try {
        // Check if comment already exists
        const existing = await Comment.findById(comment._id);
        
        if (existing) {
          // Update existing comment
          await Comment.findByIdAndUpdate(comment._id, {
            postId: comment.postId,
            authorId: comment.authorId,
            content: comment.content,
            gifUrl: comment.gifUrl,
            parentCommentId: comment.parentCommentId,
            reactions: comment.reactions,
            isPinned: comment.isPinned,
            isDeleted: comment.isDeleted,
            createdAt: comment.createdAt,
            updatedAt: comment.updatedAt
          });
          updated++;
        } else {
          // Create new comment
          await Comment.create({
            _id: comment._id,
            postId: comment.postId,
            authorId: comment.authorId,
            content: comment.content,
            gifUrl: comment.gifUrl,
            parentCommentId: comment.parentCommentId,
            reactions: comment.reactions,
            isPinned: comment.isPinned,
            isDeleted: comment.isDeleted,
            createdAt: comment.createdAt,
            updatedAt: comment.updatedAt
          });
          restored++;
        }
      } catch (error) {
        console.error(`❌ Failed to restore comment ${comment._id}:`, error.message);
        failed++;
      }
    }

    console.log('\n✅ Restore complete!');
    console.log(`📊 Summary:`);
    console.log(`   - Comments restored (new): ${restored}`);
    console.log(`   - Comments updated (existing): ${updated}`);
    console.log(`   - Failed: ${failed}`);
    console.log(`   - Total processed: ${backup.comments.length}`);

  } catch (error) {
    console.error('❌ Error restoring comments:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Get backup file from command line argument
const backupFile = process.argv[2];
restoreComments(backupFile);

