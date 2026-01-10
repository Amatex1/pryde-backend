import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

// Import all models
import User from '../models/User.js';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import Message from '../models/Message.js';
import GlobalMessage from '../models/GlobalMessage.js';
import Conversation from '../models/Conversation.js';
import Notification from '../models/Notification.js';
import FriendRequest from '../models/FriendRequest.js';
import FollowRequest from '../models/FollowRequest.js';
import GroupChat from '../models/GroupChat.js';
import Group from '../models/Group.js';
import Circle from '../models/Circle.js';
import CircleMember from '../models/CircleMember.js';
import Block from '../models/Block.js';
import Report from '../models/Report.js';
import SecurityLog from '../models/SecurityLog.js';
import Badge from '../models/Badge.js';
import BadgeAssignmentLog from '../models/BadgeAssignmentLog.js';
import Event from '../models/Event.js';
import Journal from '../models/Journal.js';
import PhotoEssay from '../models/PhotoEssay.js';
import Longform from '../models/Longform.js';
import Collection from '../models/Collection.js';
import CollectionItem from '../models/CollectionItem.js';
import Draft from '../models/Draft.js';
import TempMedia from '../models/TempMedia.js';
import LoginApproval from '../models/LoginApproval.js';
import ModerationSettings from '../models/ModerationSettings.js';
import Reaction from '../models/Reaction.js';
import Resonance from '../models/Resonance.js';
import Tag from '../models/Tag.js';
import TagGroupMapping from '../models/TagGroupMapping.js';
import Invite from '../models/Invite.js';
import BugReport from '../models/BugReport.js';
import ReflectionPrompt from '../models/ReflectionPrompt.js';
import SystemConfig from '../models/SystemConfig.js';
import SystemPrompt from '../models/SystemPrompt.js';

const models = {
  User, Post, Comment, Message, GlobalMessage, Conversation, Notification,
  FriendRequest, FollowRequest, GroupChat, Group, Circle, CircleMember,
  Block, Report, SecurityLog, Badge, BadgeAssignmentLog, Event, Journal,
  PhotoEssay, Longform, Collection, CollectionItem, Draft, TempMedia,
  LoginApproval, ModerationSettings, Reaction, Resonance, Tag, TagGroupMapping,
  Invite, BugReport, ReflectionPrompt, SystemConfig, SystemPrompt
};

async function analyzeIndexes() {
  console.log('📊 ANALYZING DATABASE INDEXES...\n');
  
  const results = {};
  
  for (const [modelName, Model] of Object.entries(models)) {
    try {
      const collection = Model.collection;
      const indexes = await collection.indexes();
      
      results[modelName] = {
        collection: collection.collectionName,
        indexCount: indexes.length,
        indexes: indexes.map(idx => ({
          name: idx.name,
          keys: idx.key,
          unique: idx.unique || false,
          sparse: idx.sparse || false
        }))
      };
      
      console.log(`✅ ${modelName} (${collection.collectionName}): ${indexes.length} indexes`);
    } catch (error) {
      console.error(`❌ Error analyzing ${modelName}:`, error.message);
    }
  }
  
  return results;
}

async function analyzeCollectionStats() {
  console.log('\n📈 ANALYZING COLLECTION STATISTICS...\n');
  
  const stats = {};
  
  for (const [modelName, Model] of Object.entries(models)) {
    try {
      const collection = Model.collection;
      const count = await collection.countDocuments();
      const collStats = await collection.stats();
      
      stats[modelName] = {
        collection: collection.collectionName,
        documentCount: count,
        avgDocSize: Math.round(collStats.avgObjSize || 0),
        totalSize: Math.round((collStats.size || 0) / 1024 / 1024 * 100) / 100, // MB
        indexSize: Math.round((collStats.totalIndexSize || 0) / 1024 / 1024 * 100) / 100, // MB
        storageSize: Math.round((collStats.storageSize || 0) / 1024 / 1024 * 100) / 100 // MB
      };
      
      console.log(`📦 ${modelName}: ${count.toLocaleString()} docs, ${stats[modelName].totalSize} MB`);
    } catch (error) {
      console.error(`❌ Error getting stats for ${modelName}:`, error.message);
    }
  }
  
  return stats;
}

