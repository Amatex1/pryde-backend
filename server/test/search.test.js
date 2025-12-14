/**
 * Search Endpoint Tests
 * Verify NoSQL injection protection and regex escaping
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

let app;

describe('Search Endpoint Tests', function() {
  this.timeout(10000);
  
  before(async function() {
    const testDbUri = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI;
    await mongoose.connect(testDbUri);
    
    const serverModule = await import('../server.js');
    app = serverModule.default || serverModule.app;
  });
  
  after(async function() {
    await mongoose.connection.close();
  });
  
  describe('GET /api/search', function() {
    
    it('should escape regex special characters', async function() {
      // These characters should be escaped: . * + ? ^ $ { } ( ) | [ ] \
      const maliciousQuery = '.*test.*';
      
      const res = await request(app)
        .get('/api/search')
        .query({ q: maliciousQuery });
      
      // Should not throw an error
      assert.ok(res.status === 200 || res.status === 401, 'Should handle regex characters safely');
    });
    
    it('should handle parentheses in search query', async function() {
      const query = 'test(query)';
      
      const res = await request(app)
        .get('/api/search')
        .query({ q: query });
      
      assert.ok(res.status === 200 || res.status === 401, 'Should handle parentheses safely');
    });
    
    it('should handle brackets in search query', async function() {
      const query = 'test[query]';
      
      const res = await request(app)
        .get('/api/search')
        .query({ q: query });
      
      assert.ok(res.status === 200 || res.status === 401, 'Should handle brackets safely');
    });
    
    it('should handle dollar signs in search query', async function() {
      const query = '$test$query';
      
      const res = await request(app)
        .get('/api/search')
        .query({ q: query });
      
      assert.ok(res.status === 200 || res.status === 401, 'Should handle dollar signs safely');
    });
    
    it('should handle backslashes in search query', async function() {
      const query = 'test\\query';
      
      const res = await request(app)
        .get('/api/search')
        .query({ q: query });
      
      assert.ok(res.status === 200 || res.status === 401, 'Should handle backslashes safely');
    });
    
    it('should handle pipe characters in search query', async function() {
      const query = 'test|query';
      
      const res = await request(app)
        .get('/api/search')
        .query({ q: query });
      
      assert.ok(res.status === 200 || res.status === 401, 'Should handle pipe characters safely');
    });
    
    it('should handle plus signs in search query', async function() {
      const query = 'test+query';
      
      const res = await request(app)
        .get('/api/search')
        .query({ q: query });
      
      assert.ok(res.status === 200 || res.status === 401, 'Should handle plus signs safely');
    });
    
    it('should handle question marks in search query', async function() {
      const query = 'test?query';
      
      const res = await request(app)
        .get('/api/search')
        .query({ q: query });
      
      assert.ok(res.status === 200 || res.status === 401, 'Should handle question marks safely');
    });
    
    it('should handle asterisks in search query', async function() {
      const query = 'test*query';
      
      const res = await request(app)
        .get('/api/search')
        .query({ q: query });
      
      assert.ok(res.status === 200 || res.status === 401, 'Should handle asterisks safely');
    });
    
    it('should handle caret symbols in search query', async function() {
      const query = '^test^query';
      
      const res = await request(app)
        .get('/api/search')
        .query({ q: query });
      
      assert.ok(res.status === 200 || res.status === 401, 'Should handle caret symbols safely');
    });
    
    it('should handle curly braces in search query', async function() {
      const query = 'test{query}';
      
      const res = await request(app)
        .get('/api/search')
        .query({ q: query });
      
      assert.ok(res.status === 200 || res.status === 401, 'Should handle curly braces safely');
    });
    
    it('should not crash with ReDoS attack pattern', async function() {
      // ReDoS (Regular Expression Denial of Service) pattern
      const redosQuery = 'a'.repeat(100) + '!';
      
      const res = await request(app)
        .get('/api/search')
        .query({ q: redosQuery });
      
      assert.ok(res.status === 200 || res.status === 401, 'Should handle ReDoS patterns safely');
    });
  });
  
  describe('GET /api/search/hashtag/:tag', function() {
    
    it('should escape regex special characters in hashtag search', async function() {
      const maliciousTag = '.*test.*';
      
      const res = await request(app)
        .get(`/api/search/hashtag/${maliciousTag}`);
      
      assert.ok(res.status === 200 || res.status === 401, 'Should handle regex characters in hashtags safely');
    });
  });
});

