/**
 * Notification Delivery Service
 *
 * Schedules when a notification should be delivered based on its priority:
 *
 *   critical / high → 0ms delay  (immediate)
 *   normal          → 10s delay
 *   low             → 60s delay  (allows batch window to aggregate further)
 *
 * The delivery worker (notificationDeliveryJob.js) polls every 5 seconds
 * for notifications where  delivered = false  AND  deliveryScheduledAt <= now.
 */

import { getDeliveryDelayMs } from './notificationPriorityService.js';

/**
 * Compute deliveryScheduledAt for a notification.
 *
 * @param {string} priority - Notification priority level
 * @returns {Date} When the notification should be delivered
 */
export function scheduleDelivery(priority) {
  const delayMs = getDeliveryDelayMs(priority);
  return new Date(Date.now() + delayMs);
}

/**
 * Determine whether a notification should be delivered immediately
 * (i.e. the delivery delay is 0ms).
 *
 * @param {string} priority
 * @returns {boolean}
 */
export function isImmediateDelivery(priority) {
  return getDeliveryDelayMs(priority) === 0;
}
