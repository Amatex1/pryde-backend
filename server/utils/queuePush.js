/**
 * Smart Push Notification Queue Wrapper
 * 
 * Queues push notifications for async delivery when Redis available.
 * Falls back to synchronous delivery if queues disabled.
 * Prevents Render cold-start blocking on user actions.
 * 
 * Usage (replace direct sendPushNotification calls):
 *   await queuePush(userId, { title, body, data });
 * 
 * From: server/routes/pushNotifications.js
 */

import { getQueue, QUEUE_NAMES } from '../queues/index.js';
import { sendPushNotification } from '../routes/pushNotifications.js';
import logger from './logger.js';

const PUSH_QUEUE = getQueue(QUEUE_NAMES.PUSH);

export async function queuePush(userId, payload, options = {}) {
  const queueAvailable = PUSH_QUEUE.add !== undefined;

  if (queueAvailable) {
    // Async queue — non-blocking for user response
    await PUSH_QUEUE.add('send', {
      userId: userId.toString(),
      title: payload.title,
      body: payload.body,
      data: payload.data,
      options
    });
    logger.debug('[queuePush] Queued push for user', { userId });
    return { queued: true, message: 'Queued for delivery' };
  } else {
    // Sync fallback — immediate but may delay response
    logger.debug('[queuePush] Sync fallback (no Redis), user', { userId });
    const result = await sendPushNotification(userId, payload, options);
    return { ...result, queued: false };
  }
}

// Legacy alias for direct replacement
export const sendQueuedPush = queuePush;

export default { queuePush, sendQueuedPush };
