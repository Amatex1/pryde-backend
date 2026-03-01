/**
 * Anonymous Burst Cooldown Limiter
 *
 * Limits anonymous posts/replies to ANON_BURST_LIMIT per ANON_BURST_WINDOW seconds.
 * Applies a cooldown once exceeded. Does NOT increment strikes.
 * Fail-open: if Redis is unavailable, posts are allowed through.
 *
 * Key format: anonburst:<userId>
 * Window:     ANON_BURST_WINDOW seconds (default 1800 = 30 min)
 * Limit:      ANON_BURST_LIMIT (default 10), ANON_BURST_LIMIT_MOD for moderators (default 20)
 */

import { createLogger } from './logger.js';
import config from '../config/config.js';

const logger = createLogger('anonymousBurstLimiter');

// ── Config (env-overridable) ──────────────────────────────────────────────────
const ANON_BURST_LIMIT     = parseInt(process.env.ANON_BURST_LIMIT     || '10',   10);
const ANON_BURST_WINDOW    = parseInt(process.env.ANON_BURST_WINDOW    || '1800', 10);
const ANON_BURST_LIMIT_MOD = parseInt(process.env.ANON_BURST_LIMIT_MOD || '20',   10);

// ── Role sets ─────────────────────────────────────────────────────────────────
// Exempt roles bypass the limiter entirely
const EXEMPT_ROLES = new Set(['admin', 'super_admin']);
// Elevated roles get a higher threshold instead of the default
const ELEVATED_ROLES = new Set(['moderator']);

// ── Lua script ────────────────────────────────────────────────────────────────
// Atomically INCR and set EXPIRE only on the first increment.
// This guarantees TTL is never reset on subsequent increments.
const LUA_INCR_EXPIRE = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
`;

// ── Redis singleton ───────────────────────────────────────────────────────────
let _redisPromise = null;

function getRedis() {
  if (_redisPromise) return _redisPromise;

  _redisPromise = (async () => {
    const redisUrl   = process.env.REDIS_URL;
    const isValidUrl = redisUrl && /^rediss?:\/\//i.test(redisUrl);
    const hasHostPort = config.redis?.host && config.redis?.port;

    if (!isValidUrl && !hasHostPort) {
      logger.warn('anonymousBurstLimiter: Redis not configured — fail-open mode active');
      return null;
    }

    try {
      const { default: Redis } = await import('ioredis');
      let client;
      if (isValidUrl) {
        client = new Redis(redisUrl, { enableOfflineQueue: false, lazyConnect: true });
      } else {
        client = new Redis({
          host:               config.redis.host,
          port:               config.redis.port,
          password:           config.redis.password || undefined,
          tls:                config.redis.tls,
          enableOfflineQueue: false,
          lazyConnect:        true,
        });
      }

      await client.connect();
      client.on('error', (err) => {
        logger.warn('anonymousBurstLimiter: Redis error', { message: err.message });
      });

      logger.warn('anonymousBurstLimiter: Redis connected');
      return client;
    } catch (err) {
      logger.warn('anonymousBurstLimiter: Redis connection failed — fail-open mode active', { message: err.message });
      // Reset so the next call retries
      _redisPromise = null;
      return null;
    }
  })();

  return _redisPromise;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Check whether a user may make another anonymous post/reply right now.
 *
 * @param {string} userId
 * @param {string} [userRole='user'] - The user's role from the database
 * @returns {Promise<{ allowed: boolean, retryAfterSeconds?: number }>}
 */
export async function checkAnonBurst(userId, userRole = 'user') {
  // Staff bypass — skip limiter entirely
  if (EXEMPT_ROLES.has(userRole)) {
    return { allowed: true };
  }

  const limit = ELEVATED_ROLES.has(userRole) ? ANON_BURST_LIMIT_MOD : ANON_BURST_LIMIT;
  const key   = `anonburst:${userId}`;

  let client;
  try {
    client = await getRedis();
  } catch (err) {
    logger.warn('anonymousBurstLimiter: could not obtain Redis client — fail-open', { userId });
    return { allowed: true };
  }

  // No Redis available — fail-open
  if (!client) {
    return { allowed: true };
  }

  try {
    // Atomic increment + conditional TTL (Lua ensures TTL is never reset)
    const count = await client.eval(LUA_INCR_EXPIRE, 1, key, String(ANON_BURST_WINDOW));

    if (count > limit) {
      const ttl = await client.ttl(key);
      const retryAfterSeconds = ttl > 0 ? ttl : ANON_BURST_WINDOW;

      logger.warn('Anonymous burst cooldown triggered', {
        type:          'anonymous_burst_cooldown',
        userId,
        count,
        limit,
        windowSeconds: ANON_BURST_WINDOW,
        timestamp:     new Date().toISOString(),
      });

      return { allowed: false, retryAfterSeconds };
    }

    return { allowed: true };
  } catch (err) {
    // Fail-open: Redis operation error
    logger.warn('anonymousBurstLimiter: Redis operation failed — fail-open', {
      userId,
      message: err.message,
    });
    return { allowed: true };
  }
}
