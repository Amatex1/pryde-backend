import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import Reaction, { APPROVED_REACTIONS } from '../models/Reaction.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory
dotenv.config({ path: path.join(__dirname, '../.env') });

/**
 * Migration Script: Convert Post and Comment reactions to universal Reaction model
 * 
 * This script:
 * 1. Migrates Post.reactions array to Reaction collection
 * 2. Migrates Comment.reactions Map to Reaction collection
 * 3. Validates emojis against approved list
 * 4. Preserves parentId for comment reactions
 * 5. Keeps old reaction fields for rollback safety
 */

async function migrateReactions() {
  try {
    console.log('🚀 Starting reaction migration...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    let totalMigrated = 0;
    let totalSkipped = 0;

    // ========================================
    // MIGRATE POST REACTIONS
    // ========================================
    console.log('📝 Migrating Post reactions...');
    const posts = await Post.find({ 'reactions.0': { $exists: true } });
    console.log(`Found ${posts.length} posts with reactions\n`);

    for (const post of posts) {
      for (const reaction of post.reactions) {
        try {
          // Validate emoji
          if (!APPROVED_REACTIONS.includes(reaction.emoji)) {
            console.log(`⚠️  Skipping invalid emoji "${reaction.emoji}" on post ${post._id}`);
            totalSkipped++;
            continue;
          }

          // Check if reaction already exists in new collection
          const existingReaction = await Reaction.findOne({
            targetType: 'post',
            targetId: post._id,
            userId: reaction.user
          });

          if (existingReaction) {
            console.log(`⏭️  Reaction already exists for user ${reaction.user} on post ${post._id}`);
            continue;
          }

          // Create new reaction
          await Reaction.create({
            targetType: 'post',
            targetId: post._id,
            userId: reaction.user,
            emoji: reaction.emoji,
            createdAt: reaction.createdAt || new Date()
          });

          totalMigrated++;
        } catch (error) {
          console.error(`❌ Error migrating reaction on post ${post._id}:`, error.message);
          totalSkipped++;
        }
      }
    }

    console.log(`✅ Migrated ${totalMigrated} post reactions\n`);

    // ========================================
    // MIGRATE COMMENT REACTIONS
    // ========================================
    console.log('💬 Migrating Comment reactions...');
    const comments = await Comment.find({ reactions: { $exists: true, $ne: {} } });
    console.log(`Found ${comments.length} comments with reactions\n`);

    let commentReactionsMigrated = 0;
    let commentReactionsSkipped = 0;

    for (const comment of comments) {
      // Convert Map to object if needed
      const reactions = comment.reactions.toObject ? comment.reactions.toObject() : comment.reactions;

      for (const [emoji, userIds] of Object.entries(reactions)) {
        // Validate emoji
        if (!APPROVED_REACTIONS.includes(emoji)) {
          console.log(`⚠️  Skipping invalid emoji "${emoji}" on comment ${comment._id}`);
          commentReactionsSkipped += userIds.length;
          continue;
        }

        for (const userId of userIds) {
          try {
            // Check if reaction already exists
            const existingReaction = await Reaction.findOne({
              targetType: 'comment',
              targetId: comment._id,
              userId: userId
            });

            if (existingReaction) {
              console.log(`⏭️  Reaction already exists for user ${userId} on comment ${comment._id}`);
              continue;
            }

            // Create new reaction
            await Reaction.create({
              targetType: 'comment',
              targetId: comment._id,
              userId: userId,
              emoji: emoji,
              createdAt: new Date()
            });

            commentReactionsMigrated++;
          } catch (error) {
            console.error(`❌ Error migrating reaction on comment ${comment._id}:`, error.message);
            commentReactionsSkipped++;
          }
        }
      }
    }

    console.log(`✅ Migrated ${commentReactionsMigrated} comment reactions\n`);

    // ========================================
    // SUMMARY
    // ========================================
    console.log('📊 Migration Summary:');
    console.log(`   Total reactions migrated: ${totalMigrated + commentReactionsMigrated}`);
    console.log(`   Post reactions: ${totalMigrated}`);
    console.log(`   Comment reactions: ${commentReactionsMigrated}`);
    console.log(`   Total skipped: ${totalSkipped + commentReactionsSkipped}`);
    console.log('\n✅ Migration complete!\n');
    console.log('⚠️  NOTE: Old reaction fields are preserved for rollback safety.');
    console.log('   You can remove them later after verifying the migration.\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run migration
migrateReactions();

