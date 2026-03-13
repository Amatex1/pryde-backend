/**
 * Admin Confirm Token Service
 *
 * Provides a two-step preview → confirm flow for destructive admin actions.
 *
 * Flow:
 *   1. POST /api/admin/actions/preview  — admin describes the action they want to take
 *   2. Server validates & returns a short-lived confirm token (60s TTL, single-use)
 *   3. Frontend shows confirmation modal (requires typing "CONFIRM")
 *   4. POST /api/admin/actions/confirm  — submit token + confirmation text
 *   5. Server consumes token and executes the action
 *
 * Token storage: in-memory Map (single-instance; swap to Redis for multi-node)
 */

import crypto from 'crypto';

// token → { adminId, action, targetId, payload, expiresAt }
const tokenStore = new Map();

const TOKEN_TTL_MS = 60 * 1000; // 60 seconds

// Prune expired tokens periodically to avoid memory leak
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of tokenStore) {
    if (entry.expiresAt <= now) tokenStore.delete(token);
  }
}, 30 * 1000);

/**
 * Generate a preview confirm token.
 *
 * @param {string} adminId   - Mongo ObjectId string of the acting admin
 * @param {string} action    - Action name (e.g. 'BAN_USER')
 * @param {string} targetId  - Mongo ObjectId string of the target user/resource
 * @param {Object} payload   - Any extra data the confirm step needs to re-validate
 * @returns {{ token: string, expiresAt: number }}
 */
export function generatePreviewToken(adminId, action, targetId, payload = {}) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + TOKEN_TTL_MS;

  tokenStore.set(token, {
    adminId: String(adminId),
    action,
    targetId: String(targetId),
    payload,
    expiresAt
  });

  return { token, expiresAt };
}

/**
 * Consume a confirm token (single-use).
 *
 * @param {string} token    - Token from the preview response
 * @param {string} adminId  - Must match the admin who generated the token
 * @returns {{ action: string, targetId: string, payload: Object }} or throws
 */
export function consumePreviewToken(token, adminId) {
  const entry = tokenStore.get(token);

  if (!entry) {
    throw new Error('Invalid or expired confirm token.');
  }

  if (entry.expiresAt <= Date.now()) {
    tokenStore.delete(token);
    throw new Error('Confirm token has expired. Please start the action again.');
  }

  if (entry.adminId !== String(adminId)) {
    throw new Error('Confirm token was issued to a different admin session.');
  }

  tokenStore.delete(token); // single-use

  return {
    action: entry.action,
    targetId: entry.targetId,
    payload: entry.payload
  };
}
