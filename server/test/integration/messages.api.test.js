/**
 * Messages API Integration Tests
 *
 * Tests the HTTP layer for /api/messages — send, fetch, IDOR protection,
 * mark-read, and delete. NODE_ENV=test (set by test/setup.js) bypasses
 * rate limiting so all requests go through.
 *
 * Requires: MONGODB_URI_TEST or MONGODB_URI env var pointing to a test DB.
 */

import { describe, it, before, after } from 'mocha';
import { strict as assert } from 'assert';
import request from 'supertest';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });

const TEST_DB_URI = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI;

function skipWithoutDb(ctx) {
  if (!TEST_DB_URI) ctx.skip();
}

let app;
let tokenA, tokenB, tokenC;
let userAId, userBId;
let sentMessageId;

const stamp = Date.now();
const USER_A = { username: `msg_a_${stamp}`, email: `msg_a_${stamp}@test.pryde`, password: 'TestPass123!@#', fullName: 'Msg User A', displayName: 'Msg User A', birthday: '1990-01-01' };
const USER_B = { username: `msg_b_${stamp}`, email: `msg_b_${stamp}@test.pryde`, password: 'TestPass123!@#', fullName: 'Msg User B', displayName: 'Msg User B', birthday: '1990-01-01' };
const USER_C = { username: `msg_c_${stamp}`, email: `msg_c_${stamp}@test.pryde`, password: 'TestPass123!@#', fullName: 'Msg User C', displayName: 'Msg User C', birthday: '1990-01-01' };

async function registerAndLogin(userData) {
  const signupRes = await request(app).post('/api/auth/signup').send(userData);
  if (![200, 201].includes(signupRes.status)) {
    throw new Error(`Signup failed for ${userData.email}: ${JSON.stringify(signupRes.body)}`);
  }

  const User = (await import('../../models/User.js')).default;
  await User.updateOne({ email: userData.email }, { $set: { emailVerified: true, emailVerificationToken: null } });

  const loginRes = await request(app).post('/api/auth/login').send({ email: userData.email, password: userData.password });
  const token = loginRes.body.token || loginRes.body.accessToken;
  const userId = loginRes.body.user?._id || loginRes.body._id;
  assert.ok(token, `Login failed for ${userData.email}`);
  return { token, userId };
}

