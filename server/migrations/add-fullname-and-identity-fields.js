import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

/**
 * Migration Script: Add fullName and identity fields to existing users
 * 
 * This script:
 * 1. Adds fullName field to users who don't have it (uses username as fallback)
 * 2. Adds identity field (null by default)
 * 3. Converts displayName, pronouns, bio from empty strings to null
 * 4. Adds profileComplete and onboardingStep fields
 */

async function migrate() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('\n📊 Finding users to update...');
    const users = await User.find({});
    console.log(`Found ${users.length} users`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        let needsUpdate = false;

        // Add fullName if missing (use username as fallback)
        if (!user.fullName || user.fullName === '') {
          user.fullName = user.username;
          needsUpdate = true;
          console.log(`  ➕ Adding fullName to ${user.username}: "${user.username}"`);
        }

        // Add identity field if missing
        if (user.identity === undefined) {
          // Convert old isAlly field to new identity field
          if (user.isAlly === true) {
            user.identity = 'Ally';
            console.log(`  🔄 Converting isAlly to identity for ${user.username}: "Ally"`);
          } else {
            user.identity = null;
          }
          needsUpdate = true;
        }

        // Convert empty strings to null for optional fields
        if (user.displayName === '') {
          user.displayName = null;
          needsUpdate = true;
        }
        if (user.pronouns === '') {
          user.pronouns = null;
          needsUpdate = true;
        }
        if (user.bio === '') {
          user.bio = null;
          needsUpdate = true;
        }

        // Add profileComplete field if missing
        if (user.profileComplete === undefined) {
          user.profileComplete = false;
          needsUpdate = true;
        }

        // Add onboardingStep field if missing
        if (!user.onboardingStep) {
          user.onboardingStep = 'registered';
          needsUpdate = true;
        }

        if (needsUpdate) {
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
    console.log(`  ✅ Successfully updated: ${updatedCount} users`);
    console.log(`  ❌ Errors: ${errorCount} users`);
    console.log(`  📝 Total users: ${users.length}`);

    console.log('\n✅ Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();

