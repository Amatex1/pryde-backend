/**
 * Fix Badge Categories
 * Sets correct category for all badges that have undefined/wrong category
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

import Badge from '../models/Badge.js';

const CATEGORY_MAP = {
  // CORE_ROLE: always visible, shown as role indicator
  CORE_ROLE: [
    'founder',
    'pryde_founder',   // legacy ID for Founder & Creator
    'pryde_team',
    'moderator',
    'admin',
    'verified',
  ],
  // STATUS: earned through actions, user can show/hide up to 3
  STATUS: [
    'early_member',
    'founding_member',
    'profile_complete',
    'active_this_month',
    'group_organizer',
    'community_helper',
    'active_contributor',
    'kind_of_helpful',
  ],
  // COSMETIC: decorative, user can show/hide up to 3
  COSMETIC: [
    'pride_flag',
    'trans_flag',
  ],
};

async function fixCategories() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URL || process.env.MONGO_URI);
  console.log('Connected to MongoDB\n');

  let totalUpdated = 0;

  for (const [category, ids] of Object.entries(CATEGORY_MAP)) {
    const result = await Badge.updateMany(
      { id: { $in: ids } },
      { $set: { category } }
    );
    console.log(`${category}: updated ${result.modifiedCount} badges (matched ${result.matchedCount})`);
    totalUpdated += result.modifiedCount;
  }

  console.log(`\nTotal updated: ${totalUpdated} badges`);

  // Print final state
  const allBadges = await Badge.find({}).select('id label category isActive').lean();
  console.log('\nFinal badge categories:');
  for (const b of allBadges) {
    console.log(`  ${b.id} | ${b.label} | category: ${b.category} | active: ${b.isActive}`);
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

fixCategories().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
