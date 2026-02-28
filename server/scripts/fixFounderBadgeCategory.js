/**
 * Fix Founder Badge Category
 *
 * The founder (and other CORE_ROLE) badges may have been created before the
 * `category` field was added to the schema, leaving them with the default
 * category of 'STATUS'. This causes them to appear as pills on the profile
 * instead of being surfaced via the role display system.
 *
 * Run with: node server/scripts/fixFounderBadgeCategory.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

import Badge from '../models/Badge.js';

const CORE_ROLE_IDS = ['founder', 'pryde_team', 'moderator', 'verified', 'admin'];

async function fixFounderBadgeCategory() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in environment');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const result = await Badge.updateMany(
      {
        id: { $in: CORE_ROLE_IDS },
        category: { $ne: 'CORE_ROLE' }
      },
      { $set: { category: 'CORE_ROLE' } }
    );

    if (result.modifiedCount === 0) {
      console.log('⏭️  No badges needed updating (all already have CORE_ROLE category)');
    } else {
      console.log(`✅ Updated ${result.modifiedCount} badge(s) to category: CORE_ROLE`);

      // Log which ones were fixed
      const fixed = await Badge.find({ id: { $in: CORE_ROLE_IDS } }).select('id label category');
      fixed.forEach(b => console.log(`   - ${b.id} (${b.label}): ${b.category}`));
    }

    await mongoose.disconnect();
    console.log('\n✅ Done');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixFounderBadgeCategory();
