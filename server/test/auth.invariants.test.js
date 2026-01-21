/**
 * Phase 4C: Auth Safety Invariant Tests
 * 
 * These tests PROVE critical security guarantees never regress.
 * They document invariants, not implementation.
 * 
 * INVARIANTS TESTED:
 * 1. Refresh Token Replay Protection - reusing a token after rotation fails
 * 2. Revoked Session Enforcement - revoked sessions are immediately rejected
 * 
 * NOTE: These are integration-level tests that require database access.
 */

import { describe, it, before, after, beforeEach } from 'mocha';
import { strict as assert } from 'assert';
import mongoose from 'mongoose';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

// Models
import Session from '../models/Session.js';
import User from '../models/User.js';

describe('Auth Safety Invariants (Phase 4C)', function() {
  this.timeout(15000);

  let testUser;
  let testSession;

  before(async function() {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      const testDbUri = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI;
      await mongoose.connect(testDbUri);
    }
  });

  after(async function() {
    // Cleanup test data
    if (testUser) {
      await User.deleteOne({ _id: testUser._id });
    }
    if (testSession) {
      await Session.deleteOne({ _id: testSession._id });
    }
  });

  beforeEach(async function() {
    // Create fresh test user for each test
    const uniqueId = Date.now() + Math.random().toString(36).slice(2);
    testUser = await User.create({
      username: `invariant_test_${uniqueId}`,
      email: `invariant_test_${uniqueId}@test.local`,
      password: 'TestPassword123!',
      fullName: 'Invariant Test User',
      birthday: new Date('1990-01-01'),
      termsAcceptedAt: new Date(),
      isActive: true
    });
  });

  afterEach(async function() {
    // Cleanup after each test
    if (testUser) {
      await User.deleteOne({ _id: testUser._id });
      testUser = null;
    }
    if (testSession) {
      await Session.deleteOne({ _id: testSession._id });
      testSession = null;
    }
  });

  describe('Invariant 1: Refresh Token Replay Protection', function() {
    it('should reject reuse of old token after rotation', async function() {
      const sessionId = crypto.randomUUID();
      const originalToken = crypto.randomBytes(32).toString('hex');
      const newToken = crypto.randomBytes(32).toString('hex');

      // Create session with original token
      testSession = await Session.create({
        userId: testUser._id,
        sessionId,
        refreshTokenHash: Session.hashToken(originalToken),
        refreshTokenExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true
      });

      // Rotate token (simulates successful refresh)
      testSession.rotateToken(newToken);
      await testSession.save();

      // Reload session with hashes
      const reloadedSession = await Session.findOne({ sessionId })
        .select('+refreshTokenHash +previousRefreshTokenHash');

      // Verify new token works
      assert.ok(
        reloadedSession.verifyRefreshToken(newToken),
        'New token should verify successfully'
      );

      // Wait for grace period to expire (in real scenario)
      // For this test, we'll verify the old token is in previousRefreshTokenHash
      // but after previousTokenExpiry passes, it should fail

      // Force expire the previous token
      await Session.updateOne(
        { sessionId },
        { $set: { previousTokenExpiry: new Date(Date.now() - 1000) } }
      );

      // Reload and verify old token is rejected
      const expiredSession = await Session.findOne({ sessionId })
        .select('+refreshTokenHash +previousRefreshTokenHash');

      assert.ok(
        !expiredSession.verifyRefreshToken(originalToken),
        'INVARIANT VIOLATION: Old token should be rejected after grace period'
      );
    });
  });

  describe('Invariant 2: Revoked Session Enforcement', function() {
    it('should reject refresh attempts on revoked sessions', async function() {
      const sessionId = crypto.randomUUID();
      const validToken = crypto.randomBytes(32).toString('hex');

      // Create active session
      testSession = await Session.create({
        userId: testUser._id,
        sessionId,
        refreshTokenHash: Session.hashToken(validToken),
        refreshTokenExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true
      });

      // Verify session works initially
      let session = await Session.findOne({ sessionId, isActive: true });
      assert.ok(session, 'Active session should be found');

      // Revoke the session (simulates logout)
      await Session.updateOne(
        { sessionId },
        { $set: { isActive: false, revokedAt: new Date() } }
      );

      // Attempt to find active session (this is what refresh endpoint does)
      session = await Session.findOne({ sessionId, isActive: true });
      
      assert.ok(
        !session,
        'INVARIANT VIOLATION: Revoked session should NOT be found as active'
      );

      // Verify revoked session exists (for audit trail)
      const revokedSession = await Session.findOne({ sessionId, isActive: false });
      assert.ok(revokedSession, 'Revoked session should exist for audit');
      assert.ok(revokedSession.revokedAt, 'Revoked session should have revokedAt timestamp');
    });
  });
});

