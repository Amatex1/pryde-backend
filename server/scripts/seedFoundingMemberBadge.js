/**
 * Seed Founding Member Badge
 * 
 * Assigns the "Founding Member" badge to the first 100 users who joined Pryde.
 * 
 * Exclusions:
 * - System accounts (isSystemAccount = true)
 * - Test accounts (email contains 'test' or username starts with 'test_')
 * - Pryde team bots (username starts with 'pryde_')
 * 
 * Safe to run multiple times (idempotent):
 * - Creates badge only if it doesn't exist
 * - Skips users who already have the badge
 * 
 * Usage: node scripts/seedFoundingMemberBadge.js
 */

import mongoose from 'mongoose';
import Badge from '../models/Badge.js';
import User from '../models/User.js';
import BadgeAssignmentLog from '../models/BadgeAssignmentLog.js';
import dotenv from 'dotenv';

dotenv.config();

const BADGE_ID = 'founding_member';
const FOUNDING_MEMBER_LIMIT = 100;

// Badge definition
const FOUNDING_MEMBER_BADGE = {
  id: BADGE_ID,
  label: 'Founding Member',
  type: 'platform',
  assignmentType: 'automatic',
  automaticRule: 'founding_member',
  icon: '🌟',
  tooltip: 'One of the first 100 members of Pryde',
  description: 'This member joined Pryde in its earliest days and helped shape our community from the beginning.',
  priority: 5, // High priority - show first
  color: 'gold',
  isActive: true
};

/**
 * Ensure the Founding Member badge exists
 */
async function ensureBadge() {
  let badge = await Badge.findOne({ id: BADGE_ID });
  
  if (!badge) {
    console.log('🏅 Creating Founding Member badge...');
    badge = await Badge.create(FOUNDING_MEMBER_BADGE);
    console.log('✅ Badge created:', badge.label);
  } else {
    console.log('ℹ️  Founding Member badge already exists');
  }
  
  return badge;
}

/**
 * Get the first N eligible users (excluding system/test accounts)
 */
async function getEligibleFoundingMembers() {
  const users = await User.find({
    // Exclude system accounts
    isSystemAccount: { $ne: true },
    // Exclude by username patterns
    username: { 
      $not: { $regex: /^(test_|pryde_)/i }
    },
    // Exclude by email patterns
    email: {
      $not: { $regex: /test/i }
    }
  })
  .sort({ createdAt: 1 }) // Oldest first
  .limit(FOUNDING_MEMBER_LIMIT)
  .select('_id username displayName badges createdAt');
  
  return users;
}

/**
 * Assign the badge to eligible users
 */
async function assignBadges(badge, users) {
  let assigned = 0;
  let skipped = 0;
  
  for (const user of users) {
    // Check if user already has the badge
    if (user.badges && user.badges.includes(BADGE_ID)) {
      skipped++;
      continue;
    }
    
    // Assign badge
    await User.findByIdAndUpdate(user._id, {
      $addToSet: { badges: BADGE_ID }
    });
    
    // Log the assignment
    await BadgeAssignmentLog.create({
      userId: user._id,
      username: user.username,
      badgeId: BADGE_ID,
      badgeLabel: badge.label,
      action: 'assigned',
      performedBy: null, // System-assigned
      performedByUsername: null,
      isAutomatic: true,
      automaticRule: 'founding_member',
      reason: `First ${FOUNDING_MEMBER_LIMIT} members of Pryde (joined ${user.createdAt.toISOString().split('T')[0]})`
    });
    
    assigned++;
    console.log(`  🌟 Assigned to @${user.username} (joined ${user.createdAt.toISOString().split('T')[0]})`);
  }
  
  return { assigned, skipped };
}

/**
 * Main function
 */
export async function seedFoundingMemberBadge() {
  try {
    // Ensure badge exists
    const badge = await ensureBadge();
    
    // Get eligible users
    console.log(`\n🔍 Finding first ${FOUNDING_MEMBER_LIMIT} eligible users...`);
    const users = await getEligibleFoundingMembers();
    console.log(`   Found ${users.length} eligible users`);
    
    if (users.length === 0) {
      console.log('ℹ️  No eligible users found');
      return { success: true, assigned: 0, skipped: 0, total: 0 };
    }
    
    // Assign badges
    console.log('\n🏅 Assigning Founding Member badges...');
    const { assigned, skipped } = await assignBadges(badge, users);
    
    console.log(`\n✅ Complete!`);
    console.log(`   Assigned: ${assigned}`);
    console.log(`   Already had badge: ${skipped}`);
    console.log(`   Total founding members: ${users.length}`);
    
    return { success: true, assigned, skipped, total: users.length };
  } catch (error) {
    console.error('❌ Error seeding founding member badge:', error);
    return { success: false, error: error.message };
  }
}

// Run directly if executed as script
if (process.argv[1].includes('seedFoundingMemberBadge')) {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pryde';
  
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('📦 Connected to MongoDB');
      return seedFoundingMemberBadge();
    })
    .then(() => {
      mongoose.connection.close();
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Fatal error:', err);
      process.exit(1);
    });
}

