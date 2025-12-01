/**
 * PHASE 1 MIGRATION: Clean Up Friends Data
 * 
 * This migration removes friend-related data from the database:
 * - Clears friends arrays from User documents
 * - Removes FriendRequest documents
 * - Preserves user accounts and posts
 * 
 * Run this migration AFTER deploying Phase 1 backend changes.
 * 
 * Usage: node server/migrations/phase1-cleanup-friends.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import FriendRequest from '../models/FriendRequest.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function runMigration() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Step 1: Count documents before cleanup
    console.log('\n📊 Counting documents before cleanup...');
    const usersWithFriends = await User.countDocuments({ 
      friends: { $exists: true, $ne: [] } 
    });
    const friendRequests = await FriendRequest.countDocuments();
    
    console.log(`   - Users with friends: ${usersWithFriends}`);
    console.log(`   - Friend requests: ${friendRequests}`);

    // Step 2: Clear friends arrays from all users
    console.log('\n🧹 Clearing friends arrays from User documents...');
    const userUpdateResult = await User.updateMany(
      { friends: { $exists: true } },
      { $set: { friends: [] } }
    );
    console.log(`   ✅ Updated ${userUpdateResult.modifiedCount} users`);

    // Step 3: Delete all friend requests
    console.log('\n🗑️  Deleting all FriendRequest documents...');
    const friendRequestDeleteResult = await FriendRequest.deleteMany({});
    console.log(`   ✅ Deleted ${friendRequestDeleteResult.deletedCount} friend requests`);

    // Step 4: Verify cleanup
    console.log('\n✅ Verifying cleanup...');
    const remainingUsersWithFriends = await User.countDocuments({ 
      friends: { $exists: true, $ne: [] } 
    });
    const remainingFriendRequests = await FriendRequest.countDocuments();
    
    console.log(`   - Users with friends: ${remainingUsersWithFriends}`);
    console.log(`   - Friend requests: ${remainingFriendRequests}`);

    if (remainingUsersWithFriends === 0 && remainingFriendRequests === 0) {
      console.log('\n✅ Migration completed successfully!');
      console.log('   - All friends arrays cleared');
      console.log('   - All friend requests deleted');
      console.log('   - User accounts preserved');
      console.log('   - Posts preserved');
    } else {
      console.log('\n⚠️  Warning: Some data may not have been cleaned up');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run migration
runMigration();

