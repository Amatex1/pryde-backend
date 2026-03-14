/**
 * Distributed cron job lock using Redis.
 *
 * Prevents duplicate execution when multiple server instances are running.
 * Acquires a Redis key with a TTL; if the key already exists the job is skipped.
 *
 * Usage:
 *   import { withCronLock } from './cronLock.js';
 *   await withCronLock('weekly-digest', 3600, async () => { ... });
 */

import { getRedisClient, isRedisConnected } from './redisCache.js';
import logger from './logger.js';

/**
 * Run fn() only if the named lock can be acquired.
 *
 * @param {string} lockName  - Unique key for this job (e.g. 'weekly-digest')
 * @param {number} ttlSeconds - How long to hold the lock (should exceed max job duration)
 * @param {Function} fn       - Async function to run when lock is acquired
 * @returns {Promise<any>}    - Result of fn(), or null if lock was not acquired
 */
export async function withCronLock(lockName, ttlSeconds, fn) {
  if (!isRedisConnected()) {
    // No Redis — run without lock (single-instance fallback)
    logger.warn(`[CronLock] Redis not available, running ${lockName} without lock`);
    return fn();
  }

  const redis = getRedisClient();
  const key = `cron:lock:${lockName}`;

  // NX = only set if key does not exist (atomic acquire)
  const acquired = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');

  if (!acquired) {
    logger.info(`[CronLock] ${lockName} already running on another instance — skipping`);
    return null;
  }

  try {
    return await fn();
  } finally {
    // Release the lock so other instances can run after this one finishes
    await redis.del(key).catch(() => {});
  }
}
