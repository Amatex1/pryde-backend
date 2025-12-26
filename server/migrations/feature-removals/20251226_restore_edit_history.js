/**
 * ROLLBACK: Restore Edit History
 * 
 * FEATURE: Edit History Tracking
 * MODELS AFFECTED: Post, Journal, Longform
 * 
 * FIELDS TO RESTORE:
 *   Post: editHistory: [], comments[].edited: false, comments[].editedAt: null
 *   Journal: editHistory: []
 *   Longform: editHistory: []
 * 
 * WARNING: This rollback restores field structure but NOT original data.
 *          All edit history will be empty arrays after rollback.
 * 
 * CREATED: 2025-12-26
 * STATUS: PREPARED (not executed)
 */

/**
 * Restore edit history fields to Post, Journal, Longform with empty defaults
 * 
 * @param {Object} db - MongoDB database connection
 * @returns {Promise<Object>} Rollback result
 */
module.exports.down = async (db) => {
  console.log('[ROLLBACK] Restore Edit History');
  console.log('[DRY RUN] The following operations would be executed:');
  console.log('');
  console.log('1. Set default editHistory on posts collection:');
  console.log('   - editHistory: []');
  console.log('');
  console.log('2. Set default editHistory on journals collection:');
  console.log('   - editHistory: []');
  console.log('');
  console.log('3. Set default editHistory on longforms collection:');
  console.log('   - editHistory: []');
  console.log('');
  console.log('WARNING: Original edit history data cannot be restored.');
  console.log('');
  
  // ============================================================
  // ACTUAL ROLLBACK CODE (COMMENTED OUT FOR SAFETY)
  // ============================================================
  // 
  // // Restore to posts
  // const postsResult = await db.collection('posts').updateMany(
  //   { editHistory: { $exists: false } },
  //   { $set: { editHistory: [] } }
  // );
  // console.log(`[ROLLBACK] Posts: restored editHistory to ${postsResult.modifiedCount} docs`);
  // 
  // // Restore to journals
  // const journalsResult = await db.collection('journals').updateMany(
  //   { editHistory: { $exists: false } },
  //   { $set: { editHistory: [] } }
  // );
  // console.log(`[ROLLBACK] Journals: restored editHistory to ${journalsResult.modifiedCount} docs`);
  // 
  // // Restore to longforms
  // const longformsResult = await db.collection('longforms').updateMany(
  //   { editHistory: { $exists: false } },
  //   { $set: { editHistory: [] } }
  // );
  // console.log(`[ROLLBACK] Longforms: restored editHistory to ${longformsResult.modifiedCount} docs`);
  // 
  // return {
  //   posts: postsResult.modifiedCount,
  //   journals: journalsResult.modifiedCount,
  //   longforms: longformsResult.modifiedCount
  // };
  // ============================================================
  
  console.log('[DRY RUN] No changes made. Uncomment rollback code to execute.');
  return { dryRun: true, modifiedCount: 0 };
};

/**
 * Rollback metadata
 */
module.exports.meta = {
  name: 'restore_edit_history',
  feature: 'Edit History',
  models: ['Post', 'Journal', 'Longform'],
  fields: {
    Post: ['editHistory'],
    Journal: ['editHistory'],
    Longform: ['editHistory']
  },
  restoredDefaults: {
    editHistory: []
  },
  createdAt: '2025-12-26',
  status: 'prepared'
};

