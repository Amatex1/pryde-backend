/**
 * Seed System Prompts
 * 
 * Creates the pryde_prompts system account and seeds initial prompts.
 * Safe to run multiple times (idempotent).
 * 
 * Usage: node scripts/seedSystemPrompts.js
 * Or imported and called during server startup
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import SystemPrompt from '../models/SystemPrompt.js';
import SystemConfig from '../models/SystemConfig.js';
import crypto from 'crypto';

// System account configuration
const SYSTEM_ACCOUNT = {
  username: 'pryde_prompts',
  email: 'system@prydesocial.com',
  fullName: 'Pryde Prompts',
  displayName: 'Pryde Prompts',
  isSystemAccount: true,
  role: 'user', // Not admin - just a special user
  emailVerified: true,
  isActive: true,
  ageVerified: true
};

// Initial prompts - calm, open-ended, non-triggering
const INITIAL_PROMPTS = [
  // Reflection category
  { text: "What's something that's been quietly on your mind lately?", category: 'reflection' },
  { text: "When do you feel most like yourself?", category: 'reflection' },
  { text: "What's a small thing that made you smile recently?", category: 'reflection' },
  { text: "Is there something you're learning to be gentler with?", category: 'reflection' },
  { text: "What's something you've been meaning to tell someone?", category: 'reflection' },
  
  // Grounding category
  { text: "What helps you feel grounded when things feel heavy?", category: 'grounding' },
  { text: "What does rest look like for you right now?", category: 'grounding' },
  { text: "What's your favorite way to decompress after a long day?", category: 'grounding' },
  { text: "What's a place (real or imagined) where you feel safe?", category: 'grounding' },
  { text: "What sounds help you feel calm?", category: 'grounding' },
  
  // Identity category
  { text: "What part of yourself are you still getting to know?", category: 'identity' },
  { text: "What's something about yourself you've come to appreciate?", category: 'identity' },
  { text: "When did you first feel like you belonged somewhere?", category: 'identity' },
  { text: "What does community mean to you?", category: 'identity' },
  { text: "What's a small way you express yourself that feels true?", category: 'identity' },
  
  // Connection category
  { text: "Who's someone you'd like to reach out to this week?", category: 'connection' },
  { text: "What's a quality you admire in the people around you?", category: 'connection' },
  { text: "What's the kindest thing someone has said to you recently?", category: 'connection' },
  { text: "How do you like to show people you care about them?", category: 'connection' },
  { text: "What makes a friendship feel easy to you?", category: 'connection' },
  
  // General category
  { text: "What are you looking forward to, even if it's small?", category: 'general' },
  { text: "What's something you're proud of that others might not know about?", category: 'general' },
  { text: "If you could give yourself permission to do one thing, what would it be?", category: 'general' },
  { text: "What's a comfort object or ritual that helps you?", category: 'general' },
  { text: "What's something beautiful you noticed today?", category: 'general' },
  { text: "What season feels most like home to you?", category: 'general' },
  { text: "What's a song that always makes you feel something?", category: 'general' },
  { text: "What's a memory that still makes you feel warm?", category: 'general' },
  { text: "What would you tell your younger self if you could?", category: 'general' },
  { text: "What's something you're curious about right now?", category: 'general' }
];

/**
 * Create or retrieve the pryde_prompts system account
 */
export async function ensureSystemAccount() {
  let systemUser = await User.findOne({ username: SYSTEM_ACCOUNT.username });
  
  if (!systemUser) {
    console.log('🤖 Creating pryde_prompts system account...');
    
    // Generate a secure random password (never used for login)
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 12);
    
    systemUser = new User({
      ...SYSTEM_ACCOUNT,
      password: hashedPassword
    });
    
    await systemUser.save();
    console.log('✅ System account created:', systemUser.username);
  } else {
    // Ensure existing account has correct flags
    if (!systemUser.isSystemAccount) {
      systemUser.isSystemAccount = true;
      await systemUser.save();
      console.log('✅ Updated existing account with isSystemAccount flag');
    }
  }
  
  return systemUser;
}

/**
 * Seed initial prompts (skip if already exist)
 */
export async function seedPrompts() {
  const existingCount = await SystemPrompt.countDocuments();
  
  if (existingCount > 0) {
    console.log(`ℹ️  ${existingCount} prompts already exist, skipping seed`);
    return { seeded: 0, existing: existingCount };
  }
  
  console.log('📝 Seeding initial system prompts...');
  
  const prompts = INITIAL_PROMPTS.map(p => ({
    text: p.text,
    category: p.category,
    isActive: true,
    lastPostedAt: null,
    createdBy: null // System-seeded
  }));
  
  await SystemPrompt.insertMany(prompts);
  console.log(`✅ Seeded ${prompts.length} system prompts`);
  
  return { seeded: prompts.length, existing: 0 };
}

/**
 * Initialize system config defaults
 */
export async function initializeSystemConfig() {
  await SystemConfig.setValue(
    'systemPrompts.enabled',
    true,
    null,
    'Whether daily system prompt posting is enabled'
  );
  
  await SystemConfig.setValue(
    'systemPrompts.frequency',
    24,
    null,
    'How often to post prompts (in hours)'
  );
  
  console.log('✅ System config initialized');
}

/**
 * Main seed function - safe to call multiple times
 */
export async function seedSystemPrompts() {
  try {
    const systemUser = await ensureSystemAccount();
    const promptResult = await seedPrompts();
    await initializeSystemConfig();
    
    return {
      success: true,
      systemUserId: systemUser._id,
      ...promptResult
    };
  } catch (error) {
    console.error('❌ Failed to seed system prompts:', error);
    return { success: false, error: error.message };
  }
}

