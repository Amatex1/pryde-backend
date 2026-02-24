/**
 * Permanent Account Deletion Job
 *
 * Runs daily. Finds soft-deleted accounts whose recovery window has expired
 * (deletionScheduledFor < now) and permanently removes their data.
 *
 * Data handling:
 * - User document:        permanently deleted
 * - Posts / Comments:     permanently deleted
 * - DM messages:          sender anonymised (null userId, name → "Deleted User")
 * - Push subscriptions:   removed via User document deletion
 * - Friend/follower refs: already removed at soft-delete time
 * - Sessions / tokens:    already cleared at soft-delete time
 *
 * This job is idempotent and safe to run multiple times.
 * It does NOT auto-create anything. It only removes expired data.
 */

import mongoose from 'mongoose';
import User from '../server/models/User.js';
import logger from '../server/utils/logger.js';

const MODELS = {
  Post: null,
  Comment: null,
  Message: null,
};

async function loadModels() {
  const { default: Post } = await import('../server/models/Post.js').catch(() => ({ default: null }));
  const { default: Comment } = await import('../server/models/Comment.js').catch(() => ({ default: null }));
  const { default: Message } = await import('../server/models/Message.js').catch(() => ({ default: null }));
  MODELS.Post = Post;
  MODELS.Comment = Comment;
  MODELS.Message = Message;
}

export async function runPermanentDeletionJob() {
  const now = new Date();

  // Find all accounts whose soft-delete recovery window has expired
  const expiredAccounts = await User.find({
    isDeleted: true,
    deletionScheduledFor: { $lt: now },
  }).select('_id username').lean();

  if (expiredAccounts.length === 0) {
    logger.info('[PermanentDeletion] No expired accounts found.');
    return { deleted: 0 };
  }

  logger.info(`[PermanentDeletion] Found ${expiredAccounts.length} accounts to permanently delete`);

  const userIds = expiredAccounts.map(u => u._id);
  let deleted = 0;

  for (const account of expiredAccounts) {
    try {
      const userId = account._id;

      // 1. Delete posts authored by this user (bulk)
      if (MODELS.Post) {
        const postResult = await MODELS.Post.deleteMany({ author: userId });
        logger.info(`[PermanentDeletion] Deleted ${postResult.deletedCount} posts for user ${userId}`);
      }

      // 2. Delete comments authored by this user (bulk)
      if (MODELS.Comment) {
        const commentResult = await MODELS.Comment.deleteMany({ author: userId });
        logger.info(`[PermanentDeletion] Deleted ${commentResult.deletedCount} comments for user ${userId}`);
      }

      // 3. Anonymise DM messages — preserve thread, replace sender identity
      if (MODELS.Message) {
        await MODELS.Message.updateMany(
          { sender: userId },
          {
            $set: {
              sender: null,
              senderName: 'Deleted User',
              isAnonymised: true,
            },
          }
        );
      }

      // 4. Permanently delete the user document
      await User.deleteOne({ _id: userId });

      logger.info(`[PermanentDeletion] ✅ Permanently deleted user ${userId}`);
      deleted++;
    } catch (err) {
      // Log and continue — don't let one failure block others
      logger.error(`[PermanentDeletion] ❌ Failed to delete user ${account._id}:`, err);
    }
  }

  logger.info(`[PermanentDeletion] Complete — ${deleted}/${expiredAccounts.length} accounts permanently deleted`);
  return { deleted, total: expiredAccounts.length };
}

// Standalone execution: node scripts/permanentDeletionJob.js
if (process.argv[1].endsWith('permanentDeletionJob.js')) {
  import('dotenv').then(({ default: dotenv }) => dotenv.config());

  const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URL;
  if (!mongoURI) {
    console.error('❌ MONGODB_URI environment variable is required');
    process.exit(1);
  }

  mongoose.connect(mongoURI)
    .then(() => loadModels())
    .then(() => runPermanentDeletionJob())
    .then(result => {
      console.log('✅ Permanent deletion job complete:', result);
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Job failed:', err);
      process.exit(1);
    });
}
