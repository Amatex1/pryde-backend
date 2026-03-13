/**
 * Notification Batch Service
 *
 * Coalesces rapid-fire events of the same type on the same target into a
 * single aggregated notification, preventing notification spam.
 *
 * Strategy:
 *   - Events are queued in memory keyed by  `${userId}:${type}:${postId}`
 *   - A 15-second timer starts on the first event in a group
 *   - When the timer fires, one notification is created for all queued actors
 *   - batchId links all notifications that were merged in the same window
 *
 * For critical/high-priority types (mentions, moderation) batching is skipped
 * and the notification is created immediately.
 */

import { randomUUID } from 'crypto';
import Notification from '../models/Notification.js';
import { getNotificationPriority, getDeliveryDelayMs } from './notificationPriorityService.js';
import { getEngagementScore } from './notificationScoreService.js';
import { buildNotificationUrl } from './notificationAggregationService.js';
import logger from '../utils/logger.js';

// Batch window in milliseconds
const BATCH_WINDOW_MS = 15_000;

// In-memory batch queue
// Key:   `${recipientId}:${type}:${postId|''}`
// Value: { batchId, recipients: [], timer, params[] }
const batchQueue = new Map();

/**
 * Types that bypass batching and are delivered immediately.
 */
const SKIP_BATCH_TYPES = new Set([
  'mention', 'group_mention', 'friend_request', 'friend_accept',
  'login_approval', 'system', 'moderation', 'announcement', 'circle_invite'
]);

/**
 * Queue a notification event for batching or pass it straight through.
 *
 * @param {object} params
 * @param {string|import('mongoose').Types.ObjectId} params.recipient
 * @param {string|import('mongoose').Types.ObjectId} params.sender
 * @param {string} params.type
 * @param {string|import('mongoose').Types.ObjectId} [params.postId]
 * @param {string|import('mongoose').Types.ObjectId} [params.commentId]
 * @param {string} params.message
 * @param {import('socket.io').Server} [io]
 * @returns {Promise<void>}
 */
export async function queueNotification(params, io) {
  const { recipient, sender, type, postId } = params;

  // High-priority types skip the batch window entirely
  if (SKIP_BATCH_TYPES.has(type)) {
    return flushBatch([params], io);
  }

  const key = `${recipient}:${type}:${postId || ''}`;

  if (batchQueue.has(key)) {
    // Add actor to existing batch
    const entry = batchQueue.get(key);
    entry.params.push(params);
    logger.debug(`[BatchService] Queued ${type} for ${recipient} (batch size: ${entry.params.length})`);
    return;
  }

  // Start a new batch window
  const batchId = randomUUID();
  const timer = setTimeout(async () => {
    const entry = batchQueue.get(key);
    batchQueue.delete(key);
    if (entry) await flushBatch(entry.params, io, entry.batchId);
  }, BATCH_WINDOW_MS);

  batchQueue.set(key, { batchId, params: [params], timer });
  logger.debug(`[BatchService] Started batch window for ${type} → ${recipient}`);
}

/**
 * Flush a batch: create one aggregated notification for all queued params.
 *
 * @param {object[]} paramsList
 * @param {import('socket.io').Server} [io]
 * @param {string} [batchId]
 */
async function flushBatch(paramsList, io, batchId) {
  if (paramsList.length === 0) return;

  // Use the first event's context as the canonical notification
  const base = paramsList[0];
  const { recipient, type, postId, commentId } = base;

  // Collect unique actors from the batch
  const actorIds = [...new Set(
    paramsList.map(p => p.sender?.toString()).filter(Boolean)
  )];
  const count = actorIds.length;

  const priority = getNotificationPriority(type);
  const engagementScore = getEngagementScore(type, count);
  const url = buildNotificationUrl(type, {
    postId: postId?.toString(),
    commentId: commentId?.toString(),
    actorId: actorIds[0]
  });
  const deliveryDelay = getDeliveryDelayMs(priority);
  const deliveryScheduledAt = new Date(Date.now() + deliveryDelay);

  // Build the display message
  const message = count > 1 ? base.message : base.message;

  try {
    const notif = new Notification({
      recipient,
      sender: actorIds[0],
      type,
      message,
      postId,
      commentId,
      url,
      count,
      actorIds,
      priority,
      engagementScore,
      batchId: batchId || randomUUID(),
      delivered: false,
      deliveryScheduledAt,
      ...Object.fromEntries(
        Object.entries(base).filter(([k]) =>
          !['recipient','sender','type','message','postId','commentId'].includes(k)
        )
      )
    });

    await notif.save();

    const populated = await Notification.findById(notif._id)
      .populate('sender', 'username displayName profilePhoto')
      .populate('actorIds', 'username displayName profilePhoto')
      .lean();

    // Immediate delivery for critical/high; deferred for normal/low (handled by job)
    if (deliveryDelay === 0) {
      io?.to(`user_${recipient}`).emit('notification:new', { notification: populated });
      await Notification.findByIdAndUpdate(notif._id, { delivered: true });
    }

    logger.info(`[BatchService] Flushed batch: ${type} → ${recipient} (${count} actors, delay: ${deliveryDelay}ms)`);
  } catch (err) {
    logger.error('[BatchService] Failed to flush batch:', err);
  }
}

/**
 * Flush all pending batches immediately (e.g. on shutdown).
 * @param {import('socket.io').Server} [io]
 */
export async function flushAllPending(io) {
  for (const [key, entry] of batchQueue.entries()) {
    clearTimeout(entry.timer);
    batchQueue.delete(key);
    await flushBatch(entry.params, io, entry.batchId);
  }
}
