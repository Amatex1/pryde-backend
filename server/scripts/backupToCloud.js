import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Import models
import Comment from '../models/Comment.js';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import Post from '../models/Post.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

const BACKUP_DIR = path.join(__dirname, '../backups');

// Create backups directory if it doesn't exist
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Upload to webhook (Discord, Slack, or custom endpoint)
async function uploadToWebhook(backupData, webhookUrl) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      content: `🔐 **Pryde Backup** - ${new Date().toISOString()}`,
      embeds: [{
        title: '📊 Backup Statistics',
        color: 0x9b59b6,
        fields: [
          { name: '💬 Comments', value: String(backupData.stats.comments || 0), inline: true },
          { name: '💌 Messages', value: String(backupData.stats.messages || 0), inline: true },
          { name: '📝 Posts', value: String(backupData.stats.posts || 0), inline: true },
          { name: '👤 Users', value: String(backupData.stats.users || 0), inline: true },
          { name: '🔔 Notifications', value: String(backupData.stats.notifications || 0), inline: true },
          { name: '📅 Timestamp', value: backupData.timestamp, inline: false }
        ]
      }]
    });

    const url = new URL(webhookUrl);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 200 || res.statusCode === 204) {
        resolve();
      } else {
        reject(new Error(`Webhook failed with status ${res.statusCode}`));
      }
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function backupToCloud() {
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

    // Backup Messages
    console.log('\n📥 Backing up Messages (DMs)...');
    const messages = await Message.find({}).lean();
    backup.data.messages = messages;
    backup.stats.messages = messages.length;
    console.log(`✅ ${messages.length} messages backed up`);

    // Backup Conversations
    console.log('\n📥 Backing up Conversations...');
    const conversations = await Conversation.find({}).lean();
    backup.data.conversations = conversations;
    backup.stats.conversations = conversations.length;
    console.log(`✅ ${conversations.length} conversations backed up`);

    // Backup Posts
    console.log('\n📥 Backing up Posts...');
    const posts = await Post.find({}).lean();
    backup.data.posts = posts;
    backup.stats.posts = posts.length;
    console.log(`✅ ${posts.length} posts backed up`);

    // Backup Users (excluding passwords)
    console.log('\n📥 Backing up Users...');
    const users = await User.find({}).select('-password').lean();
    backup.data.users = users;
    backup.stats.users = users.length;
    console.log(`✅ ${users.length} users backed up`);

    // Backup Notifications
    console.log('\n📥 Backing up Notifications...');
    const notifications = await Notification.find({}).lean();
    backup.data.notifications = notifications;
    backup.stats.notifications = notifications.length;
    console.log(`✅ ${notifications.length} notifications backed up`);

    // Save to local file
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `full-backup-${timestamp}.json`;
    const filepath = path.join(BACKUP_DIR, filename);
    const latestPath = path.join(BACKUP_DIR, 'full-backup-latest.json');

    console.log(`\n💾 Writing backup to ${filename}...`);
    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));
    fs.writeFileSync(latestPath, JSON.stringify(backup, null, 2));
    console.log('✅ Backup saved successfully!');

    // Upload to webhook if configured
    if (process.env.BACKUP_WEBHOOK_URL) {
      console.log('\n📤 Uploading backup notification to webhook...');
      try {
        await uploadToWebhook(backup, process.env.BACKUP_WEBHOOK_URL);
        console.log('✅ Webhook notification sent!');
      } catch (error) {
        console.error('⚠️ Webhook upload failed:', error.message);
      }
    }

    console.log('\n📊 Backup Statistics:');
    console.log(`   💬 Comments: ${backup.stats.comments}`);
    console.log(`   💌 Messages: ${backup.stats.messages}`);
    console.log(`   🗨️  Conversations: ${backup.stats.conversations}`);
    console.log(`   📝 Posts: ${backup.stats.posts}`);
    console.log(`   👤 Users: ${backup.stats.users}`);
    console.log(`   🔔 Notifications: ${backup.stats.notifications}`);

    await mongoose.disconnect();
    console.log('\n✅ Backup completed successfully!');
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

backupToCloud();

