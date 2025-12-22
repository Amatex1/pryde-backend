import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory
dotenv.config({ path: path.join(__dirname, '../.env') });

/**
 * Script to clear old embedded reactions from Posts and Comments
 * 
 * This should be run AFTER migrateReactions.js to clean up the old data
 * and prevent confusion with the new universal Reaction system.
 */

async function clearOldReactions() {
  try {
    console.log('🧹 Starting cleanup of old reaction fields...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // ========================================
    // CLEAR POST REACTIONS
    // ========================================
    console.log('📝 Clearing Post.reactions field...');
    const postResult = await Post.updateMany(
      { 'reactions.0': { $exists: true } },
      { $set: { reactions: [] } }
    );
    console.log(`✅ Cleared reactions from ${postResult.modifiedCount} posts\n`);

    // ========================================
    // CLEAR COMMENT REACTIONS
    // ========================================
    console.log('💬 Clearing Comment.reactions field...');
    const commentResult = await Comment.updateMany(
      { reactions: { $exists: true, $ne: {} } },
      { $set: { reactions: {} } }
    );
    console.log(`✅ Cleared reactions from ${commentResult.modifiedCount} comments\n`);

    // ========================================
    // SUMMARY
    // ========================================
    console.log('📊 Cleanup Summary:');
    console.log(`   Posts updated: ${postResult.modifiedCount}`);
    console.log(`   Comments updated: ${commentResult.modifiedCount}`);
    console.log('\n✅ Cleanup complete!\n');
    console.log('ℹ️  Old reactions have been cleared. The new Reaction collection is now the source of truth.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

clearOldReactions();

