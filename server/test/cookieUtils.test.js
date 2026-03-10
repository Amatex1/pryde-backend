import { afterEach, describe, it } from 'mocha';
import { strict as assert } from 'assert';
import config from '../config/config.js';
import {
  clearRefreshTokenCookies,
  getClearCookieOptions,
  getRefreshTokenCookieOptions,
  normalizeCookieDomain
} from '../utils/cookieUtils.js';

const originalConfig = {
  nodeEnv: config.nodeEnv,
  rootDomain: config.rootDomain,
  refreshTokenExpiry: config.refreshTokenExpiry
};

afterEach(() => {
  config.nodeEnv = originalConfig.nodeEnv;
  config.rootDomain = originalConfig.rootDomain;
  config.refreshTokenExpiry = originalConfig.refreshTokenExpiry;
});

describe('cookieUtils', function() {
  it('normalizes full URL ROOT_DOMAIN values to a bare hostname', function() {
    assert.equal(normalizeCookieDomain('https://prydeapp.com'), 'prydeapp.com');
    assert.equal(normalizeCookieDomain('https://prydeapp.com:443/auth'), 'prydeapp.com');
    assert.equal(normalizeCookieDomain('.prydeapp.com/'), 'prydeapp.com');
  });

  it('omits the cookie domain when ROOT_DOMAIN is invalid', function() {
    config.nodeEnv = 'production';
    config.rootDomain = 'https://';

    const options = getRefreshTokenCookieOptions();
    assert.ok(!('domain' in options));
  });

  it('uses the same normalized domain for set and clear cookie options', function() {
    config.nodeEnv = 'production';
    config.rootDomain = 'https://prydeapp.com/';
    config.refreshTokenExpiry = '30d';

    const setOptions = getRefreshTokenCookieOptions();
    const clearOptions = getClearCookieOptions();

    assert.equal(setOptions.domain, '.prydeapp.com');
    assert.equal(clearOptions.domain, '.prydeapp.com');
    assert.equal(setOptions.sameSite, 'none');
    assert.equal(clearOptions.sameSite, 'none');
    assert.equal(setOptions.httpOnly, true);
    assert.equal(clearOptions.httpOnly, true);
  });

  it('does not set a shared cookie domain outside production', function() {
    config.nodeEnv = 'test';
    config.rootDomain = 'https://prydeapp.com';

    const options = getRefreshTokenCookieOptions();
    assert.ok(!('domain' in options));
    assert.equal(options.sameSite, 'lax');
  });

  it('clears both legacy host-only and shared-domain refresh cookies in production', function() {
    config.nodeEnv = 'production';
    config.rootDomain = 'prydeapp.com';

    const calls = [];
    const res = {
      clearCookie(name, options) {
        calls.push({ name, options });
      }
    };

    clearRefreshTokenCookies(res);

    assert.equal(calls.length, 2);
    assert.equal(calls[0].name, 'refreshToken');
    assert.ok(!('domain' in calls[0].options));
    assert.equal(calls[1].name, 'refreshToken');
    assert.equal(calls[1].options.domain, '.prydeapp.com');
    assert.equal(calls[1].options.sameSite, 'none');
  });

  it('only clears the host-only refresh cookie when no shared domain is configured', function() {
    config.nodeEnv = 'test';
    config.rootDomain = 'prydeapp.com';

    const calls = [];
    const res = {
      clearCookie(name, options) {
        calls.push({ name, options });
      }
    };

    clearRefreshTokenCookies(res);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, 'refreshToken');
    assert.ok(!('domain' in calls[0].options));
    assert.equal(calls[0].options.sameSite, 'lax');
  });
});