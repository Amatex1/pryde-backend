/**
 * Diagnose Badge Issue
 * Checks what users exist and their badge data
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

import User from '../models/User.js';
import Badge from '../models/Badge.js';

async function diagnose() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URL);
  console.log('Connected to MongoDB\n');

  // 1. List all users (just username + badges)
  const users = await User.find({})
    .select('username badges publicBadges hiddenBadges')
    .lean();

  console.log(`=== USERS IN DB (${users.length} total) ===`);
  for (const u of users) {
    console.log(`\nUser: @${u.username} (${u._id})`);
    console.log(`  badges (${(u.badges || []).length}):`, u.badges || []);
    console.log(`  publicBadges:`, u.publicBadges || []);
    console.log(`  hiddenBadges:`, u.hiddenBadges || []);
  }

  // 2. List all badges in DB
  const badges = await Badge.find({}).select('id label category isActive').lean();
  console.log(`\n=== BADGES IN DB (${badges.length} total) ===`);
  for (const b of badges) {
    console.log(`  ${b.id} | ${b.label} | category: ${b.category} | active: ${b.isActive}`);
  }

  // 3. For each user, try to look up their badge objects
  console.log('\n=== BADGE LOOKUP TEST ===');
  for (const u of users) {
    if (!u.badges || u.badges.length === 0) continue;
    const found = await Badge.find({ id: { $in: u.badges }, isActive: true }).lean();
    console.log(`\n@${u.username}: has ${u.badges.length} badge IDs, found ${found.length} badge docs`);
    if (found.length < u.badges.length) {
      const foundIds = new Set(found.map(b => b.id));
      const missing = u.badges.filter(id => !foundIds.has(id));
      console.log(`  MISSING/UNMATCHED badge IDs:`, missing);
    }
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

diagnose().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
