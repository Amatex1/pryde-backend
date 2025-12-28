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
  // Platform badges (official staff)
  {
    id: 'pryde_team',
    label: 'Pryde Team',
    type: 'platform',
    icon: '🌈',
    tooltip: 'Official member of the Pryde team',
    priority: 1,
    color: 'rainbow'
  },
  {
    id: 'moderator',
    label: 'Moderator',
    type: 'platform',
    icon: '🛡️',
    tooltip: 'Community moderator helping keep Pryde safe',
    priority: 2,
    color: 'purple'
  },
  
  // Community badges (recognition)
  {
    id: 'founding_member',
    label: 'Founding Member',
    type: 'community',
    icon: '⭐',
    tooltip: 'Joined Pryde during the founding period',
    priority: 10,
    color: 'gold'
  },
  {
    id: 'early_member',
    label: 'Early Member',
    type: 'community',
    icon: '🌟',
    tooltip: 'Among the first 1000 members to join Pryde',
    priority: 11,
    color: 'silver'
  },
  {
    id: 'community_helper',
    label: 'Community Helper',
    type: 'community',
    icon: '💜',
    tooltip: 'Recognized for helping other community members',
    priority: 20,
    color: 'lavender'
  },
  
  // Activity badges (earned through usage)
  {
    id: 'profile_complete',
    label: 'Profile Complete',
    type: 'activity',
    icon: '✨',
    tooltip: 'Has a complete profile with all details filled in',
    priority: 50,
    color: 'teal'
  },
  {
    id: 'active_contributor',
    label: 'Active Contributor',
    type: 'activity',
    icon: '📝',
    tooltip: 'Actively contributes content to the community',
    priority: 51,
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

