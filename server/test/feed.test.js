/**
 * Feed Route Integration Tests
 *
 * Tests pagination, caching behaviour, and access control for /api/feed.
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
dotenv.config({ path: join(__dirname, '../.env') });

let app;
let authToken;
let testUserId;

const TEST_USER = {
  username: `feedtest_${Date.now()}`,
  email: `feedtest_${Date.now()}@test.pryde`,
  password: 'TestPass123!@#Secure',
  displayName: 'Feed Test User',
};

describe('Feed API (/api/feed)', function () {
  this.timeout(20000);

  before(async function () {
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI;
      await mongoose.connect(uri);
    }
    const mod = await import('../server.js');
    app = mod.default || mod.app;

    // Register and log in
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send(TEST_USER);

    if (signupRes.status !== 201 && signupRes.status !== 200) {
      throw new Error(`Signup failed: ${JSON.stringify(signupRes.body)}`);
    }

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    authToken = loginRes.body.token || loginRes.body.accessToken;
    testUserId = loginRes.body.user?._id || loginRes.body._id;
  });

  after(async function () {
    if (mongoose.connection.readyState === 1) {
      const User = (await import('../models/User.js')).default;
      await User.deleteOne({ email: TEST_USER.email }).catch(() => {});
    }
  });

  describe('GET /api/feed', function () {
    it('returns an array of posts for an authenticated user', async function () {
      const res = await request(app)
        .get('/api/feed')
        .set('Authorization', `Bearer ${authToken}`);

      assert.ok([200].includes(res.status), `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.ok(Array.isArray(res.body) || Array.isArray(res.body.posts), 'Expected posts array in response');
    });

    it('returns 401 for unauthenticated requests', async function () {
      const res = await request(app).get('/api/feed');
      assert.ok([401, 403].includes(res.status), `Expected 401/403, got ${res.status}`);
    });

    it('respects page and limit query parameters', async function () {
      const res = await request(app)
        .get('/api/feed?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`);

      assert.equal(res.status, 200);
      const posts = res.body.posts || res.body;
      assert.ok(Array.isArray(posts));
      assert.ok(posts.length <= 5, `Expected at most 5 posts, got ${posts.length}`);
    });

    it('returns consistent shape on second call (cache hit)', async function () {
      const first = await request(app)
        .get('/api/feed?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`);

      const second = await request(app)
        .get('/api/feed?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`);

      assert.equal(first.status, 200);
      assert.equal(second.status, 200);

      const postsA = first.body.posts || first.body;
      const postsB = second.body.posts || second.body;
      assert.equal(postsA.length, postsB.length, 'Cache hit should return same count');
    });
  });
});
