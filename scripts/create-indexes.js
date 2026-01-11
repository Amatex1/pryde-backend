/**
 * Create MongoDB Indexes for Pryde Social
 * 
 * This script creates all necessary indexes for optimal performance
 * Run with: node scripts/create-indexes.js
 * 
 * ⚠️ IMPORTANT: Run this on production database during low-traffic hours
 * Index creation can take time on large collections
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const mongoURL = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI;

if (!mongoURL) {
  console.error('❌ MongoDB connection string not found in environment variables');
  process.exit(1);
}

// Connect to MongoDB
async function connect() {
  try {
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoURL);
    console.log('✅ Connected to MongoDB\n');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

// Create indexes for all collections
async function createIndexes() {
  const db = mongoose.connection.db;
  
  console.log('🔨 Creating indexes...\n');
  
  try {
    // ========================================
    // USERS COLLECTION
    // ========================================
    console.log('📝 Creating indexes for users collection...');
    await db.collection('users').createIndex({ email: 1 }, { unique: true, background: true });
    await db.collection('users').createIndex({ username: 1 }, { unique: true, background: true });
    await db.collection('users').createIndex({ isDeleted: 1, isActive: 1 }, { background: true });
    await db.collection('users').createIndex({ firstName: 'text', lastName: 'text', username: 'text' }, { background: true });
    await db.collection('users').createIndex({ lastSeen: -1 }, { background: true });
    await db.collection('users').createIndex({ isVerified: 1 }, { background: true });
    await db.collection('users').createIndex({ createdAt: -1 }, { background: true });
    console.log('✅ Users indexes created\n');

    // ========================================
    // POSTS COLLECTION
    // ========================================
    console.log('📝 Creating indexes for posts collection...');
    await db.collection('posts').createIndex({ userId: 1, createdAt: -1 }, { background: true });
    await db.collection('posts').createIndex({ userId: 1, createdAt: -1, visibility: 1 }, { background: true });
    await db.collection('posts').createIndex({ visibility: 1, isDeleted: 1, createdAt: -1 }, { background: true });
    await db.collection('posts').createIndex({ hashtags: 1, createdAt: -1 }, { background: true });
    await db.collection('posts').createIndex({ mentions: 1, createdAt: -1 }, { background: true });
    await db.collection('posts').createIndex({ likesCount: -1, createdAt: -1 }, { background: true });
    await db.collection('posts').createIndex({ content: 'text', description: 'text' }, { background: true });
    await db.collection('posts').createIndex({ isDeleted: 1, createdAt: -1 }, { background: true });
    console.log('✅ Posts indexes created\n');

    // ========================================
    // COMMENTS COLLECTION
    // ========================================
    console.log('📝 Creating indexes for comments collection...');
    await db.collection('comments').createIndex({ postId: 1, createdAt: -1 }, { background: true });
    await db.collection('comments').createIndex({ userId: 1, createdAt: -1 }, { background: true });
    await db.collection('comments').createIndex({ parentId: 1, createdAt: -1 }, { background: true });
    await db.collection('comments').createIndex({ isDeleted: 1, createdAt: -1 }, { background: true });
    console.log('✅ Comments indexes created\n');

    // ========================================
    // NOTIFICATIONS COLLECTION
    // ========================================
    console.log('📝 Creating indexes for notifications collection...');
    await db.collection('notifications').createIndex({ recipientId: 1, createdAt: -1 }, { background: true });
    await db.collection('notifications').createIndex({ recipientId: 1, isRead: 1, createdAt: -1 }, { background: true });
    await db.collection('notifications').createIndex({ recipientId: 1, type: 1, createdAt: -1 }, { background: true });
    // TTL index - auto-delete notifications older than 90 days
    await db.collection('notifications').createIndex({ createdAt: 1 }, { expireAfterSeconds: 7776000, background: true });
    console.log('✅ Notifications indexes created\n');

    // ========================================
    // MESSAGES COLLECTION
    // ========================================
    console.log('📝 Creating indexes for messages collection...');
    await db.collection('messages').createIndex({ conversationId: 1, createdAt: -1 }, { background: true });
    await db.collection('messages').createIndex({ senderId: 1, createdAt: -1 }, { background: true });
    await db.collection('messages').createIndex({ recipientId: 1, isRead: 1, createdAt: -1 }, { background: true });
    await db.collection('messages').createIndex({ isDeleted: 1, createdAt: -1 }, { background: true });
    console.log('✅ Messages indexes created\n');

    // ========================================
    // FOLLOWS COLLECTION
    // ========================================
    console.log('📝 Creating indexes for follows collection...');
    await db.collection('follows').createIndex({ followingId: 1, createdAt: -1 }, { background: true });
    await db.collection('follows').createIndex({ followerId: 1, createdAt: -1 }, { background: true });
    await db.collection('follows').createIndex({ followerId: 1, followingId: 1 }, { unique: true, background: true });
    await db.collection('follows').createIndex({ status: 1, createdAt: -1 }, { background: true });
    console.log('✅ Follows indexes created\n');

    // ========================================
    // LIKES COLLECTION
    // ========================================
    console.log('📝 Creating indexes for likes collection...');
    await db.collection('likes').createIndex({ postId: 1, createdAt: -1 }, { background: true });
    await db.collection('likes').createIndex({ userId: 1, createdAt: -1 }, { background: true });
    await db.collection('likes').createIndex({ userId: 1, postId: 1 }, { unique: true, background: true });
    await db.collection('likes').createIndex({ targetType: 1, targetId: 1 }, { background: true });
    console.log('✅ Likes indexes created\n');

    // ========================================
    // CONVERSATIONS COLLECTION
    // ========================================
    console.log('📝 Creating indexes for conversations collection...');
    await db.collection('conversations').createIndex({ participants: 1, updatedAt: -1 }, { background: true });
    await db.collection('conversations').createIndex({ updatedAt: -1 }, { background: true });
    console.log('✅ Conversations indexes created\n');

    // ========================================
    // SESSIONS COLLECTION (if exists)
    // ========================================
    console.log('📝 Creating indexes for sessions collection...');
    await db.collection('sessions').createIndex({ userId: 1, createdAt: -1 }, { background: true });
    await db.collection('sessions').createIndex({ token: 1 }, { unique: true, background: true });
    // TTL index - auto-delete expired sessions
    await db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, background: true });
    console.log('✅ Sessions indexes created\n');

    console.log('🎉 All indexes created successfully!\n');
    
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    throw error;
  }
}

// List all indexes
async function listIndexes() {
  const db = mongoose.connection.db;
  const collections = ['users', 'posts', 'comments', 'notifications', 'messages', 'follows', 'likes', 'conversations', 'sessions'];
  
  console.log('📋 Current indexes:\n');
  
  for (const collectionName of collections) {
    try {
      const indexes = await db.collection(collectionName).indexes();
      console.log(`${collectionName}:`);
      indexes.forEach(index => {
        console.log(`  - ${JSON.stringify(index.key)} ${index.unique ? '(unique)' : ''}`);
      });
      console.log('');
    } catch (error) {
      console.log(`  ⚠️ Collection not found or error: ${error.message}\n`);
    }
  }
}

// Main execution
async function main() {
  try {
    await connect();
    await createIndexes();
    await listIndexes();
    
    console.log('✅ Index creation complete!');
    console.log('\n📊 Next steps:');
    console.log('1. Monitor index usage in MongoDB Atlas Performance Advisor');
    console.log('2. Review slow query logs');
    console.log('3. Drop unused indexes if any');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the script
main();

