/**
 * Authentication Tests
 * Tests for CAPTCHA validation and password requirements
 *
 * NOTE: NODE_ENV=test is set via server/test/setup.js (--require flag)
 * This bypasses rate limiting so business logic tests work correctly.
 */

import { describe, it, before, after } from 'mocha';
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

// Import app (we'll need to export it from server.js)
let app;

describe('Authentication Tests', function() {
  this.timeout(15000); // Increase timeout for database operations

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

  after(async function() {
    // Only close if we opened the connection
    if (mongoose.connection.readyState === 1) {
      // Don't close if server is using it
      // await mongoose.connection.close();
    }
  });
  
  describe('POST /api/auth/signup', function() {

    // Helper to get error message from response (handles both formats)
    const getErrorMessage = (res) => {
      let messages = [];

      // Check for direct message first
      if (res.body.message) {
        messages.push(res.body.message);
      }

      // Check for express-validator errors array
      if (res.body.errors && Array.isArray(res.body.errors)) {
        const errorMsgs = res.body.errors.map(e => e.message || e.msg).filter(Boolean);
        messages = messages.concat(errorMsgs);
      }

      if (messages.length > 0) {
        return messages.join(' ');
      }

      // Fallback: stringify the whole body for debugging
      return JSON.stringify(res.body);
    };

    // Base valid signup data (to avoid rate limiting issues with unique usernames)
    const baseSignupData = {
      fullName: 'Test User',
      displayName: 'Test User',
      termsAccepted: true,
      captchaToken: 'test-token'
    };

    it('should reject signup without CAPTCHA token in production', async function() {
      // Skip if not in production mode
      if (process.env.NODE_ENV !== 'production') {
        this.skip();
      }

      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          ...baseSignupData,
          username: 'testuser',
          email: 'test@example.com',
          password: 'TestPassword123!',
          confirmPassword: 'TestPassword123!',
          birthday: '1990-01-01',
          captchaToken: undefined // No CAPTCHA
        });

      assert.strictEqual(res.status, 400);
      assert.ok(getErrorMessage(res).includes('CAPTCHA'));
    });

    it('should reject password shorter than 12 characters', async function() {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          ...baseSignupData,
          username: 'testuser_short_' + Date.now(),
          email: `test_short_${Date.now()}@example.com`,
          password: 'Short1!', // Only 7 characters
          confirmPassword: 'Short1!',
          birthday: '1990-01-01'
        });

      assert.strictEqual(res.status, 400);
      const errorMsg = getErrorMessage(res);
      assert.ok(
        errorMsg.includes('12 characters') || errorMsg.includes('at least 12'),
        `Expected error about 12 characters, got: ${errorMsg}`
      );
    });

    it('should reject password without special character', async function() {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          ...baseSignupData,
          username: 'testuser_nospec_' + Date.now(),
          email: `test_nospec_${Date.now()}@example.com`,
          password: 'NoSpecialChar123', // No special character (also no lowercase after 'o')
          confirmPassword: 'NoSpecialChar123',
          birthday: '1990-01-01'
        });

      assert.strictEqual(res.status, 400);
      const errorMsg = getErrorMessage(res);
      assert.ok(
        errorMsg.includes('special character') || errorMsg.includes('special') || errorMsg.includes('uppercase') || errorMsg.includes('lowercase'),
        `Expected error about password requirements, got: ${errorMsg}`
      );
    });

    it('should reject password without uppercase letter', async function() {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          ...baseSignupData,
          username: 'testuser_noupper_' + Date.now(),
          email: `test_noupper_${Date.now()}@example.com`,
          password: 'nouppercase123!', // No uppercase
          confirmPassword: 'nouppercase123!',
          birthday: '1990-01-01'
        });

      assert.strictEqual(res.status, 400);
      const errorMsg = getErrorMessage(res);
      assert.ok(
        errorMsg.includes('uppercase') || errorMsg.includes('Password must contain'),
        `Expected error about uppercase, got: ${errorMsg}`
      );
    });

    it('should reject password without lowercase letter', async function() {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          ...baseSignupData,
          username: 'testuser_nolower_' + Date.now(),
          email: `test_nolower_${Date.now()}@example.com`,
          password: 'NOLOWERCASE123!', // No lowercase
          confirmPassword: 'NOLOWERCASE123!',
          birthday: '1990-01-01'
        });

      assert.strictEqual(res.status, 400);
      const errorMsg = getErrorMessage(res);
      assert.ok(
        errorMsg.includes('lowercase') || errorMsg.includes('Password must contain'),
        `Expected error about lowercase, got: ${errorMsg}`
      );
    });

    it('should reject password without number', async function() {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          ...baseSignupData,
          username: 'testuser_nonum_' + Date.now(),
          email: `test_nonum_${Date.now()}@example.com`,
          password: 'NoNumbersHere!!', // No number (14 chars to meet length)
          confirmPassword: 'NoNumbersHere!!',
          birthday: '1990-01-01'
        });

      assert.strictEqual(res.status, 400);
      const errorMsg = getErrorMessage(res);
      assert.ok(
        errorMsg.includes('number') || errorMsg.includes('Password must contain'),
        `Expected error about number, got: ${errorMsg}`
      );
    });

    it('should reject signup for users under 18', async function() {
      const today = new Date();
      const under18Birthday = new Date(today.getFullYear() - 17, today.getMonth(), today.getDate());

      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          ...baseSignupData,
          username: 'younguser_' + Date.now(),
          email: `young_${Date.now()}@example.com`,
          password: 'ValidPassword123!',
          confirmPassword: 'ValidPassword123!',
          birthday: under18Birthday.toISOString().split('T')[0]
        });

      // Age check MUST return 403 (Forbidden) - this runs BEFORE CAPTCHA validation
      // so we should never see a CAPTCHA error masking the age error
      assert.strictEqual(
        res.status,
        403,
        `Expected 403 for underage rejection, got ${res.status}. Body: ${JSON.stringify(res.body)}`
      );
      const errorMsg = getErrorMessage(res);
      assert.ok(
        errorMsg.includes('18') || errorMsg.includes('underage') || errorMsg.includes('older'),
        `Expected error about age 18, got: ${errorMsg}`
      );
      // Verify it's not a CAPTCHA error (age check should run first)
      assert.ok(
        !errorMsg.toLowerCase().includes('captcha'),
        `Age error should not be masked by CAPTCHA error. Got: ${errorMsg}`
      );
    });
  });
});