describe('Messages API (/api/messages)', function () {
  this.timeout(30000);

  before(async function () {
    if (!TEST_DB_URI) return;
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
    const mod = await import('../../server.js');
    app = mod.default || mod.app;

    ({ token: tokenA, userId: userAId } = await registerAndLogin(USER_A));
    ({ token: tokenB, userId: userBId } = await registerAndLogin(USER_B));
    ({ token: tokenC } = await registerAndLogin(USER_C));

    // checkMessagingPermission requires A to follow B before DMing
    await request(app).post(`/api/follow/${userBId}`).set('Authorization', `Bearer ${tokenA}`);
  });

  after(async function () {
    if (mongoose.connection.readyState === 1) {
      const User = (await import('../../models/User.js')).default;
      const Message = (await import('../../models/Message.js')).default;
      await Message.deleteMany({ sender: { $in: [userAId, userBId] } }).catch(() => {});
      await User.deleteMany({ email: { $in: [USER_A.email, USER_B.email, USER_C.email] } }).catch(() => {});
    }
  });

  // ── Auth guard ──────────────────────────────────────────────────────────────
  describe('Auth protection', function () {
    it('rejects unauthenticated GET /api/messages', async function () {
      skipWithoutDb(this);
      const res = await request(app).get('/api/messages');
      assert.ok([401, 403].includes(res.status), `Expected 401/403, got ${res.status}`);
    });

    it('rejects unauthenticated POST /api/messages', async function () {
      skipWithoutDb(this);
      const res = await request(app).post('/api/messages').send({ recipient: userBId, content: 'hi' });
      assert.ok([401, 403].includes(res.status), `Expected 401/403, got ${res.status}`);
    });
  });

  // ── Send message ───────────────────────────────────────────────────────────
  describe('POST /api/messages', function () {
    it('sends a DM from User A to User B', async function () {
      skipWithoutDb(this);
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ recipient: userBId, content: 'Hello from integration test' });

      assert.ok([200, 201].includes(res.status), `Expected 200/201, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.ok(res.body._id || res.body.message?._id, 'Expected message _id in response');
      sentMessageId = res.body._id || res.body.message?._id;
    });

    it('rejects a message with no content and no attachment', async function () {
      skipWithoutDb(this);
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ recipient: userBId });

      assert.ok(res.status >= 400, `Expected 4xx for empty message, got ${res.status}`);
    });

    it('rejects a message with no recipient', async function () {
      skipWithoutDb(this);
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ content: 'No recipient' });

      assert.ok(res.status >= 400, `Expected 4xx for missing recipient, got ${res.status}`);
    });
  });

  // ── Fetch conversation ──────────────────────────────────────────────────────
  describe('GET /api/messages/:userId', function () {
    it('User A can fetch their conversation with User B', async function () {
      skipWithoutDb(this);
      if (!userBId) this.skip();
      const res = await request(app)
        .get(`/api/messages/${userBId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.ok([200].includes(res.status), `Expected 200, got ${res.status}`);
      assert.ok(Array.isArray(res.body) || Array.isArray(res.body.messages), 'Expected array of messages');
    });

    it('IDOR: User C cannot read the A↔B conversation', async function () {
      skipWithoutDb(this);
      if (!userBId) this.skip();
      // User C requests messages between A and B — should only see their own empty convo with B
      const res = await request(app)
        .get(`/api/messages/${userBId}`)
        .set('Authorization', `Bearer ${tokenC}`);

      // Should succeed (200) but return no messages (not A↔B messages)
      if (res.status === 200) {
        const messages = Array.isArray(res.body) ? res.body : res.body.messages ?? [];
        const leaked = messages.some(m => {
          const senderId = m.sender?._id ?? m.sender;
          const recipientId = m.recipient?._id ?? m.recipient;
          return String(senderId) === String(userAId) || String(recipientId) === String(userAId);
        });
        assert.ok(!leaked, 'IDOR: User C should not see User A messages');
      } else {
        assert.ok([401, 403].includes(res.status), `Expected 401/403 or filtered 200, got ${res.status}`);
      }
    });
  });

  // ── Mark as read ────────────────────────────────────────────────────────────
  describe('PUT /api/messages/:id/read', function () {
    it('User B can mark the received message as read', async function () {
      skipWithoutDb(this);
      if (!sentMessageId) this.skip();
      const res = await request(app)
        .put(`/api/messages/${sentMessageId}/read`)
        .set('Authorization', `Bearer ${tokenB}`);

      assert.ok([200, 204].includes(res.status), `Expected 200/204, got ${res.status}: ${JSON.stringify(res.body)}`);
    });
  });

  // ── Delete ──────────────────────────────────────────────────────────────────
  describe('DELETE /api/messages/:id', function () {
    it('IDOR: User C cannot delete a message between A and B', async function () {
      skipWithoutDb(this);
      if (!sentMessageId) this.skip();
      const res = await request(app)
        .delete(`/api/messages/${sentMessageId}`)
        .set('Authorization', `Bearer ${tokenC}`);

      assert.ok([403, 404].includes(res.status), `Expected 403/404 for IDOR attempt, got ${res.status}`);
    });

    it('User A can delete their own sent message', async function () {
      skipWithoutDb(this);
      if (!sentMessageId) this.skip();
      const res = await request(app)
        .delete(`/api/messages/${sentMessageId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.ok([200, 204].includes(res.status), `Expected 200/204, got ${res.status}: ${JSON.stringify(res.body)}`);
    });

    it('returns 400 for a malformed message ID', async function () {
      skipWithoutDb(this);
      const res = await request(app)
        .delete('/api/messages/not-a-valid-id')
        .set('Authorization', `Bearer ${tokenA}`);

      assert.ok(res.status >= 400, `Expected 4xx for invalid ID, got ${res.status}`);
    });
  });
});
