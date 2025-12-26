/**
 * FEATURE REMOVAL MIGRATIONS INDEX
 * 
 * This file provides an overview of all prepared feature removal migrations.
 * These migrations are prepared but NOT automatically executed.
 * 
 * USAGE:
 *   1. Review the specific migration file for the feature you want to remove
 *   2. Uncomment the actual migration code
 *   3. Run the migration against your database
 *   4. Update the corresponding model schema to remove the field definitions
 * 
 * ROLLBACK:
 *   Each removal has a corresponding restore migration. However, note that
 *   restore migrations only restore the field structure, NOT the original data.
 * 
 * Created: 2025-12-26
 */

const migrations = {
  verification: {
    name: 'Verification System',
    remove: './20251226_remove_verification.js',
    restore: './20251226_restore_verification.js',
    models: ['User'],
    fields: ['isVerified', 'verificationRequested', 'verificationRequestDate', 'verificationRequestReason'],
    status: 'prepared',
    safeToRemove: true
  },
  
  relationshipStatus: {
    name: 'Relationship Status',
    remove: './20251226_remove_relationship_status.js',
    restore: './20251226_restore_relationship_status.js',
    models: ['User'],
    fields: ['relationshipStatus'],
    status: 'prepared',
    safeToRemove: true
  },
  
  gifPicker: {
    name: 'GIF Picker (Tenor)',
    remove: './20251226_remove_gif_picker.js',
    restore: './20251226_restore_gif_picker.js',
    models: [],
    frontendComponents: ['src/components/GifPicker.jsx', 'src/components/GifPicker.css'],
    status: 'prepared',
    safeToRemove: true,
    databaseMigration: false
  },
  
  editHistory: {
    name: 'Edit History',
    remove: './20251226_remove_edit_history.js',
    restore: './20251226_restore_edit_history.js',
    models: ['Post', 'Journal', 'Longform'],
    fields: {
      Post: ['editHistory', 'comments[].edited', 'comments[].editedAt'],
      Journal: ['editHistory'],
      Longform: ['editHistory']
    },
    status: 'prepared',
    safeToRemove: true
  }
};

/**
 * Get all migration metadata
 * @returns {Object} All migrations with their metadata
 */
function getAllMigrations() {
  return migrations;
}

/**
 * Get migration for a specific feature
 * @param {string} featureKey - Key of the feature (verification, relationshipStatus, gifPicker, editHistory)
 * @returns {Object|null} Migration metadata or null if not found
 */
function getMigration(featureKey) {
  return migrations[featureKey] || null;
}

/**
 * List all features that can be safely removed
 * @returns {Array} Array of feature keys that are safe to remove
 */
function getSafeToRemove() {
  return Object.entries(migrations)
    .filter(([_, config]) => config.safeToRemove)
    .map(([key]) => key);
}

module.exports = {
  migrations,
  getAllMigrations,
  getMigration,
  getSafeToRemove
};

