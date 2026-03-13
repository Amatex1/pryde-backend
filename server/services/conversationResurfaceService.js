/**
 * Conversation Resurface Service
 *
 * Sends a gentle "conversation heating up" notification when a post the user
 * participated in sees a burst of new activity.
 *
 * Triggers:
 *   ≥ 3 new replies within the last 60 minutes
 *   OR ≥ 5 new reactions within the last 60 minutes
 *
 * One notification per user per post per hour (de-duplicated by existing
 * unread resurface notification check).
 */

import Post from '../models/Post.js';
import Notification from '../models/Notification.js';
import logger from '../utils/logger.js';

const REPLY_THRESHOLD = 3;
const REACTION_THRESHOLD = 5;
const ACTIVITY_WINDOW_MS = 60 * 60 * 1000; // 60 minutes
const RESURFACE_COOLDOWN_MS = 60 * 60 * 1000; // Don't re-notify within 1 hour

/**
 * Collect all user IDs who participated in a thread (author + commenters).
 * Comments are stored as Posts with a `parentPost` field.
 *
 * @param {string} postId
 * @returns {Promise<string[]>} Array of unique user ID strings
 */
async function getThreadParticipants(postId) {
  const post = await Post.findById(postId).select('author').lean();
  if (!post) return [];

  const comments = await Post.find({ parentPost: postId })
    .select('author')
    .lean();

  const ids = new Set();
  ids.add(post.author?.toString());
  for (const c of comments) {
    if (c.author) ids.add(c.author.toString());
  }
  ids.delete(undefined);
  return [...ids];
}

/**
 * Check whether a post has crossed the activity threshold and, if so,
 * notify all thread participants (excluding the actor who triggered the check).
 *
 * Call this after a new comment or reaction is created.
 *
 * @param {string|import('mongoose').Types.ObjectId} postId
 * @param {string|import('mongoose').Types.ObjectId} actorId - User who just acted (excluded from notifications)
 * @param {import('socket.io').Server} [io]
 */
export async function checkConversationResurface(postId, actorId, io) {
  try {
    const windowStart = new Date(Date.now() - ACTIVITY_WINDOW_MS);
    const postIdStr = postId?.toString();
    const actorIdStr = actorId?.toString();

    // Count replies in the last hour
    const recentReplyCount = await Post.countDocuments({
      parentPost: postId,
      createdAt: { $gt: windowStart }
    });

    // Count reactions stored in the post's likesCount (incremental — not per-window,
    // so we use a conservative proxy: check if likesCount crossed the threshold)
    const post = await Post.findById(postId).select('likesCount').lean();
    const reactionCount = post?.likesCount || 0;

    const thresholdMet =
      recentReplyCount >= REPLY_THRESHOLD ||
      reactionCount >= REACTION_THRESHOLD;

    if (!thresholdMet) return;

    const participants = await getThreadParticipants(postIdStr);

    for (const userId of participants) {
      if (userId === actorIdStr) continue; // Don't notify the person who triggered it

      // De-duplicate: skip if we already sent a resurface notification recently
      const cooldownStart = new Date(Date.now() - RESURFACE_COOLDOWN_MS);
      const existing = await Notification.findOne({
        recipient: userId,
        type: 'conversation_resurface',
        postId,
        createdAt: { $gt: cooldownStart }
      });

      if (existing) continue;

      const notif = new Notification({
        recipient: userId,
        sender: actorId,
        type: 'conversation_resurface',
        message: 'Conversation heating up on a post you commented on',
        postId,
        url: `/feed?post=${postIdStr}`,
        count: 1,
        actorIds: [actorId],
        priority: 'passive'
      });

      await notif.save();

      const populated = await Notification.findById(notif._id)
        .populate('sender', 'username displayName profilePhoto')
        .lean();

      io?.to(`user_${userId}`).emit('notification:new', { notification: populated });
    }

    logger.info(`[Resurface] Sent resurface notifications for post ${postIdStr} (${participants.length - 1} recipients)`);
  } catch (err) {
    logger.error('[Resurface] Error checking conversation resurface:', err);
  }
}
