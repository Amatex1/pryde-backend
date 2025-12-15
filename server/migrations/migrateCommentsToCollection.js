import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';

dotenv.config();

/**
 * Migration Script: Move comments from Post.comments array to Comment collection
 * 
 * This script:
 * 1. Finds all posts with embedded comments
 * 2. Creates Comment documents for each embedded comment
 * 3. Preserves all comment data (content, reactions, timestamps, etc.)
 * 4. Optionally clears the old Post.comments array after migration
 */

const migrateComments = async () => {
  try {
    console.log('🔄 Starting comment migration...');
    console.log('📊 Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all posts that have comments
    const postsWithComments = await Post.find({ 
      'comments.0': { $exists: true } // Only posts with at least one comment
    });

    console.log(`📝 Found ${postsWithComments.length} posts with embedded comments`);

    let totalCommentsMigrated = 0;
    let totalRepliesMigrated = 0;

    for (const post of postsWithComments) {
      console.log(`\n📄 Processing post ${post._id} (${post.comments.length} comments)`);

      // Map to track old comment IDs to new Comment document IDs
      const commentIdMap = new Map();

      // First pass: Create top-level comments
      for (const oldComment of post.comments) {
        // Skip if this is a reply (has parentComment)
        if (oldComment.parentComment) continue;

        // Check if comment already migrated
        const existing = await Comment.findOne({
          postId: post._id,
          authorId: oldComment.user,
          content: oldComment.content,
          createdAt: oldComment.createdAt
        });

        if (existing) {
          console.log(`  ⏭️  Comment ${oldComment._id} already migrated, skipping...`);
          commentIdMap.set(oldComment._id.toString(), existing._id);
          continue;
        }

        // Convert old reactions format to new format
        const reactions = {};
        if (oldComment.reactions && oldComment.reactions.length > 0) {
          oldComment.reactions.forEach(reaction => {
            if (!reactions[reaction.emoji]) {
              reactions[reaction.emoji] = [];
            }
            reactions[reaction.emoji].push(reaction.user.toString());
          });
        }

        // Create new Comment document
        const newComment = new Comment({
          postId: post._id,
          authorId: oldComment.user,
          content: oldComment.content || '',
          gifUrl: oldComment.gifUrl || null,
          parentCommentId: null, // Top-level comment
          reactions: reactions,
          isEdited: oldComment.edited || false,
          editedAt: oldComment.editedAt || null,
          createdAt: oldComment.createdAt,
          updatedAt: oldComment.createdAt
        });

        await newComment.save();
        commentIdMap.set(oldComment._id.toString(), newComment._id);
        totalCommentsMigrated++;
        console.log(`  ✅ Migrated top-level comment ${oldComment._id} -> ${newComment._id}`);
      }

      // Second pass: Create replies
      for (const oldComment of post.comments) {
        // Only process replies
        if (!oldComment.parentComment) continue;

        // Check if reply already migrated
        const existing = await Comment.findOne({
          postId: post._id,
          authorId: oldComment.user,
          content: oldComment.content,
          createdAt: oldComment.createdAt
        });

        if (existing) {
          console.log(`  ⏭️  Reply ${oldComment._id} already migrated, skipping...`);
          continue;
        }

        // Get the new parent comment ID
        const newParentId = commentIdMap.get(oldComment.parentComment.toString());
        if (!newParentId) {
          console.log(`  ⚠️  Parent comment not found for reply ${oldComment._id}, skipping...`);
          continue;
        }

        // Convert old reactions format to new format
        const reactions = {};
        if (oldComment.reactions && oldComment.reactions.length > 0) {
          oldComment.reactions.forEach(reaction => {
            if (!reactions[reaction.emoji]) {
              reactions[reaction.emoji] = [];
            }
            reactions[reaction.emoji].push(reaction.user.toString());
          });
        }

        // Create new Comment document for reply
        const newReply = new Comment({
          postId: post._id,
          authorId: oldComment.user,
          content: oldComment.content || '',
          gifUrl: oldComment.gifUrl || null,
          parentCommentId: newParentId,
          reactions: reactions,
          isEdited: oldComment.edited || false,
          editedAt: oldComment.editedAt || null,
          createdAt: oldComment.createdAt,
          updatedAt: oldComment.createdAt
        });

        await newReply.save();
        totalRepliesMigrated++;
        console.log(`  ✅ Migrated reply ${oldComment._id} -> ${newReply._id}`);
      }
    }

    console.log('\n✅ Migration complete!');
    console.log(`📊 Total comments migrated: ${totalCommentsMigrated}`);
    console.log(`📊 Total replies migrated: ${totalRepliesMigrated}`);
    console.log(`📊 Total: ${totalCommentsMigrated + totalRepliesMigrated}`);
    
    console.log('\n⚠️  Old comments are still in Post.comments array');
    console.log('   Run with --clear flag to remove them after verifying migration');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('👋 Disconnected from MongoDB');
  }
};

// Run migration
migrateComments();

