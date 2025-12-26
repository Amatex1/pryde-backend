/**
 * ROLLBACK: Restore GIF Picker
 * 
 * FEATURE: GIF Picker (Tenor Integration)
 * MODELS AFFECTED: None (frontend-only feature)
 * 
 * RESTORATION STEPS:
 *   1. Restore src/components/GifPicker.jsx from git or backup
 *   2. Restore src/components/GifPicker.css from git or backup
 *   3. Re-add GifPicker imports to Feed.jsx and other components
 *   4. Re-add GIF button to comment/post forms
 * 
 * TENOR API CONFIGURATION:
 *   - API Key: AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ (public demo key)
 *   - Client Key: pryde_social
 *   - NOTE: For production, register for a proper Tenor API key
 * 
 * CREATED: 2025-12-26
 * STATUS: PREPARED (not executed)
 */

/**
 * No database rollback needed for GIF picker
 * This is a frontend-only feature restoration
 * 
 * @param {Object} db - MongoDB database connection
 * @returns {Promise<Object>} Rollback result
 */
module.exports.down = async (db) => {
  console.log('[ROLLBACK] Restore GIF Picker');
  console.log('[INFO] This is a frontend-only feature. No database changes required.');
  console.log('');
  console.log('MANUAL STEPS REQUIRED:');
  console.log('1. Restore GifPicker.jsx and GifPicker.css from git history:');
  console.log('   git checkout <commit-before-removal> -- src/components/GifPicker.jsx');
  console.log('   git checkout <commit-before-removal> -- src/components/GifPicker.css');
  console.log('');
  console.log('2. Re-add imports to Feed.jsx:');
  console.log("   import GifPicker from '../components/GifPicker';");
  console.log('');
  console.log('3. Re-add state variables:');
  console.log('   const [showGifPicker, setShowGifPicker] = useState(null);');
  console.log('   const [commentGif, setCommentGif] = useState({});');
  console.log('');
  console.log('4. Re-add GIF button and picker component to UI');
  console.log('');
  console.log('[INFO] All existing GIF URLs should continue to work.');
  
  return { 
    dryRun: true, 
    modifiedCount: 0,
    manualStepsRequired: true 
  };
};

/**
 * Rollback metadata
 */
module.exports.meta = {
  name: 'restore_gif_picker',
  feature: 'GIF Picker (Tenor)',
  models: [],
  frontendComponents: [
    'src/components/GifPicker.jsx',
    'src/components/GifPicker.css'
  ],
  affectedComponents: [
    'src/pages/Feed.jsx'
  ],
  databaseRollback: false,
  createdAt: '2025-12-26',
  status: 'prepared'
};

