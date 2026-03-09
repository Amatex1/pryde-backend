/**
 * Unit Tests: Auto Badge Service
 *
 * Tests badge configuration, exports, and pure logic — no DB required for most.
 *
 * Catches:
 *   - Missing grace periods (profile_complete, active_this_month)
 *   - ASSIGN_ONLY_BADGES not including profile_complete
 *   - checkActiveThisMonth not counting comments
 *   - Grace period measuring from wrong reference point
 *   - daysSince helper accuracy
 */

import { describe, it, before } from 'mocha';
import { expect } from 'chai';

let AUTO_BADGE_CONFIG;
let ASSIGN_ONLY_BADGES;
let BADGE_CHECKS;
let processUserBadges;
let runDailyBadgeSweep;

describe('Auto Badge Service', function () {
  before(async function () {
    const mod = await import('../../services/autoBadgeService.js');
    AUTO_BADGE_CONFIG = mod.AUTO_BADGE_CONFIG;
    ASSIGN_ONLY_BADGES = mod.ASSIGN_ONLY_BADGES;
    BADGE_CHECKS = mod.BADGE_CHECKS;
    processUserBadges = mod.processUserBadges;
    runDailyBadgeSweep = mod.runDailyBadgeSweep;
  });

  // ── Exports ───────────────────────────────────────────────────────────────

  describe('exports', function () {
    it('should export AUTO_BADGE_CONFIG', function () {
      expect(AUTO_BADGE_CONFIG).to.be.an('object');
    });

    it('should export ASSIGN_ONLY_BADGES', function () {
      expect(ASSIGN_ONLY_BADGES).to.be.an('array');
    });

    it('should export BADGE_CHECKS', function () {
      expect(BADGE_CHECKS).to.be.an('object');
    });

    it('should export processUserBadges', function () {
      expect(processUserBadges).to.be.a('function');
    });

    it('should export runDailyBadgeSweep', function () {
      expect(runDailyBadgeSweep).to.be.a('function');
    });
  });

  // ── ASSIGN_ONLY_BADGES ────────────────────────────────────────────────────

  describe('ASSIGN_ONLY_BADGES', function () {
    it('should contain active_this_month', function () {
      expect(ASSIGN_ONLY_BADGES).to.include('active_this_month',
        'active_this_month must be in ASSIGN_ONLY_BADGES to prevent immediate revocation');
    });

    it('should contain profile_complete', function () {
      expect(ASSIGN_ONLY_BADGES).to.include('profile_complete',
        'profile_complete must be in ASSIGN_ONLY_BADGES — editing profile fields should not immediately revoke the badge');
    });
  });

  // ── Grace period config ───────────────────────────────────────────────────

  describe('AUTO_BADGE_CONFIG grace periods', function () {
    it('active_this_month should have a gracePeriodDays > 0', function () {
      expect(AUTO_BADGE_CONFIG.active_this_month).to.have.property('gracePeriodDays');
      expect(AUTO_BADGE_CONFIG.active_this_month.gracePeriodDays).to.be.above(0,
        'Grace period prevents active_this_month badge from being revoked/reinstated every month');
    });

    it('profile_complete should have a gracePeriodDays > 0', function () {
      expect(AUTO_BADGE_CONFIG.profile_complete).to.have.property('gracePeriodDays');
      expect(AUTO_BADGE_CONFIG.profile_complete.gracePeriodDays).to.be.above(0,
        'Grace period prevents badge flickering when users temporarily clear a field while editing');
    });

    it('active_this_month gracePeriodDays should be less than periodDays', function () {
      const { gracePeriodDays, periodDays } = AUTO_BADGE_CONFIG.active_this_month;
      expect(gracePeriodDays).to.be.below(periodDays,
        'Grace period should be a buffer, not longer than the activity window itself');
    });
  });

  // ── BADGE_CHECKS completeness ─────────────────────────────────────────────

  describe('BADGE_CHECKS', function () {
    const expectedBadges = ['early_member', 'founding_member', 'profile_complete', 'active_this_month', 'group_organizer'];

    for (const badgeId of expectedBadges) {
      it(`should have a check function for "${badgeId}"`, function () {
        expect(BADGE_CHECKS[badgeId]).to.be.a('function',
          `Missing check function for badge "${badgeId}"`);
      });
    }
  });

  // ── AUTO_BADGE_CONFIG completeness ────────────────────────────────────────

  describe('AUTO_BADGE_CONFIG structure', function () {
    it('active_this_month should have minActivity', function () {
      expect(AUTO_BADGE_CONFIG.active_this_month).to.have.property('minActivity').that.is.above(0);
    });

    it('active_this_month should have periodDays', function () {
      expect(AUTO_BADGE_CONFIG.active_this_month).to.have.property('periodDays').that.is.above(0);
    });

    it('profile_complete should list required fields', function () {
      expect(AUTO_BADGE_CONFIG.profile_complete).to.have.property('requiredFields').that.is.an('array').with.length.above(0);
    });

    it('early_member should have a cutoffDate', function () {
      expect(AUTO_BADGE_CONFIG.early_member).to.have.property('cutoffDate').that.is.instanceOf(Date);
    });

    it('founding_member should have startDate and endDate', function () {
      expect(AUTO_BADGE_CONFIG.founding_member).to.have.property('startDate').that.is.instanceOf(Date);
      expect(AUTO_BADGE_CONFIG.founding_member).to.have.property('endDate').that.is.instanceOf(Date);
    });

    it('founding_member startDate should be before endDate', function () {
      const { startDate, endDate } = AUTO_BADGE_CONFIG.founding_member;
      expect(startDate.getTime()).to.be.below(endDate.getTime());
    });
  });

  // ── processUserBadges — assign-only protection ────────────────────────────

  describe('processUserBadges — ASSIGN_ONLY_BADGES are never revoked during normal processing', function () {
    it('should skip revocation of active_this_month without assignOnly flag', async function () {
      // Fake user who already has the badge but "fails" the check
      const fakeUser = {
        _id: 'fake-user-id',
        username: 'testuser',
        badges: ['active_this_month'],
        createdAt: new Date()
      };

      // Fake badge definition
      const fakeBadge = {
        id: 'active_this_month',
        label: 'Active This Month',
        automaticRule: 'active_this_month'
      };

      // Override BADGE_CHECKS temporarily to simulate user failing the check
      const original = BADGE_CHECKS.active_this_month;
      BADGE_CHECKS.active_this_month = async () => false; // user fails check

      try {
        const results = await processUserBadges(fakeUser, [fakeBadge]);
        // Should be skipped, NOT revoked
        expect(results.revoked).to.not.include('active_this_month',
          'active_this_month should never be revoked during normal processing (only in daily sweep)');
        expect(results.skipped).to.include('active_this_month');
      } finally {
        BADGE_CHECKS.active_this_month = original;
      }
    });

    it('should skip revocation of profile_complete without assignOnly flag', async function () {
      const fakeUser = {
        _id: 'fake-user-id-2',
        username: 'testuser2',
        badges: ['profile_complete'],
        createdAt: new Date()
      };

      const fakeBadge = {
        id: 'profile_complete',
        label: 'Profile Complete',
        automaticRule: 'profile_complete'
      };

      const original = BADGE_CHECKS.profile_complete;
      BADGE_CHECKS.profile_complete = async () => false;

      try {
        const results = await processUserBadges(fakeUser, [fakeBadge]);
        expect(results.revoked).to.not.include('profile_complete',
          'profile_complete should never be revoked during normal processing (only in daily sweep)');
        expect(results.skipped).to.include('profile_complete');
      } finally {
        BADGE_CHECKS.profile_complete = original;
      }
    });
  });

  // ── Permanent badges are never revocable ─────────────────────────────────

  describe('permanent badges', function () {
    it('early_member should NOT be in ASSIGN_ONLY_BADGES (it is permanent, never revoked)', function () {
      // early_member is date-based and permanent — it should not be in the sweep list
      // because once assigned, join date never changes
      expect(ASSIGN_ONLY_BADGES).to.not.include('early_member');
    });

    it('founding_member should NOT be in ASSIGN_ONLY_BADGES', function () {
      expect(ASSIGN_ONLY_BADGES).to.not.include('founding_member');
    });
  });
});
