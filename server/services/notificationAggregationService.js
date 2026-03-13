/**
 * Notification Aggregation Service
 *
 * Merges repeated notifications of the same type on the same target
 * within a rolling 30-minute window instead of creating duplicates.
 *
 * Emits:
 *   notification:new    — first notification in an aggregate group
 *   notification:update — subsequent actors added to an existing group
 */

import Notification from '../models/Notification.js';
import logger from '../utils/logger.js';

// Types eligible for aggregation
const AGGREGATABLE_TYPES = new Set(['like', 'comment']);

// Rolling window for aggregation (30 minutes)
const AGGREGATE_WINDOW_MS = 30 * 60 * 1000;

/**
 * Build a deep-link URL for a notification.
 * Uses the app's existing query-param format so Feed.jsx scroll logic works.
 *
 * @param {string} type
 * @param {{ postId?: string, commentId?: string, actorId?: string }} ctx
 * @returns {string|null}
 */
export function buildNotificationUrl(type, { postId, commentId, actorId } = {}) {
  switch (type) {
    case 'like':
      if (postId && commentId) return `/feed?post=${postId}&comment=${commentId}`;
      if (postId) return `/feed?post=${postId}`;
      return null;

    case 'comment':
    case 'mention':
      if (postId && commentId) return `/feed?post=${postId}&comment=${commentId}`;
      if (postId) return `/feed?post=${postId}`;
      return null;

    case 'conversation_resurface':
      if (postId) return `/feed?post=${postId}`;
      return null;

    case 'friend_request':
    case 'friend_accept':
      return actorId ? `/profile/${actorId}` : null;

    default:
      return null;
  }
}

/**
 * Create a new notification or aggregate into an existing unread one.
 *
 * @param {object} params - Notification fields (recipient, sender, type, postId, commentId, message, …)
 * @param {import('socket.io').Server} [io] - Socket.IO server instance
 * @returns {Promise<{ notification: object, isNew: boolean }>}
 */
export async function createOrAggregateNotification(params, io) {
  const {
    recipient,
    sender,
    type,
    postId,
    commentId,
    message,
    ...rest
  } = params;

  const url = buildNotificationUrl(type, {
    postId: postId?.toString(),
    commentId: commentId?.toString(),
    actorId: sender?.toString()
  });

  // ── Aggregation check ───────────────────────────────────────────────────────
  if (AGGREGATABLE_TYPES.has(type)) {
    const windowStart = new Date(Date.now() - AGGREGATE_WINDOW_MS);

    const query = { recipient, type, read: false, createdAt: { $gt: windowStart } };
    if (postId) query.postId = postId;
    if (commentId) query.commentId = commentId;

    const existing = await Notification.findOne(query);

    if (existing) {
      const senderStr = sender?.toString();
      const alreadyAdded = existing.actorIds?.some(
        a => (a._id || a)?.toString() === senderStr
      );

      if (!alreadyAdded) {
        existing.actorIds.push(sender);
        existing.count = (existing.count || 0) + 1;
        existing.sender = sender; // most-recent actor
        existing.message = message;
        existing.updatedAt = new Date();
        await existing.save();

        const updated = await Notification.findById(existing._id)
          .populate('sender', 'username displayName profilePhoto')
          .populate('actorIds', 'username displayName profilePhoto')
          .lean();

        io?.to(`user_${recipient}`).emit('notification:update', updated);

        logger.info(`[NotifAggr] Aggregated ${type} for recipient ${recipient} (${existing.actorIds.length} actors)`);
        return { notification: updated, isNew: false };
      }

      // Same actor liked/commented again — silently skip duplicate
      logger.debug(`[NotifAggr] Skipping duplicate ${type} from same actor`);
      return { notification: existing, isNew: false };
    }
  }

  // ── Create new notification ─────────────────────────────────────────────────
  const notif = new Notification({
    recipient,
    sender,
    type,
    message,
    postId,
    commentId,
    url,
    count: 1,
    actorIds: sender ? [sender] : [],
    ...rest
  });

  await notif.save();

  const populated = await Notification.findById(notif._id)
    .populate('sender', 'username displayName profilePhoto')
    .populate('actorIds', 'username displayName profilePhoto')
    .lean();

  io?.to(`user_${recipient}`).emit('notification:new', { notification: populated });

  logger.info(`[NotifAggr] Created ${type} notification for recipient ${recipient}`);
  return { notification: populated, isNew: true };
}
