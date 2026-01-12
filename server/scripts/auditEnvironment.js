/**
 * PHASE 0: Environment & Database Verification
 * 
 * Verifies:
 * - MongoDB connection details
 * - Database name
 * - Document counts for all collections
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';
import GroupChat from '../models/GroupChat.js';

dotenv.config();

async function auditEnvironment() {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('PHASE 0: ENVIRONMENT & DATABASE VERIFICATION');
    console.log('═══════════════════════════════════════════════════════\n');

    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    
    // Extract connection details
    const connectionString = process.env.MONGO_URI;
    const dbName = mongoose.connection.name;
    const host = mongoose.connection.host;
    const port = mongoose.connection.port;
    
    console.log('✅ Connected to MongoDB\n');
    console.log('CONNECTION DETAILS:');
    console.log('─────────────────────────────────────────────────────');
    console.log(`Database Name:     ${dbName}`);
    console.log(`Host:              ${host}`);
    console.log(`Port:              ${port || 'default'}`);
    console.log(`Connection String: ${connectionString.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
    console.log('─────────────────────────────────────────────────────\n');

    // Count documents in each collection
    console.log('DOCUMENT COUNTS:');
    console.log('─────────────────────────────────────────────────────');
    
    const userCount = await User.countDocuments();
    const postCount = await Post.countDocuments();
    const commentCount = await Comment.countDocuments();
    const messageCount = await Message.countDocuments();
    const notificationCount = await Notification.countDocuments();
    const groupChatCount = await GroupChat.countDocuments();
    
    console.log(`Users:             ${userCount}`);
    console.log(`Posts:             ${postCount}`);
    console.log(`Comments:          ${commentCount}`);
    console.log(`Messages:          ${messageCount}`);
    console.log(`Notifications:     ${notificationCount}`);
    console.log(`Group Chats:       ${groupChatCount}`);
    console.log('─────────────────────────────────────────────────────\n');

    // Verify expected user count
    console.log('VERIFICATION:');
    console.log('─────────────────────────────────────────────────────');
    
    const expectedUserCount = 50;
    const userCountMatch = Math.abs(userCount - expectedUserCount) <= 5; // Allow ±5 variance
    
    if (userCountMatch) {
      console.log(`✅ User count (${userCount}) matches expected (~${expectedUserCount})`);
    } else {
      console.log(`⚠️  User count (${userCount}) differs from expected (~${expectedUserCount})`);
    }
    
    // Check if this is production database
    const isProduction = dbName === 'pryde-social' && host.includes('mongodb.net');
    if (isProduction) {
      console.log('✅ Connected to production database (MongoDB Atlas)');
    } else {
      console.log('⚠️  Not connected to expected production database');
    }
    
    console.log('─────────────────────────────────────────────────────\n');

    // Get sample data
    console.log('SAMPLE DATA:');
    console.log('─────────────────────────────────────────────────────');
    
    const sampleUsers = await User.find().limit(5).select('username displayName role createdAt');
    console.log('\nFirst 5 users:');
    sampleUsers.forEach((user, i) => {
      console.log(`  ${i + 1}. ${user.displayName || user.username} (@${user.username}) - ${user.role}`);
    });
    
    const recentPosts = await Post.find().sort({ createdAt: -1 }).limit(3).select('content createdAt');
    console.log('\nMost recent 3 posts:');
    recentPosts.forEach((post, i) => {
      const preview = post.content.substring(0, 50);
      const date = new Date(post.createdAt).toLocaleDateString();
      console.log(`  ${i + 1}. "${preview}..." (${date})`);
    });
    
    console.log('─────────────────────────────────────────────────────\n');

    // FAIL CONDITIONS CHECK
    console.log('FAIL CONDITIONS CHECK:');
    console.log('─────────────────────────────────────────────────────');
    
    let failCount = 0;
    
    if (!isProduction) {
      console.log('❌ FAIL: Not connected to production MongoDB Atlas');
      failCount++;
    }
    
    if (!userCountMatch) {
      console.log('❌ FAIL: User count mismatch (expected ~50)');
      failCount++;
    }
    
    if (failCount === 0) {
      console.log('✅ All checks passed');
    }
    
    console.log('─────────────────────────────────────────────────────\n');
    console.log(`RESULT: ${failCount === 0 ? 'PASS ✅' : `FAIL ❌ (${failCount} issues)`}`);
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error during audit:', error);
  } finally {
    await mongoose.connection.close();
    console.log('👋 Disconnected from MongoDB\n');
  }
}

auditEnvironment();

