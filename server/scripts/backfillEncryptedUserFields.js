/**
 * backfillEncryptedUserFields.js
 *
 * One-time migration: encrypt existing plaintext PII fields in the User collection.
 *
 * Affected fields: birthday, pronouns, gender, sexualOrientation
 *
 * Safety:
 *   - DRY RUN by default — pass --apply to write changes.
 *   - Processes users in batches of BATCH_SIZE to limit memory use.
 *   - Loads each user document through Mongoose (triggers get/set hooks) so
 *     encryption is applied identically to normal application writes.
 *   - No plaintext PII values are written to the console or logs.
 *
 * Usage:
 *   # Preview (dry run):
 *   node server/scripts/backfillEncryptedUserFields.js
 *
 *   # Apply changes:
 *   node server/scripts/backfillEncryptedUserFields.js --apply
 *
 * Prerequisites:
 *   - MESSAGE_ENCRYPTION_KEY must be set in the environment.
 *   - Run from the project root (or ensure .env is loaded from server/.env).
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { isEncrypted } from '../utils/encryption.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

// ── Config ────────────────────────────────────────────────────────────────────

const DRY_RUN = !process.argv.includes('--apply');
const BATCH_SIZE = 100;

// ── PII field names to check / backfill ──────────────────────────────────────

const PII_FIELDS = ['pronouns', 'gender', 'sexualOrientation', 'birthday'];

// ── DB connection ─────────────────────────────────────────────────────────────

async function connectDB() {
  const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URL;
  if (!mongoURI) {
    console.error('❌ MONGODB_URI or MONGO_URL not set in environment.');
    process.exit(1);
  }
  await mongoose.connect(mongoURI);
  console.log('✅ Connected to MongoDB');
}

// ── Detect whether a raw field value needs encryption ─────────────────────────

function needsEncryption(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') return false;
  // Date objects are legacy BSON Dates — needs migration to encrypted string
  if (rawValue instanceof Date) return true;
  // Non-empty string that is not already encrypted
  if (typeof rawValue === 'string') return !isEncrypted(rawValue);
  return false;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  // Validate encryption key is configured before doing anything
  const encKey = process.env.MESSAGE_ENCRYPTION_KEY;
  if (!encKey || encKey.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(encKey)) {
    console.error('❌ MESSAGE_ENCRYPTION_KEY is missing or invalid (must be 64 hex chars).');
    console.error('   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    process.exit(1);
  }

  await connectDB();

  // Import User AFTER connecting so Mongoose schema registration is clean
  const { default: User } = await import('../models/User.js');

  console.log(`\n${'─'.repeat(60)}`);
  console.log(DRY_RUN
    ? '⚠️  DRY RUN — no changes will be written. Pass --apply to run for real.'
    : '🚀 APPLY MODE — changes WILL be written to MongoDB.');
  console.log(`${'─'.repeat(60)}\n`);

  let totalScanned = 0;
  let totalNeedsBackfill = 0;
  let totalUpdated = 0;
  let totalErrors = 0;
  let lastId = null;

  // Build the query filter that selects only users with at least one plaintext PII field
  // We use $or so the scan skips already-fully-encrypted users on subsequent runs.
  // birthday: Date type means legacy unencrypted; null means unset (skip); encrypted = string
  // string fields: empty string means unset (skip)
  const leanSelectFields = PII_FIELDS.join(' ') + ' _id';

  console.log(`Scanning User collection in batches of ${BATCH_SIZE}...\n`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query = lastId ? { _id: { $gt: lastId } } : {};

    // Lean query to get raw (un-gettered) values for accurate plaintext detection
    const batch = await User
      .find(query)
      .select(leanSelectFields)
      .sort({ _id: 1 })
      .limit(BATCH_SIZE)
      .lean({ getters: false });

    if (batch.length === 0) break;

    totalScanned += batch.length;
    lastId = batch[batch.length - 1]._id;

    // Identify which users in this batch have at least one plaintext PII field
    const toUpdate = batch.filter(u =>
      PII_FIELDS.some(field => needsEncryption(u[field]))
    );

    if (toUpdate.length === 0) {
      process.stdout.write('.');
      continue;
    }

    totalNeedsBackfill += toUpdate.length;
    process.stdout.write('\n');

    for (const rawUser of toUpdate) {
      const fieldsToMigrate = PII_FIELDS.filter(f => needsEncryption(rawUser[f]));
      // Log only field names and user ID — never log plaintext PII values
      console.log(`  User ${rawUser._id}: will encrypt [${fieldsToMigrate.join(', ')}]`);

      if (DRY_RUN) continue;

      try {
        // Load full Mongoose document to invoke get/set hooks
        const user = await User.findById(rawUser._id)
          .select(PII_FIELDS.join(' '));

        if (!user) {
          console.warn(`  ⚠️ User ${rawUser._id} not found — skipping.`);
          continue;
        }

        // Re-assign each field to trigger the encryption setter.
        // The getter already decrypts legacy values, so setter receives plaintext.
        for (const field of fieldsToMigrate) {
          // For birthday, the getter returns a Date object; setter accepts Date or string
          const current = user[field];
          user[field] = current; // getter → setter cycle triggers encryption
        }

        await user.save();
        totalUpdated++;
      } catch (err) {
        totalErrors++;
        console.error(`  ❌ Error updating user ${rawUser._id}: ${err.message}`);
      }
    }
  }

  console.log('\n');
  console.log('─'.repeat(60));
  console.log('Backfill Summary');
  console.log('─'.repeat(60));
  console.log(`  Total users scanned : ${totalScanned}`);
  console.log(`  Users needing backfill: ${totalNeedsBackfill}`);
  if (!DRY_RUN) {
    console.log(`  Users updated       : ${totalUpdated}`);
    console.log(`  Errors              : ${totalErrors}`);
  } else {
    console.log(`  (Dry run — no writes performed)`);
  }
  console.log('─'.repeat(60));

  if (totalErrors > 0) {
    console.error(`\n⚠️ ${totalErrors} errors occurred. Review the output above.`);
    process.exit(1);
  }

  if (DRY_RUN && totalNeedsBackfill > 0) {
    console.log(`\nℹ️  Re-run with --apply to encrypt ${totalNeedsBackfill} user(s).`);
  } else if (!DRY_RUN && totalUpdated === 0 && totalNeedsBackfill === 0) {
    console.log('\n✅ All PII fields are already encrypted. Nothing to do.');
  } else if (!DRY_RUN) {
    console.log(`\n✅ Done. ${totalUpdated} user(s) updated.`);
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
