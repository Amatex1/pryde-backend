import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Comment from '../models/Comment.js';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import Post from '../models/Post.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const BACKUP_DIR = path.join(__dirname, '../backups');

// Create backups directory if it doesn't exist
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

async function backupAll() {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URL;
    if (!mongoURI) {
      throw new Error('MONGODB_URI or MONGO_URL not found in environment variables');
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');

    const backup = {
      timestamp: new Date().toISOString(),
      stats: {},
      data: {}
    };

    // Backup Comments
    console.log('📥 Backing up Comments...');
    const comments = await Comment.find({}).lean();
    backup.data.comments = comments;
    backup.stats.comments = comments.length;
    console.log(`✅ ${comments.length} comments backed up`);

    // Backup Messages (DMs)
    console.log('📥 Backing up Messages (DMs)...');
    const messages = await Message.find({}).lean();
    backup.data.messages = messages;
    backup.stats.messages = messages.length;
    console.log(`✅ ${messages.length} messages backed up`);

    // Backup Conversations
    console.log('📥 Backing up Conversations...');
    const conversations = await Conversation.find({}).lean();
    backup.data.conversations = conversations;
    backup.stats.conversations = conversations.length;
    console.log(`✅ ${conversations.length} conversations backed up`);

    // Backup Posts
    console.log('📥 Backing up Posts...');
    const posts = await Post.find({}).lean();
    backup.data.posts = posts;
    backup.stats.posts = posts.length;
    console.log(`✅ ${posts.length} posts backed up`);

    // Backup Users (excluding sensitive data)
    console.log('📥 Backing up Users (excluding passwords)...');
    const users = await User.find({}).select('-password -refreshToken').lean();
    backup.data.users = users;
    backup.stats.users = users.length;
    console.log(`✅ ${users.length} users backed up`);

    // Backup Notifications
    console.log('📥 Backing up Notifications...');
    const notifications = await Notification.find({}).lean();
    backup.data.notifications = notifications;
    backup.stats.notifications = notifications.length;
    console.log(`✅ ${notifications.length} notifications backed up`);

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `full-backup-${timestamp}.json`;
    const filepath = path.join(BACKUP_DIR, filename);

    // Write backup to file
    console.log(`\n💾 Writing backup to ${filename}...`);
    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));

    console.log(`✅ Backup saved successfully!`);
    console.log(`📁 Location: ${filepath}`);
    console.log(`📊 File size: ${(fs.statSync(filepath).size / 1024 / 1024).toFixed(2)} MB`);

    // Also create a "latest" backup for easy access
    const latestFilepath = path.join(BACKUP_DIR, 'full-backup-latest.json');
    fs.writeFileSync(latestFilepath, JSON.stringify(backup, null, 2));
    console.log(`✅ Latest backup also saved to: full-backup-latest.json`);

    console.log('\n📋 Backup Summary:');
    console.log(`   - Comments: ${backup.stats.comments}`);
    console.log(`   - Messages (DMs): ${backup.stats.messages}`);
    console.log(`   - Conversations: ${backup.stats.conversations}`);
    console.log(`   - Posts: ${backup.stats.posts}`);
    console.log(`   - Users: ${backup.stats.users}`);
    console.log(`   - Notifications: ${backup.stats.notifications}`);
    console.log(`\n✅ All data backed up successfully!`);

  } catch (error) {
    console.error('❌ Error backing up data:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run backup
backupAll();

