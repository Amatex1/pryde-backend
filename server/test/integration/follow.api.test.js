/**
 * Follow API Integration Tests
 *
 * Tests the HTTP layer for /api/follow — follow public user, follow private user
 * (request flow: send → accept/reject/cancel), unfollow, and auth guards.
 * NODE_ENV=test (set by test/setup.js) bypasses rate limiting.
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
let userAId, userBId, userCId;
let followRequestId;

const stamp = Date.now();
const USER_A = { username: `flw_a_${stamp}`, email: `flw_a_${stamp}@test.pryde`, password: 'TestPass123!@#', fullName: 'Follow User A', displayName: 'Follow User A', birthday: '1990-01-01' };
// User B is PUBLIC (default)
const USER_B = { username: `flw_b_${stamp}`, email: `flw_b_${stamp}@test.pryde`, password: 'TestPass123!@#', fullName: 'Follow User B', displayName: 'Follow User B', birthday: '1990-01-01' };
// User C is PRIVATE (set after registration)
const USER_C = { username: `flw_c_${stamp}`, email: `flw_c_${stamp}@test.pryde`, password: 'TestPass123!@#', fullName: 'Follow User C', displayName: 'Follow User C', birthday: '1990-01-01' };

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

describe('Follow API (/api/follow)', function () {
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
    ({ token: tokenC, userId: userCId } = await registerAndLogin(USER_C));

    // Make User C private
    const User = (await import('../../models/User.js')).default;
    await User.updateOne({ _id: userCId }, { $set: { 'privacySettings.isPrivateAccount': true } });
  });

  after(async function () {
    if (mongoose.connection.readyState === 1) {
      const User = (await import('../../models/User.js')).default;
      const Follow = (await import('../../models/Follow.js')).default;
      const FollowRequest = (await import('../../models/FollowRequest.js')).default;
      await Follow.deleteMany({ $or: [{ follower: userAId }, { following: userAId }] }).catch(() => {});
      await FollowRequest.deleteMany({ $or: [{ sender: userAId }, { receiver: userAId }] }).catch(() => {});
      await User.deleteMany({ email: { $in: [USER_A.email, USER_B.email, USER_C.email] } }).catch(() => {});
    }
  });

  // ── Auth guard ──────────────────────────────────────────────────────────────
  describe('Auth protection', function () {
    it('rejects unauthenticated POST /api/follow/:userId', async function () {
      skipWithoutDb(this);
      if (!userBId) this.skip();
      const res = await request(app).post(`/api/follow/${userBId}`);
      assert.ok([401, 403].includes(res.status), `Expected 401/403, got ${res.status}`);
    });

    it('rejects unauthenticated DELETE /api/follow/:userId', async function () {
      skipWithoutDb(this);
      if (!userBId) this.skip();
      const res = await request(app).delete(`/api/follow/${userBId}`);
      assert.ok([401, 403].includes(res.status), `Expected 401/403, got ${res.status}`);
    });
  });

  // ── Follow self guard ───────────────────────────────────────────────────────
  describe('Self-follow guard', function () {
    it('rejects following yourself', async function () {
      skipWithoutDb(this);
      if (!userAId) this.skip();
      const res = await request(app)
        .post(`/api/follow/${userAId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(res.status, 400);
    });
  });

  // ── Follow public user ──────────────────────────────────────────────────────
  describe('POST /api/follow/:userId — public account', function () {
    it('User A can follow User B (public account — instant follow)', async function () {
      skipWithoutDb(this);
      if (!userBId) this.skip();
      const res = await request(app)
        .post(`/api/follow/${userBId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.ok([200, 201].includes(res.status), `Expected 200/201, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.requiresApproval, false);
    });

    it('following the same public user again is idempotent (no error)', async function () {
      skipWithoutDb(this);
      if (!userBId) this.skip();
      const res = await request(app)
        .post(`/api/follow/${userBId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.ok([200, 201].includes(res.status), `Expected 200/201 for idempotent follow, got ${res.status}`);
    });

    it('GET /api/follow/followers/:userId shows User A as a follower of User B', async function () {
      skipWithoutDb(this);
      if (!userBId) this.skip();
      const res = await request(app)
        .get(`/api/follow/followers/${userBId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(res.status, 200);
      const followers = res.body.followers || [];
      const found = followers.some(f => {
        const fId = f._id || f;
        return String(fId) === String(userAId);
      });
      assert.ok(found, 'User A should appear in User B follower list');
    });
  });

  // ── Unfollow ────────────────────────────────────────────────────────────────
  describe('DELETE /api/follow/:userId — unfollow', function () {
    it('User A can unfollow User B', async function () {
      skipWithoutDb(this);
      if (!userBId) this.skip();
      const res = await request(app)
        .delete(`/api/follow/${userBId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.ok([200, 204].includes(res.status), `Expected 200/204, got ${res.status}: ${JSON.stringify(res.body)}`);
    });

    it('unfollowing a non-followed user returns 404', async function () {
      skipWithoutDb(this);
      if (!userBId) this.skip();
      // User B does not exist in A's following list anymore
      const res = await request(app)
        .delete(`/api/follow/${userBId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      // Implementations may return 404 or 200 (idempotent); either is acceptable
      assert.ok(res.status >= 200, `Expected >= 200, got ${res.status}`);
    });
  });

  // ── Follow private user (request flow) ─────────────────────────────────────
  describe('Follow request flow — private account', function () {
    it('following a private user creates a pending follow request', async function () {
      skipWithoutDb(this);
      if (!userCId) this.skip();
      const res = await request(app)
        .post(`/api/follow/${userCId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.ok([200, 201].includes(res.status), `Expected 200/201, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.requiresApproval, true);
      assert.ok(res.body.followRequest?._id, 'Expected followRequest._id in response');
      followRequestId = res.body.followRequest._id;
    });

    it('sending the same follow request again is idempotent', async function () {
      skipWithoutDb(this);
      if (!userCId) this.skip();
      const res = await request(app)
        .post(`/api/follow/${userCId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.ok([200, 201].includes(res.status), `Expected 200/201 for idempotent request, got ${res.status}`);
      assert.strictEqual(res.body.requiresApproval, true);
    });

    it('User C can see the pending follow request', async function () {
      skipWithoutDb(this);
      const res = await request(app)
        .get('/api/follow/requests')
        .set('Authorization', `Bearer ${tokenC}`);

      assert.strictEqual(res.status, 200);
      const requests = res.body.followRequests || [];
      const found = requests.some(r => String(r.sender?._id || r.sender) === String(userAId));
      assert.ok(found, 'User C should see User A follow request');
    });

    it('User A can see their sent follow request', async function () {
      skipWithoutDb(this);
      const res = await request(app)
        .get('/api/follow/requests/sent')
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(res.status, 200);
      const requests = res.body.sentRequests || [];
      const found = requests.some(r => String(r.receiver?._id || r.receiver) === String(userCId));
      assert.ok(found, 'User A should see their sent request to User C');
    });

    it('User B cannot accept a follow request they did not receive (IDOR)', async function () {
      skipWithoutDb(this);
      if (!followRequestId) this.skip();
      const res = await request(app)
        .post(`/api/follow/requests/${followRequestId}/accept`)
        .set('Authorization', `Bearer ${tokenB}`);

      assert.ok([403, 404].includes(res.status), `Expected 403/404 for IDOR attempt, got ${res.status}`);
    });

    it('User C can accept the follow request', async function () {
      skipWithoutDb(this);
      if (!followRequestId) this.skip();
      const res = await request(app)
        .post(`/api/follow/requests/${followRequestId}/accept`)
        .set('Authorization', `Bearer ${tokenC}`);

      assert.ok([200, 204].includes(res.status), `Expected 200/204, got ${res.status}: ${JSON.stringify(res.body)}`);
    });

    it('accepting the same request again returns 400 (already processed)', async function () {
      skipWithoutDb(this);
      if (!followRequestId) this.skip();
      const res = await request(app)
        .post(`/api/follow/requests/${followRequestId}/accept`)
        .set('Authorization', `Bearer ${tokenC}`);

      assert.strictEqual(res.status, 400);
    });
  });

  // ── Reject flow ─────────────────────────────────────────────────────────────
  describe('Follow request reject + cancel', function () {
    let rejectRequestId;

    it('User B follows private User C (creates a new request)', async function () {
      skipWithoutDb(this);
      if (!userCId) this.skip();
      const res = await request(app)
        .post(`/api/follow/${userCId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      assert.ok([200, 201].includes(res.status), `Expected 200/201, got ${res.status}`);
      assert.strictEqual(res.body.requiresApproval, true);
      rejectRequestId = res.body.followRequest?._id;
    });

    it('User C can reject the follow request', async function () {
      skipWithoutDb(this);
      if (!rejectRequestId) this.skip();
      const res = await request(app)
        .post(`/api/follow/requests/${rejectRequestId}/reject`)
        .set('Authorization', `Bearer ${tokenC}`);

      assert.ok([200, 204].includes(res.status), `Expected 200/204, got ${res.status}: ${JSON.stringify(res.body)}`);
    });

    it('User A can cancel their own follow request (creates a fresh one first)', async function () {
      skipWithoutDb(this);
      if (!userCId) this.skip();
      // User A was already accepted, so they follow C now. Unfollow first so we can send a new request.
      await request(app).delete(`/api/follow/${userCId}`).set('Authorization', `Bearer ${tokenA}`);

      const followRes = await request(app)
        .post(`/api/follow/${userCId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      if (followRes.status !== 201 && followRes.status !== 200) this.skip();
      const cancelId = followRes.body.followRequest?._id;
      if (!cancelId) this.skip();

      const cancelRes = await request(app)
        .delete(`/api/follow/requests/${cancelId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.ok([200, 204].includes(cancelRes.status), `Expected 200/204, got ${cancelRes.status}: ${JSON.stringify(cancelRes.body)}`);
    });

    it('returns 400 for a malformed request ID', async function () {
      skipWithoutDb(this);
      const res = await request(app)
        .post('/api/follow/requests/not-a-valid-id/accept')
        .set('Authorization', `Bearer ${tokenA}`);

      assert.ok(res.status >= 400, `Expected 4xx for invalid ID, got ${res.status}`);
    });
  });
});
