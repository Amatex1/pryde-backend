/**
 * MongoDB Scaling Indexes Migration
 * 
 * Adds compound indexes for improved query performance at scale.
 * Run with: node server/migrations/add_scaling_indexes.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: './server/.env' });

const mongoURL = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI;

const runMigration = async () => {
  if (!mongoURL) {
    console.error('❌ MONGO_URL not found');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoURL);
    console.log('📡 Connected to MongoDB');

    const db = mongoose.connection.db;

    // ============================================
    // User Collection Indexes
    // ============================================
    console.log('\n👤 Creating User indexes...');
    
    await db.collection('users').createIndex(
      { username: 1 },
      { unique: true, background: true }
    );
    console.log('  ✅ username: 1 (unique)');

    await db.collection('users').createIndex(
      { email: 1 },
      { unique: true, background: true, sparse: true }
    );
    console.log('  ✅ email: 1 (unique, sparse)');

    await db.collection('users').createIndex(
      { createdAt: -1, isVerified: 1 },
      { background: true }
    );
    console.log('  ✅ createdAt: -1, isVerified: 1');

    await db.collection('users').createIndex(
      { role: 1, isActive: 1 },
      { background: true }
    );
    console.log('  ✅ role: 1, isActive: 1');

    // ============================================
    // Post Collection Indexes
    // ============================================
    console.log('\n📝 Creating Post indexes...');

    await db.collection('posts').createIndex(
      { author: 1, visibility: 1, createdAt: -1 },
      { background: true }
    );
    console.log('  ✅ author: 1, visibility: 1, createdAt: -1');

    await db.collection('posts').createIndex(
      { visibility: 1, createdAt: -1, groupId: 1 },
      { background: true }
    );
    console.log('  ✅ visibility: 1, createdAt: -1, groupId: 1');

    await db.collection('posts').createIndex(
      { likes: 1, createdAt: -1 },
      { background: true }
    );
    console.log('  ✅ likes: 1, createdAt: -1');

    await db.collection('posts').createIndex(
      { createdAt: -1 },
      { expireAfterSeconds: 2592000, background: true } // 30 days TTL for temp posts
    );
    console.log('  ✅ createdAt: -1 (TTL 30 days)');

    // ============================================
    // Comment Collection Indexes
    // ============================================
    console.log('\n💬 Creating Comment indexes...');

    await db.collection('comments').createIndex(
      { post: 1, createdAt: -1 },
      { background: true }
    );
    console.log('  ✅ post: 1, createdAt: -1');

    await db.collection('comments').createIndex(
      { author: 1, createdAt: -1 },
      { background: true }
    );
    console.log('  ✅ author: 1, createdAt: -1');

    await db.collection('comments').createIndex(
      { parentComment: 1, createdAt: 1 },
      { background: true }
    );
    console.log('  ✅ parentComment: 1, createdAt: 1');

    // ============================================
    // Notification Collection Indexes
    // ============================================
    console.log('\n🔔 Creating Notification indexes...');

    await db.collection('notifications').createIndex(
      { recipient: 1, createdAt: -1 },
      { background: true }
    );
    console.log('  ✅ recipient: 1, createdAt: -1');

    await db.collection('notifications').createIndex(
      { recipient: 1, read: 1, createdAt: -1 },
      { background: true }
    );
    console.log('  ✅ recipient: 1, read: 1, createdAt: -1');

    // ============================================
    // Message Collection Indexes
    // ============================================
    console.log('\n💌 Creating Message indexes...');

    await db.collection('messages').createIndex(
      { conversation: 1, createdAt: -1 },
      { background: true }
    );
    console.log('  ✅ conversation: 1, createdAt: -1');

    await db.collection('messages').createIndex(
      { sender: 1, createdAt: -1 },
      { background: true }
    );
    console.log('  ✅ sender: 1, createdAt: -1');

    await db.collection('messages').createIndex(
      { recipient: 1, read: 1 },
      { background: true, sparse: true }
    );
    console.log('  ✅ recipient: 1, read: 1 (sparse)');

    // ============================================
    // Session Collection Indexes
    // ============================================
    console.log('\n🔑 Creating Session indexes...');

    await db.collection('sessions').createIndex(
      { user: 1, expires: 1 },
      { background: true }
    );
    console.log('  ✅ user: 1, expires: 1');

    await db.collection('sessions').createIndex(
      { expires: 1 },
      { expireAfterSeconds: 0, background: true }
    );
    console.log('  ✅ expires: 1 (TTL)');

    // ============================================
    // ModerationEvent Collection Indexes
    // ============================================
    console.log('\n🛡️ Creating ModerationEvent indexes...');

    await db.collection('moderationevents').createIndex(
      { user: 1, createdAt: -1 },
      { background: true }
    );
    console.log('  ✅ user: 1, createdAt: -1');

    await db.collection('moderationevents').createIndex(
      { action: 1, confidence: 1 },
      { background: true }
    );
    console.log('  ✅ action: 1, confidence: 1');

    // ============================================
    // Follow & Block Indexes
    // ============================================
    console.log('\n👥 Creating Follow/Block indexes...');

    await db.collection('users').createIndex(
      { following: 1 },
      { background: true, sparse: true }
    );
    console.log('  ✅ following: 1 (sparse)');

    await db.collection('users').createIndex(
      { followers: 1 },
      { background: true, sparse: true }
    );
    console.log('  ✅ followers: 1 (sparse)');

    await db.collection('blocks').createIndex(
      { blocker: 1, blocked: 1 },
      { unique: true, background: true }
    );
    console.log('  ✅ blocker: 1, blocked: 1 (unique)');

    console.log('\n✅ All scaling indexes created successfully!\n');

    // List all indexes
    console.log('📋 Current indexes:');
    const collections = ['users', 'posts', 'comments', 'notifications', 'messages', 'sessions', 'moderationevents'];
    for (const coll of collections) {
      const indexes = await db.collection(coll).indexes();
      console.log(`\n  ${coll}:`);
      indexes.forEach(idx => console.log(`    - ${idx.name}`));
    }

  } catch (error) {
    console.error('❌ Migration error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
};

runMigration();
