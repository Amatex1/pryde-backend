/**
 * ROLLBACK: Restore Verification System
 * 
 * FEATURE: Verification System (Blue Checkmark)
 * MODELS AFFECTED: User
 * FIELDS TO RESTORE:
 *   - isVerified (Boolean, default: false)
 *   - verificationRequested (Boolean, default: false)
 *   - verificationRequestDate (Date, default: null)
 *   - verificationRequestReason (String, default: '')
 * 
 * DEPENDENCIES:
 *   - Settings UI (verification request form)
 *   - Admin panel verification-requests tab
 *   - Admin routes: GET/PUT /api/admin/verification-requests
 *   - Profile display (verified badge)
 * 
 * WARNING: This rollback restores field structure but NOT original data.
 *          All users will have default values after rollback.
 * 
 * CREATED: 2025-12-26
 * STATUS: PREPARED (not executed)
 */

/**
 * Restore verification fields to User model with safe defaults
 * 
 * @param {Object} db - MongoDB database connection
 * @returns {Promise<Object>} Rollback result
 */
module.exports.down = async (db) => {
  console.log('[ROLLBACK] Restore Verification System');
  console.log('[DRY RUN] The following operations would be executed:');
  console.log('');
  console.log('1. Set default values for verification fields on all users:');
  console.log('   - isVerified: false');
  console.log('   - verificationRequested: false');
  console.log('   - verificationRequestDate: null');
  console.log('   - verificationRequestReason: ""');
  console.log('');
  console.log('WARNING: Original data cannot be restored. All users get default values.');
  console.log('');
  
  // ============================================================
  // ACTUAL ROLLBACK CODE (COMMENTED OUT FOR SAFETY)
  // ============================================================
  // 
  // const result = await db.collection('users').updateMany(
  //   {
  //     // Only update documents that don't have these fields
  //     $or: [
  //       { isVerified: { $exists: false } },
  //       { verificationRequested: { $exists: false } }
  //     ]
  //   },
  //   {
  //     $set: {
  //       isVerified: false,
  //       verificationRequested: false,
  //       verificationRequestDate: null,
  //       verificationRequestReason: ''
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
  name: 'restore_verification',
  feature: 'Verification System',
  models: ['User'],
  fields: [
    'isVerified',
    'verificationRequested',
    'verificationRequestDate',
    'verificationRequestReason'
  ],
  restoredDefaults: {
    isVerified: false,
    verificationRequested: false,
    verificationRequestDate: null,
    verificationRequestReason: ''
  },
  createdAt: '2025-12-26',
  status: 'prepared'
};

