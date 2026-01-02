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

// ============================================================================
// APPROVED PROMPT LIST - These exact prompts are seeded
// Each prompt is calm, open-ended, and non-pressuring
// ============================================================================
const INITIAL_PROMPTS = [
  { text: "What's something that's been quietly on your mind lately?", category: 'reflection' },
  { text: "When do you feel most like yourself?", category: 'identity' },
  { text: "What helps you feel grounded on difficult days?", category: 'grounding' },
  { text: "What does rest look like for you right now?", category: 'grounding' },
  { text: "Is there something you're learning to be gentler with?", category: 'reflection' },
  { text: "What brings you a sense of calm, even briefly?", category: 'grounding' },
  { text: "What does 'home' mean to you?", category: 'identity' },
  { text: "What's something you don't say out loud very often?", category: 'reflection' },
  { text: "When do you feel least pressured to be someone else?", category: 'identity' },
  { text: "What helps you feel safe being yourself?", category: 'identity' },
  { text: "What's something you're proud of, quietly?", category: 'reflection' },
  { text: "What does a good day look like right now?", category: 'general' },
  { text: "What helps you reset when things feel overwhelming?", category: 'grounding' },
  { text: "Is there something you wish people understood about you?", category: 'identity' },
  { text: "What feels steady in your life at the moment?", category: 'grounding' },
  { text: "What kind of support feels most helpful to you?", category: 'connection' },
  { text: "What does taking care of yourself mean these days?", category: 'grounding' },
  { text: "What makes you feel seen without needing to explain?", category: 'connection' },
  { text: "What helps you slow down?", category: 'grounding' },
  { text: "What's something you want more of this year?", category: 'general' },
  { text: "What helps you feel connected?", category: 'connection' },
  { text: "What feels heavy lately — and what feels light?", category: 'reflection' },
  { text: "What are you giving yourself permission to do?", category: 'reflection' },
  { text: "What does 'enough' look like for you right now?", category: 'reflection' },
  { text: "What helps you feel at ease in your own company?", category: 'identity' }
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
 * Seed initial prompts
 * - If no prompts exist: seeds all approved prompts
 * - If prompts exist: adds any missing prompts from the approved list
 *
 * This ensures the approved prompt list stays in sync without deleting user data
 */
export async function seedPrompts() {
  const existingPrompts = await SystemPrompt.find({}).select('text');
  const existingTexts = new Set(existingPrompts.map(p => p.text));

  // Find prompts that need to be added
  const promptsToAdd = INITIAL_PROMPTS.filter(p => !existingTexts.has(p.text));

  if (promptsToAdd.length === 0) {
    console.log(`ℹ️  All ${INITIAL_PROMPTS.length} approved prompts already exist`);
    return { seeded: 0, existing: existingPrompts.length };
  }

  console.log(`📝 Seeding ${promptsToAdd.length} new system prompts...`);

  const prompts = promptsToAdd.map(p => ({
    text: p.text,
    category: p.category,
    isActive: true,
    lastPostedAt: null,
    createdBy: null // System-seeded
  }));

  await SystemPrompt.insertMany(prompts);
  console.log(`✅ Seeded ${prompts.length} new system prompts (total: ${existingPrompts.length + prompts.length})`);

  return { seeded: prompts.length, existing: existingPrompts.length };
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

