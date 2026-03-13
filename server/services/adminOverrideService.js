/**
 * Admin Override Service
 *
 * Manages the two-stage verification flow for super_admin emergency overrides.
 *
 * Stage 1 — Request:
 *   generate6DigitCode() → store in Redis (key: override:{adminId}, TTL: 5 min)
 *   Rate limited: max 3 requests per admin per hour (key: override:rl:{adminId})
 *
 * Stage 2 — Confirm:
 *   validateOverrideCode(adminId, code) → returns stored payload or null
 *   consumeOverrideCode(adminId) → deletes the key (single-use)
 *
 * Redis is preferred. Falls back to an in-memory Map if Redis is unavailable
 * (not suitable for multi-node deployments but safe for single-instance).
 */

import { getRedisClient } from '../utils/redisCache.js';
import logger from '../utils/logger.js';

const OVERRIDE_TTL_S = 5 * 60;        // 5 minutes
const RATE_LIMIT_TTL_S = 60 * 60;     // 1 hour window
const RATE_LIMIT_MAX = 3;             // max requests per window

// In-memory fallback (used when Redis is unavailable)
const memStore = new Map();

// ─── Redis helpers (gracefully fall back to Map) ──────────────────────────────

async function redisSet(key, value, ttlSeconds) {
  const client = getRedisClient();
  if (client) {
    try {
      await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      return true;
    } catch (err) {
      logger.warn('[AdminOverride] Redis set failed, using fallback:', err.message);
    }
  }
  memStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  return false;
}

async function redisGet(key) {
  const client = getRedisClient();
  if (client) {
    try {
      const raw = await client.get(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      logger.warn('[AdminOverride] Redis get failed, using fallback:', err.message);
    }
  }
  const entry = memStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) { memStore.delete(key); return null; }
  return entry.value;
}

async function redisDel(key) {
  const client = getRedisClient();
  if (client) {
    try { await client.del(key); return; } catch (err) {
      logger.warn('[AdminOverride] Redis del failed:', err.message);
    }
  }
  memStore.delete(key);
}

async function redisIncr(key, ttlSeconds) {
  const client = getRedisClient();
  if (client) {
    try {
      const count = await client.incr(key);
      if (count === 1) await client.expire(key, ttlSeconds);
      return count;
    } catch (err) {
      logger.warn('[AdminOverride] Redis incr failed:', err.message);
    }
  }
  // Fallback: in-memory counter
  const entry = memStore.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    memStore.set(key, { value: 1, expiresAt: Date.now() + ttlSeconds * 1000 });
    return 1;
  }
  entry.value += 1;
  return entry.value;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Check and increment the rate limit for an admin.
 * @returns {Promise<{ allowed: boolean, remaining: number }>}
 */
export async function checkRateLimit(adminId) {
  const rlKey = `override:rl:${adminId}`;
  const count = await redisIncr(rlKey, RATE_LIMIT_TTL_S);
  return {
    allowed: count <= RATE_LIMIT_MAX,
    remaining: Math.max(0, RATE_LIMIT_MAX - count)
  };
}

/**
 * Generate and store a 6-digit override verification code.
 *
 * @param {string} adminId      - Mongo ObjectId string of the requesting admin
 * @param {string} action       - Override action being requested
 * @param {string} targetUserId - Mongo ObjectId string of the target user
 * @param {string} reason       - Written justification
 * @returns {Promise<string>}   - The 6-digit code (send via email)
 */
export async function generateOverrideCode(adminId, action, targetUserId, reason) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const key = `override:${adminId}`;

  await redisSet(key, {
    code,
    action,
    targetUserId: String(targetUserId),
    reason,
    expiresAt: Date.now() + OVERRIDE_TTL_S * 1000
  }, OVERRIDE_TTL_S);

  return code;
}

/**
 * Retrieve and validate a pending override code without consuming it.
 *
 * @param {string} adminId - Mongo ObjectId string of the requesting admin
 * @param {string} code    - The 6-digit code submitted by the admin
 * @returns {Promise<{ action, targetUserId, reason } | null>}
 */
export async function validateOverrideCode(adminId, code) {
  const key = `override:${adminId}`;
  const entry = await redisGet(key);

  if (!entry) return null;
  if (entry.code !== code) return null;
  if (entry.expiresAt <= Date.now()) {
    await redisDel(key);
    return null;
  }

  return { action: entry.action, targetUserId: entry.targetUserId, reason: entry.reason };
}

/**
 * Consume (delete) the pending override code for an admin. Call after execution.
 *
 * @param {string} adminId
 */
export async function consumeOverrideCode(adminId) {
  await redisDel(`override:${adminId}`);
}
