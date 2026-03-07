/**
 * Posts Route Integration Tests
 *
 * Tests core CRUD operations and access control for /api/posts.
 * NODE_ENV=test is set via test/setup.js which bypasses rate limiting.
 */

import { describe, it, before, after, afterEach } from 'mocha';
import { strict as assert } from 'assert';
import request from 'supertest';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

let app;
let authToken;
let testUserId;
let createdPostId;

const TEST_USER = {
  username: `poststest_${Date.now()}`,
  email: `poststest_${Date.now()}@test.pryde`,
  password: 'TestPass123!@#Secure',
  displayName: 'Posts Test User',
};

describe('Posts API (/api/posts)', function () {
  this.timeout(20000);

  before(async function () {
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI;
      await mongoose.connect(uri);
    }
    const mod = await import('../server.js');
    app = mod.default || mod.app;

    // Register and log in a test user
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send(TEST_USER);

    if (signupRes.status !== 201 && signupRes.status !== 200) {
      throw new Error(`Signup failed: ${JSON.stringify(signupRes.body)}`);
    }

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    assert.ok(loginRes.body.token || loginRes.body.accessToken, 'Expected access token on login');
    authToken = loginRes.body.token || loginRes.body.accessToken;
    testUserId = loginRes.body.user?._id || loginRes.body._id;
  });

  after(async function () {
    // Clean up test user and their posts
    if (mongoose.connection.readyState === 1) {
      const User = (await import('../models/User.js')).default;
      const Post = (await import('../models/Post.js')).default;
      await Post.deleteMany({ author: testUserId }).catch(() => {});
      await User.deleteOne({ email: TEST_USER.email }).catch(() => {});
    }
  });

  // ── Create ────────────────────────────────────────────────────────────────

  describe('POST /api/posts', function () {
    it('creates a post when authenticated', async function () {
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Integration test post — please ignore' });

      assert.ok([200, 201].includes(res.status), `Expected 200/201, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.ok(res.body._id || res.body.post?._id, 'Expected post _id in response');
      createdPostId = res.body._id || res.body.post?._id;
    });

    it('rejects post creation without auth', async function () {
      const res = await request(app)
        .post('/api/posts')
        .send({ content: 'Should be rejected' });

      assert.ok([401, 403].includes(res.status), `Expected 401/403, got ${res.status}`);
    });

    it('rejects empty content', async function () {
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: '' });

      assert.ok(res.status >= 400, `Expected 4xx for empty content, got ${res.status}`);
    });
  });

  // ── Read ──────────────────────────────────────────────────────────────────

  describe('GET /api/posts/:id', function () {
    it('fetches an existing post by ID', async function () {
      if (!createdPostId) this.skip();
      const res = await request(app)
        .get(`/api/posts/${createdPostId}`)
        .set('Authorization', `Bearer ${authToken}`);

      assert.ok([200].includes(res.status), `Expected 200, got ${res.status}`);
      assert.equal(res.body._id || res.body.post?._id, createdPostId);
    });

    it('returns 404 for a non-existent post', async function () {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/posts/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      assert.equal(res.status, 404);
    });
  });

  // ── Delete ────────────────────────────────────────────────────────────────

  describe('DELETE /api/posts/:id', function () {
    it('allows the author to delete their post', async function () {
      if (!createdPostId) this.skip();
      const res = await request(app)
        .delete(`/api/posts/${createdPostId}`)
        .set('Authorization', `Bearer ${authToken}`);

      assert.ok([200, 204].includes(res.status), `Expected 200/204, got ${res.status}`);
    });

    it('returns 401 when trying to delete without auth', async function () {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .delete(`/api/posts/${fakeId}`);

      assert.ok([401, 403].includes(res.status), `Expected 401/403, got ${res.status}`);
    });
  });
});
