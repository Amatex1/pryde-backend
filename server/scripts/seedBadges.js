/**
 * Seed Initial Badges
 * 
 * Run with: node server/scripts/seedBadges.js
 * 
 * Creates the initial set of non-hierarchical badges.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Import Badge model
import Badge from '../models/Badge.js';

const MONGODB_URI = process.env.MONGODB_URI;

const initialBadges = [
  // CORE_ROLE badges (always visible, cannot be hidden)
  {
    id: 'founder',
    label: 'Founder & Creator',
    type: 'platform',
    category: 'CORE_ROLE',
    icon: '✦',
    tooltip: 'Founder of Pryde Social',
    priority: 1,
    color: 'purple'
  },
  {
    id: 'pryde_team',
    label: 'Pryde Team',
    type: 'platform',
    category: 'CORE_ROLE',
    icon: '🌈',
    tooltip: 'Official member of the Pryde team',
    priority: 2,
    color: 'rainbow'
  },
  {
    id: 'moderator',
    label: 'Moderator',
    type: 'platform',
    category: 'CORE_ROLE',
    icon: '🛡️',
    tooltip: 'Community moderator helping keep Pryde safe',
    priority: 3,
    color: 'purple'
  },
  {
    id: 'verified',
    label: 'Verified',
    type: 'platform',
    category: 'CORE_ROLE',
    icon: '✓',
    tooltip: 'Verified account',
    priority: 4,
    color: 'blue'
  },

  // STATUS badges (user-controlled)
  {
    id: 'founding_member',
    label: 'Founding Member',
    type: 'community',
    category: 'STATUS',
    icon: '⭐',
    tooltip: 'Joined Pryde during the founding period',
    priority: 10,
    color: 'gold'
  },
  {
    id: 'early_member',
    label: 'Early Member',
    type: 'community',
    category: 'STATUS',
    icon: '🌟',
    tooltip: 'Among the first 1000 members to join Pryde',
    priority: 11,
    color: 'silver'
  },
  {
    id: 'profile_complete',
    label: 'Profile Complete',
    type: 'activity',
    category: 'STATUS',
    icon: '✨',
    tooltip: 'Has a complete profile with all details filled in',
    priority: 50,
    color: 'teal'
  },
  {
    id: 'active_this_month',
    label: 'Active This Month',
    type: 'activity',
    category: 'STATUS',
    icon: '🔥',
    tooltip: 'Active member this month',
    priority: 51,
    color: 'orange'
  },
  {
    id: 'group_organizer',
    label: 'Group Organizer',
    type: 'activity',
    category: 'STATUS',
    icon: '👥',
    tooltip: 'Organizes community groups',
    priority: 52,
    color: 'green'
  },

  // COSMETIC badges (user-controlled)
  {
    id: 'pride_flag',
    label: 'Pride',
    type: 'community',
    category: 'COSMETIC',
    icon: '🏳️‍🌈',
    tooltip: 'Pride flag',
    priority: 100,
    color: 'rainbow'
  },
  {
    id: 'trans_flag',
    label: 'Trans',
    type: 'community',
    category: 'COSMETIC',
    icon: '🏳️‍⚧️',
    tooltip: 'Trans flag',
    priority: 101,
    color: 'blue'
  }
];

async function seedBadges() {
  console.log('🏅 Badge Seeding Script');
  console.log('========================\n');
  
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in environment');
    process.exit(1);
  }
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    let created = 0;
    let skipped = 0;
    
    for (const badgeData of initialBadges) {
      const existing = await Badge.findOne({ id: badgeData.id });
      if (existing) {
        console.log(`⏭️  Skipped: ${badgeData.label} (already exists)`);
        skipped++;
      } else {
        await Badge.create(badgeData);
        console.log(`✅ Created: ${badgeData.label}`);
        created++;
      }
    }
    
    console.log('\n========================');
    console.log(`📊 Results: ${created} created, ${skipped} skipped`);
    console.log('========================\n');
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding badges:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedBadges();

