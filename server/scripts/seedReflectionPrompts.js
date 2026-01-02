/**
 * Seed Reflection Prompts for Pryde Social
 *
 * Populates the ReflectionPrompt model with approved prompts.
 * These are shown privately to individual users (not posted publicly).
 *
 * IMPORTANT DISTINCTION from System Prompts:
 * - Reflection Prompts are NOT posted publicly
 * - Shown privately per user at top of feed/journals
 * - Dismissible and non-repeating per user
 * - Exist independently from System Prompts
 *
 * SEEDING RULES:
 * - Only seeds if ReflectionPrompt.count === 0
 * - Does NOT duplicate if prompts already exist
 * - All seeded prompts marked active = true (available for selection)
 *
 * Usage: node server/scripts/seedReflectionPrompts.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ReflectionPrompt from '../models/ReflectionPrompt.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

// ============================================================================
// APPROVED REFLECTION PROMPTS
// Same prompts used for System Prompts, but these are shown privately per user
// ============================================================================
const REFLECTION_PROMPTS = [
  { text: "What's something that's been quietly on your mind lately?", cadence: 'daily' },
  { text: "When do you feel most like yourself?", cadence: 'daily' },
  { text: "What helps you feel grounded on difficult days?", cadence: 'daily' },
  { text: "What does rest look like for you right now?", cadence: 'daily' },
  { text: "Is there something you're learning to be gentler with?", cadence: 'daily' },
  { text: "What brings you a sense of calm, even briefly?", cadence: 'daily' },
  { text: "What does 'home' mean to you?", cadence: 'weekly' },
  { text: "What's something you don't say out loud very often?", cadence: 'daily' },
  { text: "When do you feel least pressured to be someone else?", cadence: 'daily' },
  { text: "What helps you feel safe being yourself?", cadence: 'daily' },
  { text: "What's something you're proud of, quietly?", cadence: 'daily' },
  { text: "What does a good day look like right now?", cadence: 'daily' },
  { text: "What helps you reset when things feel overwhelming?", cadence: 'daily' },
  { text: "Is there something you wish people understood about you?", cadence: 'weekly' },
  { text: "What feels steady in your life at the moment?", cadence: 'daily' },
  { text: "What kind of support feels most helpful to you?", cadence: 'weekly' },
  { text: "What does taking care of yourself mean these days?", cadence: 'daily' },
  { text: "What makes you feel seen without needing to explain?", cadence: 'daily' },
  { text: "What helps you slow down?", cadence: 'daily' },
  { text: "What's something you want more of this year?", cadence: 'weekly' },
  { text: "What helps you feel connected?", cadence: 'daily' },
  { text: "What feels heavy lately — and what feels light?", cadence: 'daily' },
  { text: "What are you giving yourself permission to do?", cadence: 'daily' },
  { text: "What does 'enough' look like for you right now?", cadence: 'daily' },
  { text: "What helps you feel at ease in your own company?", cadence: 'daily' }
];

/**
 * Seed reflection prompts into the database
 * Only runs if no prompts exist (idempotent)
 */
export async function seedReflectionPrompts() {
  const existingCount = await ReflectionPrompt.countDocuments();

  if (existingCount > 0) {
    console.log(`ℹ️  ${existingCount} reflection prompts already exist - skipping seed`);
    return { seeded: 0, existing: existingCount };
  }

  console.log(`📝 Seeding ${REFLECTION_PROMPTS.length} reflection prompts...`);

  const prompts = REFLECTION_PROMPTS.map((p, index) => ({
    text: p.text,
    cadence: p.cadence,
    active: index === 0, // First prompt is active by default
    createdBy: null, // System-seeded
    createdAt: new Date(),
    activatedAt: index === 0 ? new Date() : null
  }));

  await ReflectionPrompt.insertMany(prompts);

  console.log(`✅ Seeded ${prompts.length} reflection prompts`);
  console.log(`   First prompt activated: "${REFLECTION_PROMPTS[0].text.substring(0, 40)}..."`);

  return { seeded: prompts.length, existing: 0 };
}

// ============================================================================
// CLI EXECUTION
// ============================================================================
async function main() {
  console.log('🌈 Reflection Prompt Seeding Script');
  console.log('====================================\n');

  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in environment');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const result = await seedReflectionPrompts();

    console.log('\n📊 Summary:');
    console.log(`   Seeded: ${result.seeded}`);
    console.log(`   Existing: ${result.existing}`);
    console.log(`   Total: ${result.seeded + result.existing}`);

    await mongoose.disconnect();
    console.log('\n✅ Done');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
const isMainModule = process.argv[1]?.includes('seedReflectionPrompts');
if (isMainModule) {
  main();
}

