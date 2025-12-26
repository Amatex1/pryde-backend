/**
 * Migration Script: Convert Tags to Groups
 * 
 * This script converts all existing tags to groups, preserving:
 * - slug
 * - name (from label)
 * - description
 * - icon (stored in description prefix)
 * 
 * Usage: node server/scripts/migrateTagsToGroups.js
 * 
 * Prerequisites:
 * - MongoDB connection via MONGO_URI env var
 * - A default owner user (first admin or first user in system)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tag from '../models/Tag.js';
import Group from '../models/Group.js';
import User from '../models/User.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function migrateTagsToGroups() {
  try {
    console.log('🚀 Starting Tags → Groups migration...\n');
    
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find a default owner (prefer admin, fallback to first user)
    let defaultOwner = await User.findOne({ role: 'admin' });
    if (!defaultOwner) {
      defaultOwner = await User.findOne({});
    }
    
    if (!defaultOwner) {
      console.error('❌ No users found in database. Cannot create groups without an owner.');
      process.exit(1);
    }
    
    console.log(`📋 Using default owner: ${defaultOwner.username} (${defaultOwner._id})\n`);

    // Get all tags
    const tags = await Tag.find({});
    console.log(`📋 Found ${tags.length} tags to migrate\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const tag of tags) {
      try {
        // Check if group already exists with this slug
        const existingGroup = await Group.findOne({ slug: tag.slug });
        
        if (existingGroup) {
          console.log(`⏭️  Skipped: "${tag.label}" (group already exists)`);
          skipped++;
          continue;
        }

        // Create new group from tag
        const newGroup = new Group({
          slug: tag.slug,
          name: tag.label,
          description: tag.icon ? `${tag.icon} ${tag.description}` : tag.description,
          visibility: 'private', // All groups start as private
          status: 'approved', // Migrated groups are auto-approved
          owner: defaultOwner._id,
          moderators: [],
          members: [],
          createdFromTag: tag.slug // Track migration origin
        });

        await newGroup.save();
        console.log(`✅ Created: "${tag.label}" → group "${newGroup.name}"`);
        created++;

      } catch (err) {
        console.error(`❌ Error migrating "${tag.label}":`, err.message);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Created: ${created}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors:  ${errors}`);
    console.log('='.repeat(50));

    // List all groups after migration
    const allGroups = await Group.find({}).select('slug name');
    console.log(`\n📋 Total groups in database: ${allGroups.length}`);
    allGroups.forEach(g => console.log(`   - ${g.name} (/${g.slug})`));

    await mongoose.disconnect();
    console.log('\n✅ Migration complete. Disconnected from MongoDB.');
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateTagsToGroups();