async function findSlowQueries() {
  console.log('\n🐌 CHECKING FOR SLOW QUERIES...\n');

  try {
    const db = mongoose.connection.db;
    const adminDb = db.admin();

    // Get current operations
    const currentOps = await adminDb.command({ currentOp: 1 });

    const slowOps = currentOps.inprog.filter(op =>
      op.secs_running > 1 && op.op !== 'none'
    );

    if (slowOps.length > 0) {
      console.log(`⚠️ Found ${slowOps.length} slow operations:`);
      slowOps.forEach(op => {
        console.log(`   - ${op.op} on ${op.ns}: ${op.secs_running}s`);
      });
    } else {
      console.log('✅ No slow queries detected');
    }

    return slowOps;
  } catch (error) {
    console.log('⚠️ Cannot check slow queries (requires admin privileges)');
    return [];
  }
}

async function recommendIndexes() {
  console.log('\n💡 INDEX RECOMMENDATIONS...\n');

  const recommendations = [];

  // Check User model
  try {
    const userIndexes = await User.collection.indexes();
    const hasUsernameIndex = userIndexes.some(idx => idx.key.username);
    const hasEmailIndex = userIndexes.some(idx => idx.key.email);
    const hasRoleIndex = userIndexes.some(idx => idx.key.role);

    if (!hasUsernameIndex) {
      recommendations.push({
        model: 'User',
        field: 'username',
        reason: 'Frequently used for lookups and authentication'
      });
    }
    if (!hasEmailIndex) {
      recommendations.push({
        model: 'User',
        field: 'email',
        reason: 'Frequently used for authentication and password reset'
      });
    }
    if (!hasRoleIndex) {
      recommendations.push({
        model: 'User',
        field: 'role',
        reason: 'Used for admin/moderator queries'
      });
    }
  } catch (error) {
    console.error('Error checking User indexes:', error.message);
  }

  // Check Message model
  try {
    const messageIndexes = await Message.collection.indexes();
    const hasConversationIndex = messageIndexes.some(idx =>
      idx.key.sender && idx.key.recipient
    );

    if (!hasConversationIndex) {
      recommendations.push({
        model: 'Message',
        field: '{ sender: 1, recipient: 1, createdAt: -1 }',
        reason: 'Compound index for efficient conversation queries'
      });
    }
  } catch (error) {
    console.error('Error checking Message indexes:', error.message);
  }

  // Check Post model
  try {
    const postIndexes = await Post.collection.indexes();
    const hasVisibilityIndex = postIndexes.some(idx =>
      idx.key.visibility && idx.key.createdAt
    );

    if (!hasVisibilityIndex) {
      recommendations.push({
        model: 'Post',
        field: '{ visibility: 1, createdAt: -1 }',
        reason: 'Compound index for feed queries with visibility filtering'
      });
    }
  } catch (error) {
    console.error('Error checking Post indexes:', error.message);
  }

  if (recommendations.length > 0) {
    console.log('⚠️ MISSING INDEXES DETECTED:\n');
    recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec.model}.${rec.field}`);
      console.log(`   Reason: ${rec.reason}\n`);
    });
  } else {
    console.log('✅ All critical indexes are present');
  }

  return recommendations;
}

async function createMissingIndexes() {
  console.log('\n🔧 CREATING MISSING INDEXES...\n');

  const indexesCreated = [];

  try {
    // User indexes
    console.log('📝 Checking User indexes...');
    await User.collection.createIndex({ username: 1 }, { unique: true, background: true });
    await User.collection.createIndex({ email: 1 }, { unique: true, background: true });
    await User.collection.createIndex({ role: 1 }, { background: true });
    await User.collection.createIndex({ createdAt: -1 }, { background: true });
    await User.collection.createIndex({ 'friends': 1 }, { background: true });
    indexesCreated.push('User: username, email, role, createdAt, friends');

    // Message indexes
    console.log('📝 Checking Message indexes...');
    await Message.collection.createIndex({ sender: 1, recipient: 1, createdAt: -1 }, { background: true });
    await Message.collection.createIndex({ groupChat: 1, createdAt: -1 }, { background: true });
    await Message.collection.createIndex({ read: 1, recipient: 1 }, { background: true });
    indexesCreated.push('Message: sender+recipient+createdAt, groupChat+createdAt, read+recipient');

    // Post indexes (already exist in schema, but ensure they're created)
    console.log('📝 Checking Post indexes...');
    await Post.collection.createIndex({ author: 1, createdAt: -1 }, { background: true });
    await Post.collection.createIndex({ visibility: 1, createdAt: -1 }, { background: true });
    await Post.collection.createIndex({ groupId: 1, createdAt: -1 }, { background: true });
    await Post.collection.createIndex({ circleId: 1, createdAt: -1 }, { background: true });
    indexesCreated.push('Post: author+createdAt, visibility+createdAt, groupId+createdAt, circleId+createdAt');

    // Comment indexes
    console.log('📝 Checking Comment indexes...');
    await Comment.collection.createIndex({ postId: 1, createdAt: 1 }, { background: true });
    await Comment.collection.createIndex({ postId: 1, parentCommentId: 1 }, { background: true });
    await Comment.collection.createIndex({ authorId: 1, createdAt: -1 }, { background: true });
    indexesCreated.push('Comment: postId+createdAt, postId+parentCommentId, authorId+createdAt');

    console.log('\n✅ Index creation completed!\n');
    indexesCreated.forEach(idx => console.log(`   ✓ ${idx}`));

  } catch (error) {
    console.error('❌ Error creating indexes:', error.message);
  }

  return indexesCreated;
}

async function optimizeGlobalMessage() {
  console.log('\n⚡ OPTIMIZING GLOBAL MESSAGE COLLECTION...\n');

  try {
    // Ensure all indexes exist
    await GlobalMessage.collection.createIndex({ senderId: 1 }, { background: true });
    await GlobalMessage.collection.createIndex({ createdAt: -1 }, { background: true });
    await GlobalMessage.collection.createIndex({ isDeleted: 1 }, { background: true });
    await GlobalMessage.collection.createIndex({ createdAt: -1, _id: -1 }, { background: true });
    await GlobalMessage.collection.createIndex({ isDeleted: 1, createdAt: -1 }, { background: true });

    console.log('✅ GlobalMessage indexes optimized');

    // Get stats
    const count = await GlobalMessage.countDocuments();
    const deletedCount = await GlobalMessage.countDocuments({ isDeleted: true });

    console.log(`📊 Total messages: ${count.toLocaleString()}`);
    console.log(`🗑️ Deleted messages: ${deletedCount.toLocaleString()}`);

    if (deletedCount > 1000) {
      console.log(`⚠️ Consider archiving deleted messages (${deletedCount} found)`);
    }

  } catch (error) {
    console.error('❌ Error optimizing GlobalMessage:', error.message);
  }
}

async function optimizeNotifications() {
  console.log('\n🔔 OPTIMIZING NOTIFICATIONS COLLECTION...\n');

  try {
    // Create indexes for notifications
    await Notification.collection.createIndex({ recipient: 1, createdAt: -1 }, { background: true });
    await Notification.collection.createIndex({ recipient: 1, read: 1 }, { background: true });
    await Notification.collection.createIndex({ createdAt: -1 }, { background: true });

    console.log('✅ Notification indexes optimized');

    // Get stats
    const count = await Notification.countDocuments();
    const unreadCount = await Notification.countDocuments({ read: false });

    console.log(`📊 Total notifications: ${count.toLocaleString()}`);
    console.log(`📬 Unread notifications: ${unreadCount.toLocaleString()}`);

    // Check for old notifications (older than 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const oldCount = await Notification.countDocuments({
      createdAt: { $lt: ninetyDaysAgo },
      read: true
    });

    if (oldCount > 1000) {
      console.log(`⚠️ Consider archiving old read notifications (${oldCount.toLocaleString()} found)`);
    }

  } catch (error) {
    console.error('❌ Error optimizing Notifications:', error.message);
  }
}

async function optimizeConversations() {
  console.log('\n💬 OPTIMIZING CONVERSATIONS COLLECTION...\n');

  try {
    // Create indexes for conversations
    await Conversation.collection.createIndex({ participants: 1 }, { background: true });
    await Conversation.collection.createIndex({ lastMessageAt: -1 }, { background: true });
    await Conversation.collection.createIndex({
      participants: 1,
      lastMessageAt: -1
    }, { background: true });

    console.log('✅ Conversation indexes optimized');

    const count = await Conversation.countDocuments();
    console.log(`📊 Total conversations: ${count.toLocaleString()}`);

  } catch (error) {
    console.error('❌ Error optimizing Conversations:', error.message);
  }
}

async function generateReport(indexAnalysis, stats, recommendations) {
  console.log('\n' + '='.repeat(80));
  console.log('📋 DATABASE OPTIMIZATION REPORT');
  console.log('='.repeat(80) + '\n');

  // Summary
  console.log('📊 SUMMARY:\n');
  const totalDocs = Object.values(stats).reduce((sum, s) => sum + s.documentCount, 0);
  const totalSize = Object.values(stats).reduce((sum, s) => sum + s.totalSize, 0);
  const totalIndexSize = Object.values(stats).reduce((sum, s) => sum + s.indexSize, 0);

  console.log(`   Total Documents: ${totalDocs.toLocaleString()}`);
  console.log(`   Total Data Size: ${totalSize.toFixed(2)} MB`);
  console.log(`   Total Index Size: ${totalIndexSize.toFixed(2)} MB`);
  console.log(`   Total Collections: ${Object.keys(stats).length}`);

  // Largest collections
  console.log('\n📦 LARGEST COLLECTIONS:\n');
  const sortedBySize = Object.entries(stats)
    .sort((a, b) => b[1].totalSize - a[1].totalSize)
    .slice(0, 10);

  sortedBySize.forEach(([name, data], i) => {
    console.log(`   ${i + 1}. ${name}: ${data.documentCount.toLocaleString()} docs, ${data.totalSize} MB`);
  });

  // Most indexed collections
  console.log('\n🔍 MOST INDEXED COLLECTIONS:\n');
  const sortedByIndexes = Object.entries(indexAnalysis)
    .sort((a, b) => b[1].indexCount - a[1].indexCount)
    .slice(0, 10);

  sortedByIndexes.forEach(([name, data], i) => {
    console.log(`   ${i + 1}. ${name}: ${data.indexCount} indexes`);
  });

  // Recommendations
  if (recommendations.length > 0) {
    console.log('\n⚠️ RECOMMENDATIONS:\n');
    recommendations.forEach((rec, i) => {
      console.log(`   ${i + 1}. Add index to ${rec.model}.${rec.field}`);
      console.log(`      → ${rec.reason}`);
    });
  } else {
    console.log('\n✅ NO CRITICAL ISSUES FOUND\n');
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

async function main() {
  try {
    const mongoURL = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI;

    if (!mongoURL) {
      console.error('❌ No MongoDB connection string found in environment variables');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...\n');
    await mongoose.connect(mongoURL);
    console.log('✅ Connected to MongoDB!\n');
    console.log('📍 Database:', mongoose.connection.db.databaseName);
    console.log('='.repeat(80) + '\n');

    // Run all analyses
    const indexAnalysis = await analyzeIndexes();
    const stats = await analyzeCollectionStats();
    await findSlowQueries();
    const recommendations = await recommendIndexes();

    // Run optimizations
    await createMissingIndexes();
    await optimizeGlobalMessage();
    await optimizeNotifications();
    await optimizeConversations();

    // Generate final report
    await generateReport(indexAnalysis, stats, recommendations);

    console.log('✅ Database optimization complete!\n');

    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();

