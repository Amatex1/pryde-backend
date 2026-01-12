/**
 * Database Migration Runner
 * 
 * Simple migration framework for MongoDB schema changes.
 * Tracks applied migrations and runs pending ones.
 * 
 * Usage:
 *   npm run migrate        - Run pending migrations
 *   npm run migrate:status - Show migration status
 *   npm run migrate:create - Create new migration
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Migration schema to track applied migrations
 */
const migrationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  appliedAt: { type: Date, default: Date.now }
});

const Migration = mongoose.model('Migration', migrationSchema);

/**
 * Get all migration files
 */
const getMigrationFiles = () => {
  const migrationsDir = path.join(__dirname, 'scripts');
  
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
    return [];
  }
  
  return fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.js'))
    .sort(); // Alphabetical order (timestamp-based naming)
};

/**
 * Get applied migrations from database
 */
const getAppliedMigrations = async () => {
  const applied = await Migration.find().sort({ appliedAt: 1 });
  return applied.map(m => m.name);
};

/**
 * Get pending migrations
 */
const getPendingMigrations = async () => {
  const allMigrations = getMigrationFiles();
  const appliedMigrations = await getAppliedMigrations();
  
  return allMigrations.filter(m => !appliedMigrations.includes(m));
};

/**
 * Run a single migration
 */
const runMigration = async (filename) => {
  const migrationPath = path.join(__dirname, 'scripts', filename);
  
  console.log(`\n🔄 Running migration: ${filename}`);
  
  try {
    const migration = await import(migrationPath);
    
    if (typeof migration.up !== 'function') {
      throw new Error('Migration must export an "up" function');
    }
    
    // Run migration
    await migration.up();
    
    // Mark as applied
    await Migration.create({ name: filename });
    
    console.log(`✅ Migration completed: ${filename}`);
    return true;
  } catch (error) {
    console.error(`❌ Migration failed: ${filename}`);
    console.error(error);
    return false;
  }
};

/**
 * Run all pending migrations
 */
export const runPendingMigrations = async () => {
  console.log('🔍 Checking for pending migrations...\n');
  
  const pending = await getPendingMigrations();
  
  if (pending.length === 0) {
    console.log('✅ No pending migrations');
    return true;
  }
  
  console.log(`📋 Found ${pending.length} pending migration(s):\n`);
  pending.forEach(m => console.log(`  - ${m}`));
  
  for (const migration of pending) {
    const success = await runMigration(migration);
    if (!success) {
      console.error('\n❌ Migration failed. Stopping.');
      return false;
    }
  }
  
  console.log('\n✅ All migrations completed successfully');
  return true;
};

/**
 * Show migration status
 */
export const showMigrationStatus = async () => {
  const allMigrations = getMigrationFiles();
  const appliedMigrations = await getAppliedMigrations();
  
  console.log('\n📊 Migration Status:\n');
  
  if (allMigrations.length === 0) {
    console.log('  No migrations found');
    return;
  }
  
  allMigrations.forEach(migration => {
    const isApplied = appliedMigrations.includes(migration);
    const status = isApplied ? '✅ Applied' : '⏳ Pending';
    console.log(`  ${status}  ${migration}`);
  });
  
  console.log(`\n  Total: ${allMigrations.length}`);
  console.log(`  Applied: ${appliedMigrations.length}`);
  console.log(`  Pending: ${allMigrations.length - appliedMigrations.length}\n`);
};

/**
 * Create new migration file
 */
export const createMigration = (name) => {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
  const filename = `${timestamp}_${name}.js`;
  const filepath = path.join(__dirname, 'scripts', filename);
  
  const template = `/**
 * Migration: ${name}
 * Created: ${new Date().toISOString()}
 */

export const up = async () => {
  console.log('Running migration: ${name}');
  
  // TODO: Add migration logic here
  // Example:
  // await User.updateMany({}, { $set: { newField: 'default' } });
  
  console.log('Migration completed: ${name}');
};

export const down = async () => {
  console.log('Rolling back migration: ${name}');
  
  // TODO: Add rollback logic here
  
  console.log('Rollback completed: ${name}');
};
`;
  
  fs.writeFileSync(filepath, template);
  console.log(`✅ Created migration: ${filename}`);
  console.log(`   Path: ${filepath}`);
};

