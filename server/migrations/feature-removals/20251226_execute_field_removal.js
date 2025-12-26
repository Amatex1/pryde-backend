/**
 * MIGRATION: Execute Database Field Removal
 * 
 * PHASE 5 - FINAL DESTRUCTIVE OPERATION
 * 
 * This migration permanently removes deprecated fields from:
 * - User collection (7 fields)
 * - Post collection (10 fields)
 * - Message collection (2 fields)
 * 
 * EXECUTION: Run with MongoDB connection
 *   node server/migrations/feature-removals/20251226_execute_field_removal.js
 * 
 * CREATED: 2025-12-26
 * STATUS: READY FOR EXECUTION
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

async function executeFieldRemoval() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('PHASE 5: DATABASE FIELD REMOVAL');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    console.log('');
    
    const db = mongoose.connection.db;
    
    // =========================================================================
    // USER COLLECTION - Remove 7 fields
    // =========================================================================
    console.log('📦 USER COLLECTION');
    console.log('-------------------');
    
    const userResult = await db.collection('users').updateMany(
      {},
      {
        $unset: {
          isVerified: '',
          verificationRequested: '',
          verificationRequestDate: '',
          verificationRequestReason: '',
          relationshipStatus: '',
          isAlly: '',
          'privacySettings.whoCanSendFriendRequests': ''
        }
      }
    );
    
    console.log(`   Modified: ${userResult.modifiedCount} documents`);
    console.log('   Fields removed:');
    console.log('     - isVerified');
    console.log('     - verificationRequested');
    console.log('     - verificationRequestDate');
    console.log('     - verificationRequestReason');
    console.log('     - relationshipStatus');
    console.log('     - isAlly');
    console.log('     - privacySettings.whoCanSendFriendRequests');
    console.log('');
    
    // =========================================================================
    // POST COLLECTION - Remove 10 fields
    // =========================================================================
    console.log('📦 POST COLLECTION');
    console.log('-------------------');
    
    const postResult = await db.collection('posts').updateMany(
      {},
      {
        $unset: {
          shares: '',
          isShared: '',
          originalPost: '',
          shareComment: '',
          editHistory: '',
          hashtags: '',
          tags: '',
          tagOnly: '',
          hiddenFrom: '',
          sharedWith: ''
        }
      }
    );
    
    console.log(`   Modified: ${postResult.modifiedCount} documents`);
    console.log('   Fields removed:');
    console.log('     - shares');
    console.log('     - isShared');
    console.log('     - originalPost');
    console.log('     - shareComment');
    console.log('     - editHistory');
    console.log('     - hashtags');
    console.log('     - tags');
    console.log('     - tagOnly');
    console.log('     - hiddenFrom');
    console.log('     - sharedWith');
    console.log('');
    
    // =========================================================================
    // MESSAGE COLLECTION - Remove 2 fields
    // =========================================================================
    console.log('📦 MESSAGE COLLECTION');
    console.log('----------------------');
    
    const messageResult = await db.collection('messages').updateMany(
      {},
      {
        $unset: {
          reactions: '',
          voiceNote: ''
        }
      }
    );
    
    console.log(`   Modified: ${messageResult.modifiedCount} documents`);
    console.log('   Fields removed:');
    console.log('     - reactions');
    console.log('     - voiceNote');
    console.log('');
    
    // =========================================================================
    // DROP DEPRECATED INDEXES
    // =========================================================================
    console.log('📦 INDEX CLEANUP');
    console.log('-----------------');
    
    try {
      await db.collection('posts').dropIndex('hashtags_1');
      console.log('   ✅ Dropped index: hashtags_1');
    } catch (e) {
      console.log('   ⚠️ Index hashtags_1 not found (already removed or never existed)');
    }
    
    try {
      await db.collection('posts').dropIndex('tags_1');
      console.log('   ✅ Dropped index: tags_1');
    } catch (e) {
      console.log('   ⚠️ Index tags_1 not found (already removed or never existed)');
    }
    console.log('');
    
    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('MIGRATION COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Users modified:    ${userResult.modifiedCount}`);
    console.log(`Posts modified:    ${postResult.modifiedCount}`);
    console.log(`Messages modified: ${messageResult.modifiedCount}`);
    console.log('');
    console.log('✅ All deprecated fields have been removed from the database.');
    console.log('');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Execute if run directly
executeFieldRemoval();

