/**
 * Database Index Migration Script
 * 
 * This script creates new indexes on MongoDB collections to improve query performance.
 * It's safe to run multiple times - it will skip indexes that already exist.
 * 
 * Usage: node server/scripts/migrate-indexes.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

// Import models
import Post from '../models/Post.js';
import Message from '../models/Message.js';
import FriendRequest from '../models/FriendRequest.js';
import GroupChat from '../models/GroupChat.js';
import Conversation from '../models/Conversation.js';
import Journal from '../models/Journal.js';
import PhotoEssay from '../models/PhotoEssay.js';
import Event from '../models/Event.js';

/**
 * Check if an index exists on a collection
 */
async function indexExists(collection, indexName) {
  const indexes = await collection.getIndexes();
  return Object.keys(indexes).includes(indexName);
}

/**
 * Create index if it doesn't exist
 */
async function createIndexIfNotExists(model, indexSpec, options = {}) {
  const collection = model.collection;
  const indexName = options.name || Object.keys(indexSpec).map(key => `${key}_${indexSpec[key]}`).join('_');
  
  try {
    const exists = await indexExists(collection, indexName);
    
    if (exists) {
      console.log(`⏭️  Index "${indexName}" already exists on ${model.modelName}`);
      return { skipped: true };
    }
    
    await collection.createIndex(indexSpec, options);
    console.log(`✅ Created index "${indexName}" on ${model.modelName}`);
    return { created: true };
  } catch (error) {
    console.error(`❌ Failed to create index "${indexName}" on ${model.modelName}:`, error.message);
    return { error: true };
  }
}

/**
 * Main migration function
 */
async function migrateIndexes() {
  try {
    console.log('🔄 Starting index migration...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    let created = 0;
    let skipped = 0;
    let errors = 0;
    
    // Post model indexes
    console.log('📝 Migrating Post indexes...');
    const postResults = await Promise.all([
      createIndexIfNotExists(Post, { visibility: 1, createdAt: -1 }),
      createIndexIfNotExists(Post, { hashtags: 1 }),
      createIndexIfNotExists(Post, { tags: 1 })
    ]);
    
    // Message model indexes
    console.log('\n💬 Migrating Message indexes...');
    const messageResults = await Promise.all([
      createIndexIfNotExists(Message, { groupChat: 1, createdAt: -1 }),
      createIndexIfNotExists(Message, { sender: 1, createdAt: -1 }),
      createIndexIfNotExists(Message, { recipient: 1, createdAt: -1 })
    ]);
    
    // FriendRequest model indexes
    console.log('\n👥 Migrating FriendRequest indexes...');
    const friendRequestResults = await Promise.all([
      createIndexIfNotExists(FriendRequest, { receiver: 1, status: 1 }),
      createIndexIfNotExists(FriendRequest, { status: 1, createdAt: -1 })
    ]);
    
    // GroupChat model indexes
    console.log('\n💬 Migrating GroupChat indexes...');
    const groupChatResults = await Promise.all([
      createIndexIfNotExists(GroupChat, { updatedAt: -1 })
    ]);
    
    // Conversation model indexes
    console.log('\n💬 Migrating Conversation indexes...');
    const conversationResults = await Promise.all([
      createIndexIfNotExists(Conversation, { updatedAt: -1 })
    ]);
    
    // Journal model indexes
    console.log('\n📔 Migrating Journal indexes...');
    const journalResults = await Promise.all([
      createIndexIfNotExists(Journal, { tags: 1 })
    ]);
    
    // PhotoEssay model indexes
    console.log('\n📸 Migrating PhotoEssay indexes...');
    const photoEssayResults = await Promise.all([
      createIndexIfNotExists(PhotoEssay, { tags: 1 })
    ]);
    
    // Event model indexes
    console.log('\n📅 Migrating Event indexes...');
    const eventResults = await Promise.all([
      createIndexIfNotExists(Event, { startDate: 1, category: 1 }),
      createIndexIfNotExists(Event, { isPrivate: 1, startDate: 1 })
    ]);
    
    // Count results
    const allResults = [
      ...postResults,
      ...messageResults,
      ...friendRequestResults,
      ...groupChatResults,
      ...conversationResults,
      ...journalResults,
      ...photoEssayResults,
      ...eventResults
    ];
    
    allResults.forEach(result => {
      if (result.created) created++;
      if (result.skipped) skipped++;
      if (result.error) errors++;
    });
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Index migration complete!');
    console.log(`   Indexes created: ${created}`);
    console.log(`   Indexes skipped (already exist): ${skipped}`);
    console.log(`   Errors: ${errors}`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Run migration
migrateIndexes();

