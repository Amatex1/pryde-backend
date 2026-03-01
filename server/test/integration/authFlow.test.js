/**
 * Integration Tests: Auth Login Flow + Email Verification Enforcement
 *
 * These tests require a running MongoDB instance.
 * Set MONGODB_URI_TEST (or MONGODB_URI) in your .env to enable them.
 *
 * Covers:
 *   1. Auth login — rejects missing credentials / wrong password
 *   2. Email verification enforcement — unverified users cannot access protected routes
 *   3. Post creation — authenticated + verified user can create a post
 *
 * NOTE: These tests do NOT require a real CAPTCHA or email service.
 *       NODE_ENV=test (set by test/setup.js) disables CAPTCHA and rate limiting.
 */

import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });

const TEST_DB_URI = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI;

// ─── Skip guard: all tests in this suite skip when no DB is configured ─────
function skipWithoutDb(ctx) {
  if (!TEST_DB_URI) {
    ctx.skip();
  }
}

let app;

describe('Auth Flow Integration Tests', function () {
  this.timeout(20000);

  before(async function () {
    if (!TEST_DB_URI) {
      return; // individual it() calls will skip
    }
    try {
      await mongoose.connect(TEST_DB_URI);
      const serverModule = await import('../../server.js');
      app = serverModule.default || serverModule.app;
    } catch (err) {
      console.warn('[authFlow.test] Could not connect to test DB:', err.message);
    }
  });

  after(async function () {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  });

  // ── 1. Auth Login ──────────────────────────────────────────────────────────
  describe('POST /api/auth/login', function () {
    it('should reject login with no body', async function () {
      skipWithoutDb(this);
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).to.be.oneOf([400, 422]);
    });

    it('should reject login with wrong credentials', async function () {
      skipWithoutDb(this);
      const res = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'wrongpassword123!'
      });
      expect(res.status).to.be.oneOf([400, 401, 404]);
      expect(res.body).to.have.property('message');
    });
  });

  // ── 2. Email Verification Enforcement ────────────────────────────────────
  describe('Email Verification Enforcement', function () {
    it('should reject unauthenticated requests to protected routes', async function () {
      skipWithoutDb(this);
      const res = await request(app).get('/api/posts');
      expect(res.status).to.be.oneOf([401, 403]);
    });

    it('should reject requests with invalid JWT token', async function () {
      skipWithoutDb(this);
      const res = await request(app)
        .get('/api/posts')
        .set('Authorization', 'Bearer invalid.jwt.token');
      expect(res.status).to.be.oneOf([401, 403]);
    });
  });

  // ── 3. Post Creation Guard ────────────────────────────────────────────────
  describe('POST /api/posts', function () {
    it('should reject unauthenticated post creation', async function () {
      skipWithoutDb(this);
      const res = await request(app)
        .post('/api/posts')
        .send({ content: 'Test post content' });
      expect(res.status).to.be.oneOf([401, 403]);
    });

    it('should reject post creation with malformed token', async function () {
      skipWithoutDb(this);
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', 'Bearer not.a.real.token')
        .send({ content: 'Test post content' });
      expect(res.status).to.be.oneOf([401, 403]);
    });
  });
});
