/**
 * Unit Tests: Socket Rate Limiter
 *
 * Tests the in-memory sliding-window rate limiter added in Phase 2.
 * These tests run without any external dependencies (no DB, no Redis).
 */

import { describe, it, before, after, beforeEach } from 'mocha';
import { expect } from 'chai';

// Dynamically import so tests run in isolation (the module has a setInterval
// for cache eviction — Node exits cleanly when we call the cleanup below)
let checkEventRate;

describe('Socket Rate Limiter (in-memory)', function () {
  this.timeout(5000);

  before(async function () {
    const mod = await import('../../socket/rateLimiter.js');
    checkEventRate = mod.checkEventRate;
  });

  describe('checkEventRate — unknown event', function () {
    it('should allow events with no configured limit', async function () {
      const allowed = await checkEventRate('user-123', 'unknown_event', null);
      expect(allowed).to.equal(true);
    });
  });

  describe('checkEventRate — send_message (limit: 5/s)', function () {
    // Use a unique userId per test to avoid cross-test pollution
    const makeUserId = () => `test-${Date.now()}-${Math.random()}`;

    it('should allow the first 5 sends within 1 second', async function () {
      const userId = makeUserId();
      for (let i = 0; i < 5; i++) {
        const ok = await checkEventRate(userId, 'send_message', null);
        expect(ok).to.equal(true, `Request ${i + 1} should be allowed`);
      }
    });

    it('should block the 6th send within 1 second', async function () {
      const userId = makeUserId();
      for (let i = 0; i < 5; i++) {
        await checkEventRate(userId, 'send_message', null);
      }
      const blocked = await checkEventRate(userId, 'send_message', null);
      expect(blocked).to.equal(false, '6th request should be rate-limited');
    });

    it('should allow again after the window expires', async function () {
      this.timeout(3000);
      const userId = makeUserId();
      for (let i = 0; i < 5; i++) {
        await checkEventRate(userId, 'send_message', null);
      }
      // Wait for the 1-second window to lapse
      await new Promise(resolve => setTimeout(resolve, 1100));
      const ok = await checkEventRate(userId, 'send_message', null);
      expect(ok).to.equal(true, 'Should be allowed after window expires');
    });
  });

  describe('checkEventRate — typing (limit: 10/s)', function () {
    it('should allow up to 10 typing events per second', async function () {
      const userId = `typing-${Date.now()}`;
      for (let i = 0; i < 10; i++) {
        const ok = await checkEventRate(userId, 'typing', null);
        expect(ok).to.equal(true, `Typing event ${i + 1} should be allowed`);
      }
    });

    it('should block the 11th typing event within 1 second', async function () {
      const userId = `typing-block-${Date.now()}`;
      for (let i = 0; i < 10; i++) {
        await checkEventRate(userId, 'typing', null);
      }
      const blocked = await checkEventRate(userId, 'typing', null);
      expect(blocked).to.equal(false, '11th typing event should be blocked');
    });
  });

  describe('checkEventRate — separate users are independent', function () {
    it('should not share limits between different users', async function () {
      const userA = `userA-${Date.now()}`;
      const userB = `userB-${Date.now()}`;
      // Exhaust userA's limit
      for (let i = 0; i < 5; i++) {
        await checkEventRate(userA, 'send_message', null);
      }
      // userB should still be allowed
      const ok = await checkEventRate(userB, 'send_message', null);
      expect(ok).to.equal(true, 'UserB should not be affected by UserA limits');
    });
  });

  describe('checkEventRate — Redis getter returns null (in-memory fallback)', function () {
    it('should use in-memory fallback when getter returns null', async function () {
      const userId = `fallback-${Date.now()}`;
      const nullGetter = () => null;
      const ok = await checkEventRate(userId, 'send_message', nullGetter);
      expect(ok).to.equal(true);
    });
  });
});
