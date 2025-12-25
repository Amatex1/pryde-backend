/**
 * Temp Media Cleanup Script
 *
 * Deletes orphaned temporary media that:
 * - Has status = "temporary"
 * - Has no owner (ownerId = null)
 * - Is older than MAX_AGE_MINUTES
 *
 * This prevents storage leaks from abandoned uploads.
 *
 * Usage:
 * - Run manually: node scripts/cleanupTempMedia.js
 * - Schedule with cron: 0 * * * * node scripts/cleanupTempMedia.js (every hour)
 * - Or call from server startup
 *
 * TEST ENVIRONMENT:
 * - Cleanup is DISABLED in test environment (NODE_ENV === 'test')
 * - This prevents flakiness and false failures in tests
 * - Tests should validate logic, not cron behavior
 *
 * DB READINESS:
 * - Cleanup is skipped if MongoDB is not connected
 * - This is best-effort, not critical - no exceptions thrown
 */

import mongoose from 'mongoose';
import TempMedia from '../models/TempMedia.js';
import config from '../config/config.js';

// Track if we've already logged the test environment skip message
let hasLoggedTestSkip = false;

// Configuration
const MAX_AGE_MINUTES = 60; // Delete temp media older than 60 minutes
const BATCH_SIZE = 100; // Process in batches to avoid memory issues
const DRY_RUN = process.argv.includes('--dry-run');

// GridFS bucket reference
let gridfsBucket;

/**
 * Initialize database connection
 */
const initDB = async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(config.mongoUri);
    console.log('📦 Connected to MongoDB');
  }

  // Initialize GridFS
  gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads'
  });
};

/**
 * Delete a file from GridFS by URL
 */
const deleteFromGridFS = async (fileUrl) => {
  try {
    if (!gridfsBucket || !fileUrl) return false;

    // Extract filename from URL
    let filename = fileUrl;
    if (fileUrl.includes('/')) {
      filename = fileUrl.split('/').pop();
    }

    const files = await gridfsBucket.find({ filename }).toArray();
    if (!files || files.length === 0) {
      return false;
    }

    await gridfsBucket.delete(files[0]._id);
    return true;
  } catch (error) {
    console.error(`❌ Error deleting ${fileUrl}:`, error.message);
    return false;
  }
};

/**
 * Delete all files associated with a TempMedia record
 */
const deleteMediaFiles = async (tempMedia) => {
  let deletedCount = 0;

  // Delete main file
  if (await deleteFromGridFS(tempMedia.url)) {
    deletedCount++;
  }

  // Delete responsive sizes
  if (tempMedia.sizes) {
    const sizesToDelete = [
      tempMedia.sizes.thumbnail,
      tempMedia.sizes.small,
      tempMedia.sizes.medium,
      tempMedia.sizes.avatar?.webp,
      tempMedia.sizes.avatar?.avif,
      tempMedia.sizes.feed?.webp,
      tempMedia.sizes.feed?.avif,
      tempMedia.sizes.full?.webp,
      tempMedia.sizes.full?.avif
    ].filter(Boolean);

    for (const sizeUrl of sizesToDelete) {
      if (await deleteFromGridFS(sizeUrl)) {
        deletedCount++;
      }
    }
  }

  return deletedCount;
};

/**
 * Main cleanup function
 *
 * FAIL-SAFE DESIGN:
 * - Never throws uncaught exceptions
 * - Skips cleanup in test environment
 * - Skips cleanup if DB is not connected
 * - Best-effort operation, not critical
 */
const cleanup = async () => {
  try {
    // ========================================
    // GUARD: Skip in test environment
    // ========================================
    // Tests should validate logic, not cron behavior
    // This prevents flakiness and false failures
    if (process.env.NODE_ENV === 'test') {
      if (!hasLoggedTestSkip) {
        console.log('[Cleanup] Disabled in test environment');
        hasLoggedTestSkip = true;
      }
      return { deleted: 0, filesDeleted: 0, skipped: true, reason: 'test_environment' };
    }

    // ========================================
    // GUARD: Check MongoDB connection readiness
    // ========================================
    // mongoose.connection.readyState values:
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    if (mongoose.connection.readyState !== 1) {
      console.log('[Cleanup] Mongo not connected, skipping temp media cleanup');
      return { deleted: 0, filesDeleted: 0, skipped: true, reason: 'db_not_connected' };
    }

    console.log('🧹 Starting temp media cleanup...');
    console.log(`📋 Configuration: MAX_AGE=${MAX_AGE_MINUTES}min, DRY_RUN=${DRY_RUN}`);

    const cutoffTime = new Date(Date.now() - MAX_AGE_MINUTES * 60 * 1000);
    console.log(`⏰ Cutoff time: ${cutoffTime.toISOString()}`);

    // Find orphaned temp media
    const orphanedMedia = await TempMedia.find({
      status: 'temporary',
      ownerId: null,
      createdAt: { $lt: cutoffTime }
    }).limit(BATCH_SIZE);

    console.log(`📊 Found ${orphanedMedia.length} orphaned temp media records`);

    if (orphanedMedia.length === 0) {
      console.log('✅ No orphaned media to clean up');
      return { deleted: 0, filesDeleted: 0 };
    }

    let totalDeleted = 0;
    let totalFilesDeleted = 0;

    for (const media of orphanedMedia) {
      console.log(`\n🗑️ Processing: ${media._id}`);
      console.log(`   URL: ${media.url}`);
      console.log(`   Age: ${Math.floor((Date.now() - media.createdAt.getTime()) / 60000)} minutes`);

      if (DRY_RUN) {
        console.log('   [DRY RUN] Would delete this media');
        totalDeleted++;
        continue;
      }

      // Delete files from GridFS
      const filesDeleted = await deleteMediaFiles(media);
      totalFilesDeleted += filesDeleted;

      // Delete the TempMedia record
      await media.deleteOne();
      totalDeleted++;

      console.log(`   ✅ Deleted (${filesDeleted} files)`);
    }

    console.log(`\n📊 Cleanup Summary:`);
    console.log(`   Records processed: ${totalDeleted}`);
    console.log(`   Files deleted: ${totalFilesDeleted}`);

    return { deleted: totalDeleted, filesDeleted: totalFilesDeleted };
  } catch (error) {
    // FAIL-SAFE: Log error but never crash the process
    console.error('[Cleanup] Error during temp media cleanup (non-fatal):', error.message);
    return { deleted: 0, filesDeleted: 0, error: error.message };
  }
};

// Export for use in server
export { cleanup as cleanupTempMedia, MAX_AGE_MINUTES };

// Run directly if called as script
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  initDB()
    .then(() => cleanup())
    .then((result) => {
      console.log('\n✅ Cleanup complete:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cleanup failed:', error);
      process.exit(1);
    });
}

