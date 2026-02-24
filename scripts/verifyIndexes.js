/**
 * Database Index Verification Script
 *
 * Connects to production MongoDB, reads defined indexes from Mongoose schemas,
 * fetches actual indexes from the database, and reports any gaps.
 *
 * SAFE: Read-only — does NOT create or drop any indexes.
 *
 * Usage:
 *   MONGODB_URI=<your-uri> node scripts/verifyIndexes.js
 *
 * Or with .env loaded:
 *   node scripts/verifyIndexes.js
 *
 * Expected output:
 *   ✅ Collection matches all defined indexes
 *   ⚠️  Missing index on: users → { email: 1 }
 *   ℹ️  Extra (unrecognised) index on: users → { legacyField: 1 }
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

// ─── Load all models ────────────────────────────────────────────────────────
// Importing models registers them in mongoose so we can inspect their indexes.
async function loadModels() {
  const models = [
    '../server/models/User.js',
    '../server/models/Post.js',
    '../server/models/Comment.js',
    '../server/models/Message.js',
    '../server/models/Notification.js',
    '../server/models/Group.js',
    '../server/models/Journal.js',
    '../server/models/LongformPost.js',
    '../server/models/PhotoEssay.js',
    '../server/models/PushSubscription.js',
    '../server/models/Report.js',
    '../server/models/Invite.js',
    '../server/models/Badge.js',
    '../server/models/Draft.js',
    '../server/models/Event.js',
  ];

  const loaded = [];
  for (const modelPath of models) {
    try {
      await import(modelPath);
      loaded.push(modelPath);
    } catch {
      // Model file may not exist for every app — skip silently
    }
  }
  return loaded;
}

// ─── Normalise an index key object to a canonical string for comparison ──────
function keyToString(key) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(key).map(([k, v]) => [k, Number(v)])
    )
  );
}

// ─── Main verification logic ─────────────────────────────────────────────────
async function verifyIndexes() {
  const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URL;
  if (!mongoURI) {
    console.error('❌  MONGODB_URI environment variable is required.');
    process.exit(1);
  }

  console.log('\n🔍 Connecting to MongoDB...');
  await mongoose.connect(mongoURI);
  console.log('✅ Connected.\n');

  await loadModels();

  const report = {
    checked: 0,
    missing: [],
    extra: [],
    ok: [],
  };

  const db = mongoose.connection.db;

  for (const [modelName, model] of Object.entries(mongoose.models)) {
    const collectionName = model.collection.collectionName;

    // Schema-defined indexes (the ones we *expect* to exist)
    const schemaDefined = model.schema.indexes().map(([key, opts]) => ({
      key,
      keyStr: keyToString(key),
      unique: !!opts.unique,
      sparse: !!opts.sparse,
      name: opts.name,
    }));

    // Actual indexes in the database
    let actualIndexes = [];
    try {
      actualIndexes = await db.collection(collectionName).indexes();
    } catch {
      console.warn(`  ⚠️  Could not read indexes for ${collectionName} — collection may not exist yet.`);
      continue;
    }

    // _id index is always present — exclude from comparison
    const actualKeyed = actualIndexes
      .filter(idx => !idx.key._id)
      .map(idx => ({ keyStr: keyToString(idx.key), name: idx.name, key: idx.key }));

    const schemaKeyStrs = new Set(schemaDefined.map(i => i.keyStr));
    const actualKeyStrs = new Set(actualKeyed.map(i => i.keyStr));

    // Find missing indexes (defined in schema, not in DB)
    for (const schemaIdx of schemaDefined) {
      if (!actualKeyStrs.has(schemaIdx.keyStr)) {
        report.missing.push({ model: modelName, collection: collectionName, key: schemaIdx.key });
      }
    }

    // Find extra indexes (in DB, not defined in schema — may be legacy)
    for (const actualIdx of actualKeyed) {
      if (!schemaKeyStrs.has(actualIdx.keyStr)) {
        report.extra.push({ model: modelName, collection: collectionName, key: actualIdx.key, name: actualIdx.name });
      }
    }

    const modelMissing = report.missing.filter(i => i.model === modelName).length;
    const modelExtra = report.extra.filter(i => i.model === modelName).length;

    if (modelMissing === 0 && modelExtra === 0) {
      report.ok.push(modelName);
      console.log(`  ✅ ${modelName} (${collectionName}) — all ${actualKeyed.length} indexes match`);
    } else {
      console.log(`  ⚠️  ${modelName} (${collectionName}) — ${modelMissing} missing, ${modelExtra} extra`);
    }

    report.checked++;
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log('📊  INDEX VERIFICATION REPORT');
  console.log('─'.repeat(60));
  console.log(`Models checked:  ${report.checked}`);
  console.log(`Fully matching:  ${report.ok.length}`);
  console.log(`Missing indexes: ${report.missing.length}`);
  console.log(`Extra indexes:   ${report.extra.length}`);

  if (report.missing.length > 0) {
    console.log('\n🔴  MISSING INDEXES (exist in schema but not in DB):');
    for (const item of report.missing) {
      console.log(`   • ${item.collection} → ${JSON.stringify(item.key)}`);
      console.log(`     Fix: await mongoose.model('${item.model}').ensureIndexes()`);
      console.log(`     Or:  db.${item.collection}.createIndex(${JSON.stringify(item.key)})`);
    }
  }

  if (report.extra.length > 0) {
    console.log('\n🟡  EXTRA INDEXES (in DB but not in schema — may be legacy):');
    for (const item of report.extra) {
      console.log(`   • ${item.collection} → ${JSON.stringify(item.key)}  [name: ${item.name}]`);
    }
  }

  if (report.missing.length === 0 && report.extra.length === 0) {
    console.log('\n✅  All indexes match. No action required.');
  }

  console.log('─'.repeat(60) + '\n');

  await mongoose.disconnect();
  process.exit(report.missing.length > 0 ? 1 : 0);
}

verifyIndexes().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
