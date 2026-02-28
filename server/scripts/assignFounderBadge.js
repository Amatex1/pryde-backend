/**
 * Assign Founder Badge to Amatex
 * 
 * This script assigns the "Founder & Creator" badge to the user @Amatex
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server directory
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import models
import User from '../models/User.js';
import Badge from '../models/Badge.js';

async function assignFounderBadge() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URL);
    console.log('✅ Connected to MongoDB');

    // Find the Founder badge
    const founderBadge = await Badge.findOne({ id: 'founder' });
    if (!founderBadge) {
      console.log('❌ Founder badge not found. Run seedBadges.js first.');
      process.exit(1);
    }

    console.log('✅ Found Founder badge:', founderBadge.name);

    // Find user @Amatex
    const user = await User.findOne({ username: 'Amatex' });
    if (!user) {
      console.log('❌ User @Amatex not found');
      process.exit(1);
    }

    console.log('✅ Found user:', user.username);

    // Check if user already has the badge (compare against string id, not ObjectId)
    if (user.badges.includes(founderBadge.id)) {
      console.log('⏭️  User already has Founder badge');
    } else {
      // Add badge string id to user (not the ObjectId)
      user.badges.push(founderBadge.id);
      await user.save();
      console.log('✅ Assigned Founder badge to', user.username);
    }

    // Set user role to super_admin if not already
    if (user.role !== 'super_admin') {
      user.role = 'super_admin';
      await user.save();
      console.log('✅ Updated user role to super_admin');
    } else {
      console.log('⏭️  User already has super_admin role');
    }

    console.log('\n✅ Done!');
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

assignFounderBadge();

