/**
 * Authentication Tests
 * Tests for CAPTCHA validation and password requirements
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
    
    it('should reject signup without CAPTCHA token in production', async function() {
      // Skip if not in production mode
      if (process.env.NODE_ENV !== 'production') {
        this.skip();
      }
      
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'TestPassword123!',
          confirmPassword: 'TestPassword123!',
          displayName: 'Test User',
          birthday: '1990-01-01'
        });
      
      assert.strictEqual(res.status, 400);
      assert.ok(res.body.message.includes('CAPTCHA'));
    });
    
    it('should reject password shorter than 12 characters', async function() {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'testuser2',
          email: 'test2@example.com',
          password: 'Short1!', // Only 7 characters
          confirmPassword: 'Short1!',
          displayName: 'Test User 2',
          birthday: '1990-01-01',
          captchaToken: 'test-token'
        });
      
      assert.strictEqual(res.status, 400);
      assert.ok(res.body.message.includes('12 characters'));
    });
    
    it('should reject password without special character', async function() {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'testuser3',
          email: 'test3@example.com',
          password: 'NoSpecialChar123', // No special character
          confirmPassword: 'NoSpecialChar123',
          displayName: 'Test User 3',
          birthday: '1990-01-01',
          captchaToken: 'test-token'
        });
      
      assert.strictEqual(res.status, 400);
      assert.ok(res.body.message.includes('special character'));
    });
    
    it('should reject password without uppercase letter', async function() {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'testuser4',
          email: 'test4@example.com',
          password: 'nouppercase123!', // No uppercase
          confirmPassword: 'nouppercase123!',
          displayName: 'Test User 4',
          birthday: '1990-01-01',
          captchaToken: 'test-token'
        });
      
      assert.strictEqual(res.status, 400);
      assert.ok(res.body.message.includes('uppercase'));
    });
    
    it('should reject password without lowercase letter', async function() {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'testuser5',
          email: 'test5@example.com',
          password: 'NOLOWERCASE123!', // No lowercase
          confirmPassword: 'NOLOWERCASE123!',
          displayName: 'Test User 5',
          birthday: '1990-01-01',
          captchaToken: 'test-token'
        });
      
      assert.strictEqual(res.status, 400);
      assert.ok(res.body.message.includes('lowercase'));
    });
    
    it('should reject password without number', async function() {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'testuser6',
          email: 'test6@example.com',
          password: 'NoNumbersHere!', // No number
          confirmPassword: 'NoNumbersHere!',
          displayName: 'Test User 6',
          birthday: '1990-01-01',
          captchaToken: 'test-token'
        });
      
      assert.strictEqual(res.status, 400);
      assert.ok(res.body.message.includes('number'));
    });
    
    it('should reject signup for users under 18', async function() {
      const today = new Date();
      const under18Birthday = new Date(today.getFullYear() - 17, today.getMonth(), today.getDate());
      
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'younguser',
          email: 'young@example.com',
          password: 'ValidPassword123!',
          confirmPassword: 'ValidPassword123!',
          displayName: 'Young User',
          birthday: under18Birthday.toISOString().split('T')[0],
          captchaToken: 'test-token'
        });
      
      assert.strictEqual(res.status, 400);
      assert.ok(res.body.message.includes('18'));
    });
  });
});

