/**
 * MIGRATION: Remove Relationship Status
 * 
 * FEATURE: Relationship Status Display
 * MODELS AFFECTED: User
 * FIELDS:
 *   - relationshipStatus (String, default: '', trim: true)
 * 
 * DEPENDENCIES:
 *   - Settings/Profile UI (relationship status input)
 *   - Profile display component
 *   - User routes that include relationshipStatus
 * 
 * SAFE TO REMOVE: Yes (audit confirmed 2025-12-26)
 * 
 * RATIONALE:
 *   - Feature is optional and rarely used
 *   - Not core to platform identity/purpose
 *   - Users can include in bio if desired
 * 
 * DATA IMPACT:
 *   - Field will be unset from all User documents
 *   - Any existing relationship status data will be lost
 *   - No cascade effects on other collections
 * 
 * CREATED: 2025-12-26
 * STATUS: PREPARED (not executed)
 */

/**
 * Remove relationshipStatus field from User model
 * 
 * @param {Object} db - MongoDB database connection
 * @returns {Promise<Object>} Migration result
 */
module.exports.up = async (db) => {
  console.log('[MIGRATION] Remove Relationship Status');
  console.log('[DRY RUN] The following operations would be executed:');
  console.log('');
  console.log('1. Unset fields from User collection:');
  console.log('   - relationshipStatus');
  console.log('');
  
  // Count affected users (those with non-empty relationshipStatus)
  // const affectedCount = await db.collection('users').countDocuments({
  //   relationshipStatus: { $exists: true, $ne: '' }
  // });
  // console.log(`[INFO] ${affectedCount} users have relationship status set`);
  
  // ============================================================
  // ACTUAL MIGRATION CODE (COMMENTED OUT FOR SAFETY)
  // ============================================================
  // 
  // const result = await db.collection('users').updateMany(
  //   {},
  //   {
  //     $unset: {
  //       relationshipStatus: ''
  //     }
  //   }
  // );
  // 
  // console.log(`[MIGRATION] Updated ${result.modifiedCount} users`);
  // return { modifiedCount: result.modifiedCount };
  // ============================================================
  
  console.log('[DRY RUN] No changes made. Uncomment migration code to execute.');
  return { dryRun: true, modifiedCount: 0 };
};

/**
 * Migration metadata
 */
module.exports.meta = {
  name: 'remove_relationship_status',
  feature: 'Relationship Status',
  models: ['User'],
  fields: ['relationshipStatus'],
  safeToRemove: true,
  createdAt: '2025-12-26',
  status: 'prepared'
};

