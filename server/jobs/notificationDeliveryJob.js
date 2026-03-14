/**
 * Notification Delivery Job
 *
 * Polls every 5 seconds for notifications that are:
 *   - not yet delivered  (delivered = false)
 *   - past their scheduled delivery time  (deliveryScheduledAt <= now)
 *
 * Emits  notification:new  via WebSocket and marks  delivered = true.
 *
 * Usage (call once after socket.io is initialized):
 *
 *   import { startDeliveryJob } from './jobs/notificationDeliveryJob.js';
 *   startDeliveryJob(io);
 */

import Notification from '../models/Notification.js';
import logger from '../utils/logger.js';

const POLL_INTERVAL_MS = 5_000;
const BATCH_LIMIT = 100; // max notifications to process per tick

let _interval = null;

/**
 * Process one tick: find and emit all due notifications.
 * @param {import('socket.io').Server} io
 */
async function processTick(io) {
  try {
    const now = new Date();

    // IDEMPOTENT: Only notifications not processed in last run (TASK #7)
    const due = await Notification.find({
      delivered: false,
      deliveryScheduledAt: { $lte: now },
      lastProcessedAttempt: { $lt: new Date(now.getTime() - 60000) } // Skip recent attempts
    })
      .populate('sender', 'username displayName profilePhoto')
      .populate('actorIds', 'username displayName profilePhoto')
      .limit(BATCH_LIMIT)
      .lean();

    if (due.length === 0) return;

    // IDEMPOTENT: Mark delivered + timestamp
    const ids = due.map(n => n._id);
    await Notification.updateMany(
      { _id: { $in: ids } },
      { 
        $set: { 
          delivered: true,
          lastProcessedAt: now,
          lastProcessedAttempt: now 
        }
      }
    );

    for (const notif of due) {
      io.to(`user_${notif.recipient}`).emit('notification:new', { notification: notif });
    }

    logger.info(`[DeliveryJob] Delivered ${due.length} notifications (idempotent)`);
  } catch (err) {
    logger.error('[DeliveryJob] Tick error:', err);
  }
}

/**
 * Start the delivery polling job.
 * Safe to call multiple times — only one interval will run.
 *
 * @param {import('socket.io').Server} io
 */
export function startDeliveryJob(io) {
  if (_interval) return;

  _interval = setInterval(() => processTick(io), POLL_INTERVAL_MS);
  // Unref so the interval doesn't prevent process exit in tests
  if (_interval.unref) _interval.unref();

  logger.info('[DeliveryJob] Notification delivery job started (every 5s)');
}

/**
 * Stop the delivery job (useful in tests / graceful shutdown).
 */
export function stopDeliveryJob() {
  if (_interval) {
    clearInterval(_interval);
    _interval = null;
    logger.info('[DeliveryJob] Notification delivery job stopped');
  }
}

/** Manual trigger for testing */
export { processTick as runDeliveryTick };
