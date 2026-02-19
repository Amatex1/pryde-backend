/**
 * Seed Community-Centre Style Posts
 *
 * Creates 6 example community prompts authored by the founder/system account.
 * Idempotent — checks for existing posts by content before inserting.
 *
 * Usage:
 *   node server/scripts/seedCommunityPosts.js
 *
 * Requirements:
 *   - MONGODB_URI in environment (or server/.env)
 *   - FOUNDER_USER_ID in environment, OR a user with isFounder=true / role='founder'
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

import Post from '../models/Post.js';
import User from '../models/User.js';

const MONGODB_URI = process.env.MONGODB_URI;

const COMMUNITY_PROMPTS = [
  'What made you feel proud this week?',
  'Share something small that made you smile today.',
  'What does belonging mean to you?',
  "What's something you're working through right now?",
  'Who inspires you in the LGBTQ+ community?',
  'Drop a win — big or small.'
];

async function resolveFounderUser() {
  if (process.env.FOUNDER_USER_ID) {
    const user = await User.findById(process.env.FOUNDER_USER_ID).select('_id username');
    if (user) return user;
    console.warn('FOUNDER_USER_ID set but user not found — falling back to role lookup.');
  }

  const byRole = await User.findOne({ role: 'founder' }).select('_id username');
  if (byRole) return byRole;

  const byFlag = await User.findOne({ isFounder: true }).select('_id username');
  if (byFlag) return byFlag;

  return null;
}

async function run() {
  if (!MONGODB_URI) {
    console.error('Error: MONGODB_URI environment variable is not set.');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB.');

  const founder = await resolveFounderUser();
  if (!founder) {
    console.error(
      'Could not locate founder/system account. ' +
      'Set FOUNDER_USER_ID in your .env or ensure a user with role="founder" exists.'
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Seeding as: ${founder.username} (${founder._id})`);

  let created = 0;
  let skipped = 0;

  for (const prompt of COMMUNITY_PROMPTS) {
    const existing = await Post.findOne({ author: founder._id, content: prompt });
    if (existing) {
      console.log(`  Skip (exists): "${prompt}"`);
      skipped++;
      continue;
    }

    await Post.create({
      author: founder._id,
      content: prompt,
      isPinned: false,
      visibility: 'public',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log(`  Created: "${prompt}"`);
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('seedCommunityPosts error:', err);
  mongoose.disconnect();
  process.exit(1);
});
