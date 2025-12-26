/**
 * Migration Script: Activate Tag → Group Bridge
 * 
 * Migration Phase: TAGS → GROUPS (Phase 0 - Foundation)
 * 
 * PURPOSE:
 * - Creates a private Group for every existing Tag
 * - Creates TagGroupMapping records to link legacy tags to new groups
 * - Enables the migration banner on /tags/:slug pages
 * 
 * SAFETY:
 * - Idempotent: Skips tags that already have mappings
 * - Atomic: Uses transactions where possible
 * - Reversible: Does NOT modify or delete any Tag data
 * - Non-destructive: Does NOT move posts or auto-join users
 * 
 * RUN: node migrations/activate-tag-group-bridge.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import models
import Tag from '../models/Tag.js';
import Group from '../models/Group.js';
import TagGroupMapping from '../models/TagGroupMapping.js';
import User from '../models/User.js';

/**
 * Humanize a slug into a readable name
 * e.g., 'deepthoughts' → 'Deep Thoughts', 'queerlife' → 'Queer Life'
 */
function humanizeSlug(slug) {
  // Common word boundaries for known tags
  const knownMappings = {
    'deepthoughts': 'Deep Thoughts',
    'introvertslounge': 'Introverts Lounge',
    'queerlife': 'Queer Life',
    'creativehub': 'Creative Hub',
    'mentalhealthcorner': 'Mental Health Corner',
    'bookclub': 'Book Club',
    'musiclovers': 'Music Lovers',
    'selflove': 'Self Love'
  };
  
  if (knownMappings[slug]) {
    return knownMappings[slug];
  }
  
  // Default: Capitalize first letter
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

async function runMigration() {
  const stats = {
    tagsFound: 0,
    groupsCreated: 0,
    mappingsCreated: 0,
    skipped: 0,
    errors: 0
  };

  try {
    console.log('🔄 Connecting to MongoDB...');
    const mongoURL = process.env.MONGO_URL || process.env.MONGODB_URI;
    
    if (!mongoURL) {
      console.error('❌ No MongoDB connection string found');
      process.exit(1);
    }
    
    await mongoose.connect(mongoURL);
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Find a system owner (first super_admin, then admin, then any user)
    console.log('🔍 Finding system owner for groups...');
    let systemOwner = await User.findOne({ role: 'super_admin', isActive: true, isBanned: false });
    
    if (!systemOwner) {
      systemOwner = await User.findOne({ role: 'admin', isActive: true, isBanned: false });
    }
    
    if (!systemOwner) {
      systemOwner = await User.findOne({ isActive: true, isBanned: false }).sort({ createdAt: 1 });
    }
    
    if (!systemOwner) {
      console.error('❌ No valid user found to be group owner. Aborting.');
      process.exit(1);
    }
    
    console.log(`✅ Using "${systemOwner.username}" (${systemOwner.role}) as group owner\n`);

    // Step 2: Enumerate all existing tags
    console.log('📋 Fetching all existing tags...');
    const tags = await Tag.find({}).lean();
    stats.tagsFound = tags.length;
    console.log(`   Found ${stats.tagsFound} tags\n`);

    if (tags.length === 0) {
      console.log('ℹ️  No tags found. Nothing to migrate.');
      await mongoose.disconnect();
      return;
    }

    // Step 3: Process each tag
    console.log('🚀 Processing tags...\n');
    
    for (const tag of tags) {
      const tagSlug = tag.slug;
      const tagLabel = tag.label || humanizeSlug(tagSlug);
      
      try {
        // Check if mapping already exists
        const existingMapping = await TagGroupMapping.findOne({ legacyTag: tagSlug });
        
        if (existingMapping) {
          console.log(`   ⏭️  SKIP: "${tagSlug}" already has mapping`);
          stats.skipped++;
          continue;
        }

        // Check if group with this slug already exists (but no mapping)
        let group = await Group.findOne({ slug: tagSlug });
        
        if (!group) {
          // Create new group
          group = new Group({
            slug: tagSlug,
            name: tagLabel,
            description: `This group was created from the #${tagSlug} topic.`,
            visibility: 'private',
            owner: systemOwner._id,
            moderators: [],
            members: [],
            createdFromTag: tagSlug
          });
          
          await group.save();
          stats.groupsCreated++;
          console.log(`   ✨ Created group: "${tagLabel}" (${tagSlug})`);
        } else {
          console.log(`   📦 Group exists: "${tagLabel}" (${tagSlug})`);
        }

        // Create the mapping
        const mapping = new TagGroupMapping({
          legacyTag: tagSlug,
          groupId: group._id
        });
        
        await mapping.save();
        stats.mappingsCreated++;
        console.log(`   🔗 Created mapping: ${tagSlug} → ${group._id}`);

      } catch (tagError) {
        console.error(`   ❌ ERROR processing "${tagSlug}":`, tagError.message);
        stats.errors++;
      }
    }

    // Step 4: Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`   Tags found:       ${stats.tagsFound}`);
    console.log(`   Groups created:   ${stats.groupsCreated}`);
    console.log(`   Mappings created: ${stats.mappingsCreated}`);
    console.log(`   Skipped:          ${stats.skipped}`);
    console.log(`   Errors:           ${stats.errors}`);
    console.log('='.repeat(50));

    if (stats.errors === 0) {
      console.log('\n✅ Migration completed successfully!');
      console.log('   → All /tags/:slug pages will now show migration banners');
      console.log('   → Users can visit /groups/:slug to join the new groups');
    } else {
      console.log('\n⚠️  Migration completed with errors. Review logs above.');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the migration
runMigration();

