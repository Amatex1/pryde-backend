/**
 * ROLLBACK: Restore Relationship Status
 * 
 * FEATURE: Relationship Status Display
 * MODELS AFFECTED: User
 * FIELDS TO RESTORE:
 *   - relationshipStatus (String, default: '')
 * 
 * DEPENDENCIES:
 *   - Settings/Profile UI (relationship status input)
 *   - Profile display component
 *   - User routes that include relationshipStatus
 * 
 * WARNING: This rollback restores field structure but NOT original data.
 *          All users will have empty string after rollback.
 * 
 * CREATED: 2025-12-26
 * STATUS: PREPARED (not executed)
 */

/**
 * Restore relationshipStatus field to User model with empty default
 * 
 * @param {Object} db - MongoDB database connection
 * @returns {Promise<Object>} Rollback result
 */
module.exports.down = async (db) => {
  console.log('[ROLLBACK] Restore Relationship Status');
  console.log('[DRY RUN] The following operations would be executed:');
  console.log('');
  console.log('1. Set default value for relationshipStatus on all users:');
  console.log('   - relationshipStatus: ""');
  console.log('');
  console.log('WARNING: Original data cannot be restored. All users get empty string.');
  console.log('');
  
  // ============================================================
  // ACTUAL ROLLBACK CODE (COMMENTED OUT FOR SAFETY)
  // ============================================================
  // 
  // const result = await db.collection('users').updateMany(
  //   {
  //     relationshipStatus: { $exists: false }
  //   },
  //   {
  //     $set: {
  //       relationshipStatus: ''
  //     }
  //   }
  // );
  // 
  // console.log(`[ROLLBACK] Updated ${result.modifiedCount} users`);
  // return { modifiedCount: result.modifiedCount };
  // ============================================================
  
  console.log('[DRY RUN] No changes made. Uncomment rollback code to execute.');
  return { dryRun: true, modifiedCount: 0 };
};

/**
 * Rollback metadata
 */
module.exports.meta = {
  name: 'restore_relationship_status',
  feature: 'Relationship Status',
  models: ['User'],
  fields: ['relationshipStatus'],
  restoredDefaults: {
    relationshipStatus: ''
  },
  createdAt: '2025-12-26',
  status: 'prepared'
};

