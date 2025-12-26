/**
 * Rollback Script: Deactivate Tag → Group Bridge
 * 
 * Migration Phase: TAGS → GROUPS (Phase 0 - Foundation)
 * 
 * PURPOSE:
 * - Removes all TagGroupMapping records
 * - Optionally removes Groups that were created from tags
 * - Restores /tags/:slug pages to legacy behavior (no migration banner)
 * 
 * SAFETY:
 * - Does NOT touch Tag data
 * - Does NOT touch Post data
 * - Removes only migration-created Groups (createdFromTag is not null)
 * 
 * RUN: node migrations/rollback-tag-group-bridge.js
 * WITH GROUP DELETION: node migrations/rollback-tag-group-bridge.js --delete-groups
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import models
import Group from '../models/Group.js';
import TagGroupMapping from '../models/TagGroupMapping.js';

const deleteGroups = process.argv.includes('--delete-groups');

async function runRollback() {
  const stats = {
    mappingsDeleted: 0,
    groupsDeleted: 0
  };

  try {
    console.log('🔄 Connecting to MongoDB...');
    const mongoURL = process.env.MONGO_URL || process.env.MONGODB_URI;
    
    if (!mongoURL) {
      console.error('❌ No MongoDB connection string found');
      process.exit(1);
    }
    
    await mongoose.connect(mongoURL);
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Delete all TagGroupMapping records
    console.log('🗑️  Deleting TagGroupMapping records...');
    const mappingResult = await TagGroupMapping.deleteMany({});
    stats.mappingsDeleted = mappingResult.deletedCount;
    console.log(`   Deleted ${stats.mappingsDeleted} mapping(s)\n`);

    // Step 2: Optionally delete Groups created from tags
    if (deleteGroups) {
      console.log('🗑️  Deleting Groups created from tags...');
      const groupResult = await Group.deleteMany({ createdFromTag: { $ne: null } });
      stats.groupsDeleted = groupResult.deletedCount;
      console.log(`   Deleted ${stats.groupsDeleted} group(s)\n`);
    } else {
      console.log('ℹ️  Groups preserved (use --delete-groups to remove them)\n');
    }

    // Summary
    console.log('='.repeat(50));
    console.log('📊 ROLLBACK SUMMARY');
    console.log('='.repeat(50));
    console.log(`   Mappings deleted: ${stats.mappingsDeleted}`);
    console.log(`   Groups deleted:   ${stats.groupsDeleted}`);
    console.log('='.repeat(50));

    console.log('\n✅ Rollback completed!');
    console.log('   → /tags/:slug pages will no longer show migration banners');
    console.log('   → Tag data remains unchanged');

  } catch (error) {
    console.error('\n❌ Rollback failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the rollback
runRollback();

