/**
 * Per-event Socket.IO rate limiter
 *
 * Uses Redis sorted sets (sliding window) when available.
 * Falls back to an in-memory Map if Redis is unavailable.
 *
 * Configured limits:
 *   send_message       5  / second / user
 *   global_message:send 5 / second / user
 *   typing             10 / second / user
 *   global_chat:typing 10 / second / user
 *   reaction           10 / second / user
 */

import logger from '../utils/logger.js';

/** @type {Map<string, number[]>} key → array of timestamp ms */
const inMemoryStore = new Map();

// Evict stale entries every 30 seconds to prevent unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of inMemoryStore.entries()) {
    // All limits use windows ≤ 1 second; safe to evict entries older than 2 seconds
    const fresh = timestamps.filter(t => t > now - 2000);
    if (fresh.length === 0) {
      inMemoryStore.delete(key);
    } else {
      inMemoryStore.set(key, fresh);
    }
  }
}, 30_000);

/**
 * Per-event rate limits  { max: number, windowMs: number }
 * windowMs: sliding window duration in milliseconds
 */
const LIMITS = {
  send_message:         { max: 5,  windowMs: 1000 },
  'global_message:send': { max: 5,  windowMs: 1000 },
  typing:               { max: 10, windowMs: 1000 },
  'global_chat:typing': { max: 10, windowMs: 1000 },
  reaction:             { max: 10, windowMs: 1000 }
};

/**
 * Check whether a user is allowed to emit an event.
 *
 * @param {string} userId
 * @param {string} eventName
 * @param {(() => object|null)|object|null} redisClientOrGetter - ioredis client, a getter function, or null
 * @returns {Promise<boolean>} true if allowed, false if rate-limited
 */
export async function checkEventRate(userId, eventName, redisClientOrGetter = null) {
  const redisClient = typeof redisClientOrGetter === 'function'
    ? redisClientOrGetter()
    : redisClientOrGetter;
  const limit = LIMITS[eventName];
  if (!limit) return true; // No limit configured — allow

  const now = Date.now();
  const windowStart = now - limit.windowMs;

  if (redisClient) {
    return _checkRedis(userId, eventName, limit, now, windowStart, redisClient);
  }
  return _checkMemory(userId, eventName, limit, now, windowStart);
}

function _checkMemory(userId, eventName, limit, now, windowStart) {
  const key = `${userId}|${eventName}`;
  let timestamps = inMemoryStore.get(key) || [];
  timestamps = timestamps.filter(t => t > windowStart);

  if (timestamps.length >= limit.max) {
    logger.debug(`Socket rate limit hit: user=${userId} event=${eventName}`);
    return false;
  }

  timestamps.push(now);
  inMemoryStore.set(key, timestamps);
  return true;
}

async function _checkRedis(userId, eventName, limit, now, windowStart, redisClient) {
  try {
    const key = `srl:${userId}|${eventName}`;
    const pipeline = redisClient.pipeline();
    pipeline.zremrangebyscore(key, '-inf', windowStart);
    pipeline.zadd(key, now, String(now));
    pipeline.zcard(key);
    pipeline.pexpire(key, limit.windowMs + 100); // Auto-expire slightly after window
    const results = await pipeline.exec();
    const count = results[2][1]; // result of ZCARD
    if (count > limit.max) {
      logger.debug(`Socket rate limit hit (Redis): user=${userId} event=${eventName}`);
      return false;
    }
    return true;
  } catch (err) {
    // Redis error — fail open (allow the request)
    logger.warn('Socket rate limiter Redis error, allowing request:', err.message);
    return true;
  }
}
