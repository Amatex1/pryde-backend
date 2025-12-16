import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import Comment from '../models/Comment.js';
import Post from '../models/Post.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

const BACKUP_DIR = path.join(__dirname, '../backups');

// Create backups directory if it doesn't exist
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

async function backupComments() {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URL;
    if (!mongoURI) {
      throw new Error('MONGODB_URI or MONGO_URL not found in environment variables');
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    // Fetch all comments from Comment collection
    console.log('\n📥 Fetching comments from Comment collection...');
    const comments = await Comment.find({})
      .populate('authorId', 'username displayName')
      .populate('postId', '_id')
      .lean();

    console.log(`✅ Found ${comments.length} comments in Comment collection`);

    // Fetch all posts with embedded comments
    console.log('\n📥 Fetching posts with embedded comments...');
    const postsWithComments = await Post.find({ 'comments.0': { $exists: true } })
      .populate('comments.user', 'username displayName')
      .lean();

    console.log(`✅ Found ${postsWithComments.length} posts with embedded comments`);

    // Count total embedded comments
    const embeddedCommentsCount = postsWithComments.reduce((total, post) => {
      return total + (post.comments?.length || 0);
    }, 0);

    console.log(`✅ Total embedded comments: ${embeddedCommentsCount}`);

    // Create backup object
    const backup = {
      timestamp: new Date().toISOString(),
      stats: {
        totalComments: comments.length,
        totalPostsWithEmbeddedComments: postsWithComments.length,
        totalEmbeddedComments: embeddedCommentsCount
      },
      comments: comments,
      embeddedComments: postsWithComments.map(post => ({
        postId: post._id,
        postAuthor: post.author,
        comments: post.comments
      }))
    };

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `comments-backup-${timestamp}.json`;
    const filepath = path.join(BACKUP_DIR, filename);

    // Write backup to file
    console.log(`\n💾 Writing backup to ${filename}...`);
    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));

    console.log(`✅ Backup saved successfully!`);
    console.log(`📁 Location: ${filepath}`);
    console.log(`📊 File size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);

    // Also create a "latest" backup for easy access
    const latestFilepath = path.join(BACKUP_DIR, 'comments-backup-latest.json');
    fs.writeFileSync(latestFilepath, JSON.stringify(backup, null, 2));
    console.log(`✅ Latest backup also saved to: ${latestFilepath}`);

    console.log('\n📋 Backup Summary:');
    console.log(`   - Comments in Comment collection: ${comments.length}`);
    console.log(`   - Posts with embedded comments: ${postsWithComments.length}`);
    console.log(`   - Total embedded comments: ${embeddedCommentsCount}`);
    console.log(`   - Total comments backed up: ${comments.length + embeddedCommentsCount}`);

  } catch (error) {
    console.error('❌ Error backing up comments:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run backup
backupComments();

