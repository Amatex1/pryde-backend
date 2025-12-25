/**
 * Recalculate Tag Post Counts Script
 * 
 * This script recalculates the postCount for all tags by counting
 * the actual number of posts that reference each tag.
 * 
 * This is useful when:
 * - Post counts are out of sync due to bugs
 * - Posts were deleted before the tag count decrement was implemented
 * - Database inconsistencies need to be fixed
 * 
 * Usage:
 * - Run manually: node server/scripts/recalculateTagCounts.js
 * - Dry run: node server/scripts/recalculateTagCounts.js --dry-run
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Import models
import Tag from '../models/Tag.js';
import Post from '../models/Post.js';

const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Recalculate post counts for all tags
 */
const recalculateTagCounts = async () => {
  try {
    console.log('🔄 Starting tag post count recalculation...');
    console.log(`📋 Mode: ${DRY_RUN ? 'DRY RUN (no changes will be saved)' : 'LIVE (changes will be saved)'}\n`);

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MongoDB URI not found in environment variables');
    }
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Get all tags
    const tags = await Tag.find();
    console.log(`📊 Found ${tags.length} tags to process\n`);

    let updated = 0;
    let unchanged = 0;
    let errors = 0;

    for (const tag of tags) {
      try {
        // Count posts that reference this tag
        // Only count public posts (same as what's shown in the tag feed)
        const actualCount = await Post.countDocuments({
          tags: tag._id,
          visibility: 'public'
        });

        const oldCount = tag.postCount;
        const difference = actualCount - oldCount;

        if (actualCount !== oldCount) {
          console.log(`📝 ${tag.label} (${tag.slug})`);
          console.log(`   Old count: ${oldCount}`);
          console.log(`   Actual count: ${actualCount}`);
          console.log(`   Difference: ${difference > 0 ? '+' : ''}${difference}`);

          if (!DRY_RUN) {
            tag.postCount = actualCount;
            await tag.save();
            console.log(`   ✅ Updated`);
          } else {
            console.log(`   [DRY RUN] Would update to ${actualCount}`);
          }
          console.log();
          updated++;
        } else {
          unchanged++;
        }
      } catch (error) {
        console.error(`❌ Error processing tag ${tag.label}:`, error.message);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Recalculation Summary:');
    console.log(`   Total tags: ${tags.length}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Unchanged: ${unchanged}`);
    console.log(`   Errors: ${errors}`);
    console.log('='.repeat(60));

    if (DRY_RUN) {
      console.log('\n💡 This was a dry run. Run without --dry-run to apply changes.');
    } else {
      console.log('\n✅ Tag post counts have been recalculated!');
    }

    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error recalculating tag counts:', error);
    process.exit(1);
  }
};

// Run the script
recalculateTagCounts();

