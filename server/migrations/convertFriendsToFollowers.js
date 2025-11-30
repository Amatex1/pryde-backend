import mongoose from 'mongoose';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Migration Script: Convert Friends to Followers/Following
 * 
 * This script:
 * 1. Copies all friends to both followers and following arrays (mutual follows)
 * 2. Converts privacy settings from 'friends' to 'followers'
 * 3. Converts whoCanSendFriendRequests to isPrivateAccount
 * 4. Keeps original friends array for backward compatibility
 */

const migrateUsers = async () => {
  try {
    console.log('🔄 Starting migration: Friends → Followers/Following...\n');

    // Connect to MongoDB
    const MONGO_URL = process.env.MONGO_URL || process.env.MONGODB_URI;
    if (!MONGO_URL) {
      throw new Error('MONGO_URL or MONGODB_URI not found in environment variables');
    }

    await mongoose.connect(MONGO_URL);
    console.log('✅ Connected to MongoDB\n');

    // Get all users
    const users = await User.find({});
    console.log(`📊 Found ${users.length} users to migrate\n`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      let updated = false;

      // 1. Migrate friends to followers/following
      if (user.friends && user.friends.length > 0) {
        // Copy friends to followers and following (mutual follows)
        if (!user.followers || user.followers.length === 0) {
          user.followers = [...user.friends];
          updated = true;
          console.log(`  ✓ User ${user.username}: Added ${user.friends.length} followers`);
        }

        if (!user.following || user.following.length === 0) {
          user.following = [...user.friends];
          updated = true;
          console.log(`  ✓ User ${user.username}: Added ${user.friends.length} following`);
        }
      }

      // 2. Migrate privacy settings
      if (user.privacySettings) {
        // Convert profileVisibility
        if (user.privacySettings.profileVisibility === 'friends') {
          user.privacySettings.profileVisibility = 'followers';
          updated = true;
          console.log(`  ✓ User ${user.username}: Updated profileVisibility`);
        }

        // Convert whoCanMessage
        if (user.privacySettings.whoCanMessage === 'friends') {
          user.privacySettings.whoCanMessage = 'followers';
          updated = true;
          console.log(`  ✓ User ${user.username}: Updated whoCanMessage`);
        }

        // Convert whoCanSeeMyPosts
        if (user.privacySettings.whoCanSeeMyPosts === 'friends') {
          user.privacySettings.whoCanSeeMyPosts = 'followers';
          updated = true;
          console.log(`  ✓ User ${user.username}: Updated whoCanSeeMyPosts`);
        }

        // Convert whoCanCommentOnMyPosts
        if (user.privacySettings.whoCanCommentOnMyPosts === 'friends') {
          user.privacySettings.whoCanCommentOnMyPosts = 'followers';
          updated = true;
          console.log(`  ✓ User ${user.username}: Updated whoCanCommentOnMyPosts`);
        }

        // Convert whoCanSeeFriendsList to whoCanSeeFollowersList
        if (user.privacySettings.whoCanSeeFriendsList) {
          user.privacySettings.whoCanSeeFollowersList = user.privacySettings.whoCanSeeFriendsList;
          if (user.privacySettings.whoCanSeeFriendsList === 'friends') {
            user.privacySettings.whoCanSeeFollowersList = 'followers';
          }
          updated = true;
          console.log(`  ✓ User ${user.username}: Updated whoCanSeeFollowersList`);
        }

        // Convert whoCanSendFriendRequests to isPrivateAccount
        if (user.privacySettings.whoCanSendFriendRequests === 'no-one') {
          user.privacySettings.isPrivateAccount = true;
          updated = true;
          console.log(`  ✓ User ${user.username}: Set private account (was no-one)`);
        } else if (user.privacySettings.isPrivateAccount === undefined) {
          user.privacySettings.isPrivateAccount = false;
          updated = true;
        }
      }

      // Save if updated
      if (updated) {
        await user.save();
        migratedCount++;
        console.log(`✅ Migrated user: ${user.username}\n`);
      } else {
        skippedCount++;
      }
    }

    console.log('\n🎉 Migration Complete!');
    console.log(`✅ Migrated: ${migratedCount} users`);
    console.log(`⏭️  Skipped: ${skippedCount} users (already migrated)`);
    console.log(`📊 Total: ${users.length} users\n`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run migration
migrateUsers();

