import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const migrateUsers = async () => {
  try {
    console.log('🔄 Starting migration: Adding creator and privacy fields to existing users...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all users
    const users = await User.find({});
    console.log(`📊 Found ${users.length} users to migrate`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        let needsUpdate = false;

        // Initialize privacySettings if it doesn't exist
        if (!user.privacySettings) {
          user.privacySettings = {
            profileVisibility: 'public',
            isPrivateAccount: false,
            whoCanMessage: 'followers',
            showOnlineStatus: true,
            showLastSeen: true,
            quietModeEnabled: false,
            whoCanSeeMyPosts: 'public',
            whoCanCommentOnMyPosts: 'everyone',
            whoCanTagMe: 'followers',
            autoHideContentWarnings: false
          };
          needsUpdate = true;
        } else {
          // Ensure quietModeEnabled exists in privacySettings
          if (user.privacySettings.quietModeEnabled === undefined) {
            user.privacySettings.quietModeEnabled = false;
            needsUpdate = true;
          }
        }

        // Initialize creator fields if they don't exist
        if (user.isCreator === undefined) {
          user.isCreator = false;
          needsUpdate = true;
        }
        if (user.creatorTagline === undefined) {
          user.creatorTagline = '';
          needsUpdate = true;
        }
        if (user.creatorBio === undefined) {
          user.creatorBio = '';
          needsUpdate = true;
        }
        if (!user.featuredPosts) {
          user.featuredPosts = [];
          needsUpdate = true;
        }

        // Initialize ally field if it doesn't exist
        if (user.isAlly === undefined) {
          user.isAlly = false;
          needsUpdate = true;
        }

        if (needsUpdate) {
          user.markModified('privacySettings');
          await user.save();
          updatedCount++;
          console.log(`✅ Updated user: ${user.username} (${user._id})`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error updating user ${user.username}:`, error.message);
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   Total users: ${users.length}`);
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Skipped (already up-to-date): ${users.length - updatedCount - errorCount}`);
    console.log('\n✅ Migration completed!');

    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

migrateUsers();

