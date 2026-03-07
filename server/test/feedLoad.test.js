/**
 * Feed Load Safety Tests
 * Tests to protect Pryde Social from feed query regressions
 * 
 * Ensures feed endpoint always:
 * - respects pagination
 * - returns limited results
 * - responds quickly
 * - never accidentally returns thousands of posts
 */

import { describe, it, before, beforeEach } from 'mocha';
import { strict as assert } from 'assert';
import request from 'supertest';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

// Import app
let app;
let testUser;
let authToken;

// Import User model for cleanup
import User from '../models/User.js';

describe('Feed Load Safety', function() {
  this.timeout(30000);

  before(async function() {
    // Skip if MongoDB is already connected (server is running)
    if (mongoose.connection.readyState === 0) {
      const testDbUri = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI;
      await mongoose.connect(testDbUri);
    }

    // Import app
    const serverModule = await import('../server.js');
    app = serverModule.default || serverModule.app;
  });

  // Cleanup function to remove test users
  const cleanupTestUser = async () => {
    if (testUser && testUser.email) {
      try {
        await User.deleteOne({ email: testUser.email });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  };

  // Create a test user and get auth token before running tests
  beforeEach(async function() {
    // Clean up any existing test user from previous runs
    await cleanupTestUser();
    
    // Generate unique username for this test run
    const uniqueId = Date.now();
    
    // First try to login with test user
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'testuser@example.com',
        password: 'TestPassword123!'
      });

    if (loginRes.status === 200) {
      // User exists, use the token
      authToken = loginRes.body.token || loginRes.body.accessToken;
      testUser = { email: 'testuser@example.com' };
    } else {
      // Create a new test user
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({
          fullName: 'Test User',
          displayName: 'Test User',
          username: 'testuser_load_' + uniqueId,
          email: 'testuser_load_' + uniqueId + '@example.com',
          password: 'TestPassword123!',
          confirmPassword: 'TestPassword123!',
          birthday: '1990-01-01',
          termsAccepted: true,
          captchaToken: 'test-token'
        });

      if (signupRes.status === 201 || signupRes.status === 200) {
        authToken = signupRes.body.token || signupRes.body.accessToken;
        testUser = { email: 'testuser_load_' + uniqueId + '@example.com' };
      }
    }
  });

  // Cleanup after each test
  afterEach(async function() {
    await cleanupTestUser();
  });

  describe('GET /api/posts (Feed)', function() {
    
    it('Feed returns limited number of posts', async function() {
      const res = await request(app)
        .get('/api/posts?page=1&limit=20')
        .set('Authorization', `Bearer ${authToken}`);

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.posts), 'Response body should have posts array');
      assert.ok(res.body.posts.length <= 20, 'Response should return at most 20 posts');
    });

    it('Feed API responds within acceptable time', async function() {
      const start = Date.now();

      const res = await request(app)
        .get('/api/posts?page=1&limit=20')
        .set('Authorization', `Bearer ${authToken}`);

      const duration = Date.now() - start;

      assert.strictEqual(res.status, 200);
      // Feed should respond within 1 second
      assert.ok(duration < 1000, `Feed took ${duration}ms, should be less than 1000ms`);
    });

    it('Feed respects maximum limit parameter', async function() {
      // Try to request a large number of posts
      const res = await request(app)
        .get('/api/posts?page=1&limit=100')
        .set('Authorization', `Bearer ${authToken}`);

      assert.strictEqual(res.status, 200);
      // Should still be limited to a safe number
      assert.ok(res.body.posts.length <= 100, 'Response should return at most 100 posts');
    });

    it('Feed handles pagination correctly', async function() {
      // Get first page
      const page1 = await request(app)
        .get('/api/posts?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`);
      
      assert.strictEqual(page1.status, 200);
      
      // Get second page
      const page2 = await request(app)
        .get('/api/posts?page=2&limit=10')
        .set('Authorization', `Bearer ${authToken}`);
      
      assert.strictEqual(page2.status, 200);
      
      // If both pages have posts, they should be different
      if (page1.body.posts.length > 0 && page2.body.posts.length > 0) {
        const page1Ids = page1.body.posts.map(p => p._id);
        const page2Ids = page2.body.posts.map(p => p._id);
        
        // No overlap between pages
        const overlap = page1Ids.filter(id => page2Ids.includes(id));
        assert.strictEqual(overlap.length, 0, 'Pages should have no overlapping posts');
      }
    });

  });
});
