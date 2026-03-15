/**
 * Bookmarks API Integration Tests
 *
 * Tests the HTTP layer for /api/bookmarks — create, check, remove, list.
 * Validates the $addToSet idempotency fix and validateParamId middleware.
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
let tokenA, tokenB;
let userAId, userBId;
let testPostId;

const stamp = Date.now();
const USER_A = { username: `bkm_a_${stamp}`, email: `bkm_a_${stamp}@test.pryde`, password: 'TestPass123!@#', fullName: 'Bookmark User A', displayName: 'Bookmark User A', birthday: '1990-01-01' };
const USER_B = { username: `bkm_b_${stamp}`, email: `bkm_b_${stamp}@test.pryde`, password: 'TestPass123!@#', fullName: 'Bookmark User B', displayName: 'Bookmark User B', birthday: '1990-01-01' };

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

describe('Bookmarks API (/api/bookmarks)', function () {
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

    // Create a test post authored by User B (so User A can bookmark it)
    const postRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ content: 'Bookmark integration test post' });

    if ([200, 201].includes(postRes.status)) {
      testPostId = postRes.body._id || postRes.body.post?._id;
    }
  });

  after(async function () {
    if (mongoose.connection.readyState === 1) {
      const User = (await import('../../models/User.js')).default;
      const Post = (await import('../../models/Post.js')).default;
      if (testPostId) await Post.deleteOne({ _id: testPostId }).catch(() => {});
      await User.deleteMany({ email: { $in: [USER_A.email, USER_B.email] } }).catch(() => {});
    }
  });

  // ── Auth guard ──────────────────────────────────────────────────────────────
  describe('Auth protection', function () {
    it('rejects unauthenticated GET /api/bookmarks', async function () {
      skipWithoutDb(this);
      const res = await request(app).get('/api/bookmarks');
      assert.ok([401, 403].includes(res.status), `Expected 401/403, got ${res.status}`);
    });

    it('rejects unauthenticated POST /api/bookmarks/:postId', async function () {
      skipWithoutDb(this);
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app).post(`/api/bookmarks/${fakeId}`);
      assert.ok([401, 403].includes(res.status), `Expected 401/403, got ${res.status}`);
    });
  });

  // ── Create bookmark ─────────────────────────────────────────────────────────
  describe('POST /api/bookmarks/:postId', function () {
    it('User A can bookmark User B post', async function () {
      skipWithoutDb(this);
      if (!testPostId) this.skip();
      const res = await request(app)
        .post(`/api/bookmarks/${testPostId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.ok([200, 201].includes(res.status), `Expected 200/201, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.ok(res.body.bookmarkedPosts, 'Expected bookmarkedPosts in response');
    });

    it('bookmarking the same post again is idempotent ($addToSet)', async function () {
      skipWithoutDb(this);
      if (!testPostId) this.skip();
      const first = await request(app)
        .post(`/api/bookmarks/${testPostId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      const second = await request(app)
        .post(`/api/bookmarks/${testPostId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.ok([200, 201].includes(second.status), `Expected 200/201 for idempotent bookmark, got ${second.status}`);

      // The post should appear exactly once (not duplicated)
      const bookmarks = second.body.bookmarkedPosts || [];
      const occurrences = bookmarks.filter(id => String(id) === String(testPostId)).length;
      assert.ok(occurrences <= 1, `Post appeared ${occurrences} times in bookmarks — expected at most 1`);
    });

    it('returns 404 when bookmarking a non-existent post', async function () {
      skipWithoutDb(this);
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post(`/api/bookmarks/${nonExistentId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(res.status, 404);
    });

    it('returns 400 for a malformed post ID', async function () {
      skipWithoutDb(this);
      const res = await request(app)
        .post('/api/bookmarks/not-a-valid-id')
        .set('Authorization', `Bearer ${tokenA}`);

      assert.ok(res.status >= 400, `Expected 4xx for invalid ID, got ${res.status}`);
    });
  });

  // ── Check bookmark ──────────────────────────────────────────────────────────
  describe('GET /api/bookmarks/check/:postId', function () {
    it('returns isBookmarked: true for a bookmarked post', async function () {
      skipWithoutDb(this);
      if (!testPostId) this.skip();
      const res = await request(app)
        .get(`/api/bookmarks/check/${testPostId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.isBookmarked, true);
    });

    it('returns isBookmarked: false for a non-bookmarked post', async function () {
      skipWithoutDb(this);
      const freshPostRes = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ content: 'Unbookmarked post' });

      if (![200, 201].includes(freshPostRes.status)) this.skip();
      const freshPostId = freshPostRes.body._id || freshPostRes.body.post?._id;
      if (!freshPostId) this.skip();

      const res = await request(app)
        .get(`/api/bookmarks/check/${freshPostId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.isBookmarked, false);

      // Cleanup
      const Post = (await import('../../models/Post.js')).default;
      await Post.deleteOne({ _id: freshPostId }).catch(() => {});
    });

    it('returns 400 for a malformed post ID', async function () {
      skipWithoutDb(this);
      const res = await request(app)
        .get('/api/bookmarks/check/not-a-valid-id')
        .set('Authorization', `Bearer ${tokenA}`);

      assert.ok(res.status >= 400, `Expected 4xx for invalid ID, got ${res.status}`);
    });
  });

  // ── List bookmarks ──────────────────────────────────────────────────────────
  describe('GET /api/bookmarks', function () {
    it('returns the list of bookmarked posts for the authenticated user', async function () {
      skipWithoutDb(this);
      if (!testPostId) this.skip();
      const res = await request(app)
        .get('/api/bookmarks')
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.bookmarks), 'Expected bookmarks array');
      const found = res.body.bookmarks.some(p => String(p._id) === String(testPostId));
      assert.ok(found, 'The bookmarked post should appear in the list');
    });

    it('User B has no bookmarks (isolation — no cross-user leakage)', async function () {
      skipWithoutDb(this);
      const res = await request(app)
        .get('/api/bookmarks')
        .set('Authorization', `Bearer ${tokenB}`);

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.bookmarks), 'Expected bookmarks array');
      // User B never bookmarked anything in this suite
      const leaked = res.body.bookmarks.some(p => String(p._id) === String(testPostId));
      assert.ok(!leaked, 'User B should not see User A bookmarks');
    });
  });

  // ── Remove bookmark ─────────────────────────────────────────────────────────
  describe('DELETE /api/bookmarks/:postId', function () {
    it('User A can remove the bookmark', async function () {
      skipWithoutDb(this);
      if (!testPostId) this.skip();
      const res = await request(app)
        .delete(`/api/bookmarks/${testPostId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.ok([200, 204].includes(res.status), `Expected 200/204, got ${res.status}: ${JSON.stringify(res.body)}`);
    });

    it('removing an already-removed bookmark is idempotent', async function () {
      skipWithoutDb(this);
      if (!testPostId) this.skip();
      const res = await request(app)
        .delete(`/api/bookmarks/${testPostId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.ok([200, 204].includes(res.status), `Expected 200/204 for idempotent remove, got ${res.status}`);
    });

    it('GET /api/bookmarks/check returns isBookmarked: false after removal', async function () {
      skipWithoutDb(this);
      if (!testPostId) this.skip();
      const res = await request(app)
        .get(`/api/bookmarks/check/${testPostId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.isBookmarked, false);
    });

    it('returns 400 for a malformed post ID', async function () {
      skipWithoutDb(this);
      const res = await request(app)
        .delete('/api/bookmarks/not-a-valid-id')
        .set('Authorization', `Bearer ${tokenA}`);

      assert.ok(res.status >= 400, `Expected 4xx for invalid ID, got ${res.status}`);
    });
  });
});
