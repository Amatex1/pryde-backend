/**
 * Seed System Accounts and Prompts
 *
 * Creates all platform system accounts with proper roles and seeds initial prompts.
 * Safe to run multiple times (idempotent).
 *
 * System Accounts:
 * - pryde_prompts: Shares optional reflection prompts (PROMPTS role)
 * - pryde_guide: Explains how Pryde works (GUIDE role)
 * - pryde_moderation: Communicates moderation actions (MODERATION role)
 * - pryde_announcements: Rare platform updates (ANNOUNCEMENTS role) - disabled by default
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

// ============================================================================
// SYSTEM ACCOUNT DEFINITIONS
// Each account has a specific role with strict behavioral limits
// ============================================================================

const SYSTEM_ACCOUNTS = [
  {
    username: 'pryde_prompts',
    email: 'prompts@prydesocial.com',
    fullName: 'Pryde Prompts',
    displayName: 'Pryde Prompts',
    systemRole: 'PROMPTS',
    systemCreatedBy: 'platform',
    systemDescription: 'This is an automated system account operated by Pryde Social. It shares optional reflection prompts for the community.',
    isActive: true
  },
  {
    username: 'pryde_guide',
    email: 'guide@prydesocial.com',
    fullName: 'Pryde Guide',
    displayName: 'Pryde Guide',
    systemRole: 'GUIDE',
    systemCreatedBy: 'platform',
    systemDescription: 'This is a system account that helps explain how Pryde works. It does not represent a person.',
    isActive: true
  },
  {
    username: 'pryde_moderation',
    email: 'moderation@prydesocial.com',
    fullName: 'Pryde Moderation',
    displayName: 'Pryde Moderation',
    systemRole: 'MODERATION',
    systemCreatedBy: 'platform',
    systemDescription: 'This account communicates moderation actions and policy updates on behalf of Pryde Social.',
    isActive: true
  },
  {
    username: 'pryde_announcements',
    email: 'announcements@prydesocial.com',
    fullName: 'Pryde Announcements',
    displayName: 'Pryde Announcements',
    systemRole: 'ANNOUNCEMENTS',
    systemCreatedBy: 'platform',
    systemDescription: 'This account shares rare platform updates. Used only for important announcements (max 1-2 per month).',
    isActive: false // Disabled by default - activate when needed
  }
];

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
 * Create or update a single system account
 * @param {Object} accountConfig - The account configuration
 * @returns {Object} The created/updated user document
 */
async function ensureSingleSystemAccount(accountConfig) {
  let systemUser = await User.findOne({ username: accountConfig.username });

  if (!systemUser) {
    console.log(`🤖 Creating ${accountConfig.username} system account...`);

    // Generate a secure random password (never used for login)
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 12);

    systemUser = new User({
      ...accountConfig,
      password: hashedPassword,
      isSystemAccount: true,
      role: 'user', // Not admin - just a special user
      emailVerified: true,
      ageVerified: true,
      termsAccepted: true,
      termsAcceptedAt: new Date()
    });

    await systemUser.save();
    console.log(`✅ System account created: ${systemUser.username} (${accountConfig.systemRole})`);
  } else {
    // Update existing account with new system fields if needed
    let needsUpdate = false;

    if (!systemUser.isSystemAccount) {
      systemUser.isSystemAccount = true;
      needsUpdate = true;
    }
    if (systemUser.systemRole !== accountConfig.systemRole) {
      systemUser.systemRole = accountConfig.systemRole;
      needsUpdate = true;
    }
    if (systemUser.systemCreatedBy !== accountConfig.systemCreatedBy) {
      systemUser.systemCreatedBy = accountConfig.systemCreatedBy;
      needsUpdate = true;
    }
    if (systemUser.systemDescription !== accountConfig.systemDescription) {
      systemUser.systemDescription = accountConfig.systemDescription;
      needsUpdate = true;
    }

    if (needsUpdate) {
      await systemUser.save();
      console.log(`✅ Updated ${accountConfig.username} with system account fields`);
    }
  }

  return systemUser;
}

/**
 * Create or retrieve all system accounts
 * @returns {Object} Map of usernames to user documents
 */
export async function ensureSystemAccounts() {
  console.log('🤖 Ensuring all system accounts exist...');

  const accounts = {};

  for (const accountConfig of SYSTEM_ACCOUNTS) {
    const user = await ensureSingleSystemAccount(accountConfig);
    accounts[accountConfig.username] = user;
  }

  console.log(`✅ All ${Object.keys(accounts).length} system accounts ready`);
  return accounts;
}

/**
 * Legacy function - kept for backward compatibility
 * Returns the pryde_prompts account specifically
 */
export async function ensureSystemAccount() {
  const accounts = await ensureSystemAccounts();
  return accounts['pryde_prompts'];
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

