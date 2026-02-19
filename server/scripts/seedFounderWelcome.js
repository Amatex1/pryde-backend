/**
 * Seed Founder Welcome Post
 *
 * Creates a pinned welcome post authored by the founder account.
 *
 * Safe to run multiple times (idempotent):
 *   - Checks for an existing pinned post with the same title before creating.
 *
 * Usage:
 *   node server/scripts/seedFounderWelcome.js
 *
 * Requirements:
 *   - MONGODB_URI in environment (or server/.env)
 *   - FOUNDER_USER_ID in environment, OR a user with isFounder=true / role='founder' in the database
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

const WELCOME_TITLE = 'Welcome to Pryde';

const WELCOME_BODY = `Pryde is a protected digital community centre built for LGBTQ+ people and our supportive allies.

Here, we uplift.
We don't debate identities.
We allow emotion.
We protect each other.

Be proud.
Be kind.
Be real.

Thank you for being here.`;

async function resolveFounderUser() {
  // Prefer an explicit env override
  if (process.env.FOUNDER_USER_ID) {
    const user = await User.findById(process.env.FOUNDER_USER_ID).select('_id username');
    if (user) return user;
    console.warn('FOUNDER_USER_ID set but user not found — falling back to role lookup.');
  }

  // Try role-based lookup
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
      'Could not locate founder account. ' +
      'Set FOUNDER_USER_ID in your .env or ensure a user with role="founder" exists.'
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Founder account found: ${founder.username} (${founder._id})`);

  // Idempotency check — skip if post already exists
  const existing = await Post.findOne({
    author: founder._id,
    isPinned: true,
    'content.title': WELCOME_TITLE
  });

  if (existing) {
    console.log('Founder welcome post already exists — skipping creation.');
    await mongoose.disconnect();
    return;
  }

  // Also handle flat-content schema variant (content stored as string field)
  const existingFlat = await Post.findOne({
    author: founder._id,
    isPinned: true,
    title: WELCOME_TITLE
  });

  if (existingFlat) {
    console.log('Founder welcome post already exists (flat schema) — skipping creation.');
    await mongoose.disconnect();
    return;
  }

  const post = await Post.create({
    author: founder._id,
    content: WELCOME_BODY,
    title: WELCOME_TITLE,
    isPinned: true,
    visibility: 'public',
    createdAt: new Date(),
    updatedAt: new Date()
  });

  console.log(`Founder welcome post created successfully. Post ID: ${post._id}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('seedFounderWelcome error:', err);
  mongoose.disconnect();
  process.exit(1);
});
