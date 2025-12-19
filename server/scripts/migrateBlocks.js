/**
 * Block System Migration Script
 * 
 * Migrates User.blockedUsers array data to Block model collection.
 * This consolidates the duplicate blocking systems into a single source of truth.
 * 
 * SAFE TO RUN MULTIPLE TIMES - Uses upsert to prevent duplicates.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Block from '../models/Block.js';

dotenv.config();

const migrateBlocks = async () => {
  try {
    console.log('🔄 Starting block system migration...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all users with blockedUsers array
    const users = await User.find({ blockedUsers: { $exists: true, $ne: [] } })
      .select('_id username blockedUsers')
      .lean();

    console.log(`📊 Found ${users.length} users with blocked users\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Migrate each user's blocked list
    for (const user of users) {
      console.log(`Processing user: ${user.username} (${user._id})`);
      console.log(`  - Has ${user.blockedUsers.length} blocked users`);

      for (const blockedUserId of user.blockedUsers) {
        try {
          // Check if block already exists
          const existingBlock = await Block.findOne({
            blocker: user._id,
            blocked: blockedUserId
          });

          if (existingBlock) {
            console.log(`  ⏭️  Block already exists: ${user._id} -> ${blockedUserId}`);
            skippedCount++;
            continue;
          }

          // Create new block
          const block = new Block({
            blocker: user._id,
            blocked: blockedUserId,
            reason: 'Migrated from User.blockedUsers array',
            createdAt: new Date()
          });

          await block.save();
          console.log(`  ✅ Migrated block: ${user._id} -> ${blockedUserId}`);
          migratedCount++;

        } catch (error) {
          console.error(`  ❌ Error migrating block ${user._id} -> ${blockedUserId}:`, error.message);
          errorCount++;
        }
      }

      console.log(''); // Empty line for readability
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Migrated: ${migratedCount} blocks`);
    console.log(`⏭️  Skipped (already exist): ${skippedCount} blocks`);
    console.log(`❌ Errors: ${errorCount} blocks`);
    console.log(`📦 Total users processed: ${users.length}`);
    console.log('='.repeat(60) + '\n');

    // Verify migration
    console.log('🔍 Verifying migration...\n');
    const totalBlocks = await Block.countDocuments();
    console.log(`📊 Total blocks in Block collection: ${totalBlocks}\n`);

    // Show sample blocks
    const sampleBlocks = await Block.find()
      .populate('blocker', 'username')
      .populate('blocked', 'username')
      .limit(5)
      .lean();

    console.log('📋 Sample blocks:');
    sampleBlocks.forEach((block, index) => {
      console.log(`  ${index + 1}. ${block.blocker?.username || 'Unknown'} blocked ${block.blocked?.username || 'Unknown'}`);
    });

    console.log('\n✅ Migration completed successfully!');
    console.log('\n⚠️  IMPORTANT: User.blockedUsers arrays are still intact for rollback.');
    console.log('   After verifying the migration, you can remove the blockedUsers field from the User schema.\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run migration
migrateBlocks();

