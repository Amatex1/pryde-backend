/**
 * One-time migration: populate the Follow collection from User.followers/following arrays.
 *
 * Run with (from project root):
 *   npm run migrate:follows
 *
 * Idempotent — existing Follow documents are skipped via the unique index.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load server/.env (one level up from server/scripts/)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Prevent production validation guards from running
process.env.NODE_ENV = process.env.NODE_ENV || 'script';

import mongoose from 'mongoose';

const mongoURI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI  ||
  process.env.MONGO_URL;

if (!mongoURI) {
  console.error('❌  No MongoDB URI found. Add MONGODB_URI to server/.env');
  process.exit(1);
}

const BATCH_SIZE = 500;

async function migrate() {
  await mongoose.connect(mongoURI);
  console.log('✅  Connected to MongoDB');

  // Import models after connecting
  const { default: User }   = await import('../models/User.js');
  const { default: Follow } = await import('../models/Follow.js');

  let processed = 0;
  let inserted  = 0;
  let skipped   = 0;

  const cursor = User.find({}, '_id following').cursor();

  for await (const user of cursor) {
    const edges = (user.following || []).map(id => ({
      follower: user._id,
      following: id
    }));

    for (let i = 0; i < edges.length; i += BATCH_SIZE) {
      const batch = edges.slice(i, i + BATCH_SIZE);
      try {
        const result = await Follow.insertMany(batch, { ordered: false });
        inserted += result.length;
      } catch (err) {
        if (err.code === 11000 || err.name === 'BulkWriteError') {
          const done = err.result?.nInserted ?? 0;
          inserted += done;
          skipped  += batch.length - done;
        } else {
          console.error('Unexpected error:', err.message);
        }
      }
    }

    processed++;
    if (processed % 500 === 0) {
      console.log(`  ${processed} users — ${inserted} inserted, ${skipped} skipped`);
    }
  }

  console.log(`\n✅  Migration complete`);
  console.log(`   Users processed : ${processed}`);
  console.log(`   Edges inserted  : ${inserted}`);
  console.log(`   Already existed : ${skipped}`);
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('❌  Migration failed:', err.message);
  process.exit(1);
});
