/**
 * Unit Tests: Weekly Themes Job
 *
 * Tests pure functions — no DB required.
 *
 * Catches:
 *   - Wrong export names (runWeeklyThemesJob vs runWeeklyTheme)
 *   - Wrong field names (topic vs title)
 *   - Theme rotation logic
 *   - getUpcomingThemes not including current theme
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';

let weeklyThemesJob;
let getUpcomingThemes;
let runWeeklyTheme;
let createWeeklyThemePost;
let WEEKLY_THEMES;

describe('Weekly Themes Job', function () {
  before(async function () {
    const mod = await import('../../jobs/weeklyThemesJob.js');
    weeklyThemesJob = mod.default;
    getUpcomingThemes = mod.getUpcomingThemes;
    runWeeklyTheme = mod.runWeeklyTheme;
    createWeeklyThemePost = mod.createWeeklyThemePost;
    WEEKLY_THEMES = weeklyThemesJob.WEEKLY_THEMES;
  });

  // ── Named exports ────────────────────────────────────────────────────────

  describe('exports', function () {
    it('should export runWeeklyTheme (not runWeeklyThemesJob)', function () {
      expect(runWeeklyTheme).to.be.a('function',
        'runWeeklyTheme must be a named export — server.js cron imports it by this name');
    });

    it('should export getUpcomingThemes', function () {
      expect(getUpcomingThemes).to.be.a('function');
    });

    it('should export createWeeklyThemePost', function () {
      expect(createWeeklyThemePost).to.be.a('function');
    });

    it('should expose WEEKLY_THEMES via default export', function () {
      expect(weeklyThemesJob.WEEKLY_THEMES).to.be.an('array').with.length.above(0);
    });

    it('should expose getWeeklyTheme via default export', function () {
      expect(weeklyThemesJob.getWeeklyTheme).to.be.a('function',
        'getWeeklyTheme must be on the default export — community.js route uses it');
    });
  });

  // ── Theme object shape ────────────────────────────────────────────────────

  describe('WEEKLY_THEMES shape', function () {
    it('every theme should have an id', function () {
      for (const theme of WEEKLY_THEMES) {
        expect(theme).to.have.property('id').that.is.a('string').with.length.above(0);
      }
    });

    it('every theme should have a title (not topic)', function () {
      for (const theme of WEEKLY_THEMES) {
        expect(theme.title, `theme "${theme.id}" is missing "title" — frontend renders theme.title`).to.be.a('string').with.length.above(0);
        expect(theme.topic, `theme "${theme.id}" has "topic" but frontend expects "title"`).to.be.undefined;
      }
    });

    it('every theme should have an emoji', function () {
      for (const theme of WEEKLY_THEMES) {
        expect(theme).to.have.property('emoji').that.is.a('string').with.length.above(0);
      }
    });

    it('every theme should have a prompt', function () {
      for (const theme of WEEKLY_THEMES) {
        expect(theme).to.have.property('prompt').that.is.a('string').with.length.above(0);
      }
    });
  });

  // ── getWeeklyTheme ────────────────────────────────────────────────────────

  describe('getWeeklyTheme()', function () {
    it('should return a valid theme object', function () {
      const theme = weeklyThemesJob.getWeeklyTheme();
      expect(theme).to.be.an('object');
      expect(theme).to.have.property('id');
      expect(theme).to.have.property('title');
      expect(theme).to.have.property('emoji');
    });

    it('should return the same theme when called multiple times in the same week', function () {
      const a = weeklyThemesJob.getWeeklyTheme();
      const b = weeklyThemesJob.getWeeklyTheme();
      expect(a.id).to.equal(b.id);
    });

    it('should return a theme that exists in WEEKLY_THEMES', function () {
      const current = weeklyThemesJob.getWeeklyTheme();
      const ids = WEEKLY_THEMES.map(t => t.id);
      expect(ids).to.include(current.id);
    });
  });

  // ── getUpcomingThemes ─────────────────────────────────────────────────────

  describe('getUpcomingThemes()', function () {
    it('should return the requested number of themes', function () {
      expect(getUpcomingThemes(3)).to.have.lengthOf(3);
      expect(getUpcomingThemes(4)).to.have.lengthOf(4);
    });

    it('should not include the current week theme', function () {
      const current = weeklyThemesJob.getWeeklyTheme();
      const upcoming = getUpcomingThemes(4);
      const ids = upcoming.map(t => t.id);
      expect(ids).to.not.include(current.id,
        'getUpcomingThemes should return FUTURE themes, not the current one');
    });

    it('should return themes with title and emoji fields', function () {
      const upcoming = getUpcomingThemes(3);
      for (const theme of upcoming) {
        expect(theme).to.have.property('title');
        expect(theme).to.have.property('emoji');
      }
    });
  });

  // ── Community route contract ──────────────────────────────────────────────

  describe('community /themes API contract', function () {
    it('combining current + upcoming(3) gives 4 themes', function () {
      const current = weeklyThemesJob.getWeeklyTheme();
      const upcoming = getUpcomingThemes(3);
      const themes = [current, ...upcoming];
      expect(themes).to.have.lengthOf(4);
    });

    it('first theme in combined list is the current week', function () {
      const current = weeklyThemesJob.getWeeklyTheme();
      const themes = [current, ...getUpcomingThemes(3)];
      expect(themes[0].id).to.equal(current.id);
    });
  });
});
