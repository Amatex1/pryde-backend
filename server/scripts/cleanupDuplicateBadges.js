/**
 * Cleanup Duplicate Badges Script
 * 
 * Finds and removes duplicate badges in the database,
 * keeping only the first occurrence of each badge ID.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables (from project root, not server folder)
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

import Badge from '../models/Badge.js';

async function cleanupDuplicateBadges() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find all badges
    const badges = await Badge.find({}).lean();
    console.log(`Total badges in database: ${badges.length}`);

    // Group by id
    const badgesByID = {};
    for (const badge of badges) {
      if (!badgesByID[badge.id]) {
        badgesByID[badge.id] = [];
      }
      badgesByID[badge.id].push(badge);
    }

    // Find duplicates
    let duplicatesRemoved = 0;
    for (const [id, badgeList] of Object.entries(badgesByID)) {
      if (badgeList.length > 1) {
        console.log(`\nFound ${badgeList.length} badges with id "${id}"`);
        
        // Keep the first one (oldest), delete the rest
        const [keep, ...remove] = badgeList.sort((a, b) => 
          new Date(a.createdAt) - new Date(b.createdAt)
        );
        
        console.log(`  Keeping: ${keep._id} (created ${keep.createdAt})`);
        
        for (const dup of remove) {
          console.log(`  Removing: ${dup._id} (created ${dup.createdAt})`);
          await Badge.deleteOne({ _id: dup._id });
          duplicatesRemoved++;
        }
      }
    }

    if (duplicatesRemoved === 0) {
      console.log('\nNo duplicates found!');
    } else {
      console.log(`\nRemoved ${duplicatesRemoved} duplicate badges`);
    }

    // Verify final count
    const finalCount = await Badge.countDocuments();
    console.log(`\nFinal badge count: ${finalCount}`);

    // List all badges
    const finalBadges = await Badge.find({}).sort({ priority: 1 }).lean();
    console.log('\nAll badges:');
    for (const badge of finalBadges) {
      console.log(`  - ${badge.id}: ${badge.label} (${badge.assignmentType})`);
    }

    await mongoose.disconnect();
    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

cleanupDuplicateBadges();

