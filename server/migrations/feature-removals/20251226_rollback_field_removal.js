/**
 * ROLLBACK: Restore Database Fields
 * 
 * PHASE 5 - ROLLBACK SCRIPT
 * 
 * This migration restores deprecated fields with safe defaults to:
 * - User collection (7 fields)
 * - Post collection (10 fields)
 * - Message collection (2 fields)
 * 
 * NOTE: Original data CANNOT be recovered - only field structure is restored.
 * 
 * EXECUTION: Run with MongoDB connection
 *   node server/migrations/feature-removals/20251226_rollback_field_removal.js
 * 
 * CREATED: 2025-12-26
 * STATUS: PREPARED (not executed unless required)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pryde';

async function rollbackFieldRemoval() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('PHASE 5: ROLLBACK - RESTORE DATABASE FIELDS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('⚠️ WARNING: Original data CANNOT be recovered.');
  console.log('   This script only restores field structure with safe defaults.');
  console.log('');
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    console.log('');
    
    const db = mongoose.connection.db;
    
    // =========================================================================
    // USER COLLECTION - Restore 7 fields with safe defaults
    // =========================================================================
    console.log('📦 USER COLLECTION');
    console.log('-------------------');
    
    const userResult = await db.collection('users').updateMany(
      {},
      {
        $set: {
          isVerified: false,
          verificationRequested: false,
          verificationRequestDate: null,
          verificationRequestReason: '',
          relationshipStatus: '',
          isAlly: false,
          'privacySettings.whoCanSendFriendRequests': 'everyone'
        }
      }
    );
    
    console.log(`   Modified: ${userResult.modifiedCount} documents`);
    console.log('   Fields restored with defaults');
    console.log('');
    
    // =========================================================================
    // POST COLLECTION - Restore 10 fields with safe defaults
    // =========================================================================
    console.log('📦 POST COLLECTION');
    console.log('-------------------');
    
    const postResult = await db.collection('posts').updateMany(
      {},
      {
        $set: {
          shares: [],
          isShared: false,
          originalPost: null,
          shareComment: '',
          editHistory: [],
          hashtags: [],
          tags: [],
          tagOnly: false,
          hiddenFrom: [],
          sharedWith: []
        }
      }
    );
    
    console.log(`   Modified: ${postResult.modifiedCount} documents`);
    console.log('   Fields restored with defaults');
    console.log('');
    
    // =========================================================================
    // MESSAGE COLLECTION - Restore 2 fields with safe defaults
    // =========================================================================
    console.log('📦 MESSAGE COLLECTION');
    console.log('----------------------');
    
    const messageResult = await db.collection('messages').updateMany(
      {},
      {
        $set: {
          reactions: []
          // voiceNote is NOT restored (undefined by default in schema)
        }
      }
    );
    
    console.log(`   Modified: ${messageResult.modifiedCount} documents`);
    console.log('   Fields restored with defaults');
    console.log('');
    
    // =========================================================================
    // RECREATE INDEXES
    // =========================================================================
    console.log('📦 INDEX RESTORATION');
    console.log('---------------------');
    
    await db.collection('posts').createIndex({ hashtags: 1 });
    console.log('   ✅ Created index: hashtags_1');
    
    await db.collection('posts').createIndex({ tags: 1 });
    console.log('   ✅ Created index: tags_1');
    console.log('');
    
    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('ROLLBACK COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Users modified:    ${userResult.modifiedCount}`);
    console.log(`Posts modified:    ${postResult.modifiedCount}`);
    console.log(`Messages modified: ${messageResult.modifiedCount}`);
    console.log('');
    console.log('✅ Field structure has been restored with safe defaults.');
    console.log('⚠️ Original data is NOT recoverable.');
    console.log('');
    
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Execute if run directly
rollbackFieldRemoval();

