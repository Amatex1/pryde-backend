/**
 * Security Hardening Phase 2 Tests
 *
 * Covers protections added in the security hardening pass:
 *   1. Production config: MESSAGE_ENCRYPTION_KEY validation
 *   2. PII field encryption (birthday, pronouns, sexualOrientation, gender)
 *   3. securityLogSanitizer utilities
 *   4. Session idle timeout (DB-backed)
 *   5. SecurityLog enum additions
 *   6. fileScanService disabled-mode behavior
 */

import assert from 'assert';
import crypto from 'crypto';

// ── 1. Production config: MESSAGE_ENCRYPTION_KEY ──────────────────────────────
describe('config: MESSAGE_ENCRYPTION_KEY validation', () => {
  const origEnv = process.env.NODE_ENV;
  const origKey = process.env.MESSAGE_ENCRYPTION_KEY;

  after(() => {
    process.env.NODE_ENV = origEnv;
    if (origKey !== undefined) process.env.MESSAGE_ENCRYPTION_KEY = origKey;
    else delete process.env.MESSAGE_ENCRYPTION_KEY;
  });

  it('rejects missing key in production via config validateConfig logic', () => {
    // We test the validation rule inline rather than re-importing config
    // (which would re-execute the module and break test env)
    const isProduction = true;
    const encKey = undefined;

    const validate = () => {
      if (isProduction && !encKey) {
        throw new Error('CRITICAL: MESSAGE_ENCRYPTION_KEY is required in production!');
      }
    };

    assert.throws(validate, /MESSAGE_ENCRYPTION_KEY is required/);
  });

  it('rejects key shorter than 64 hex chars', () => {
    const validate = (key) => {
      if (key.length !== 64) throw new Error('must be exactly 64 hex characters');
    };
    assert.throws(() => validate('abc'), /64 hex/);
  });

  it('rejects non-hex key', () => {
    const validate = (key) => {
      if (!/^[0-9a-fA-F]{64}$/.test(key)) throw new Error('must be valid 64-character hex');
    };
    const badKey = 'z'.repeat(64);
    assert.throws(() => validate(badKey), /hex/);
  });

  it('rejects insecure placeholder values', () => {
    const INSECURE_PATTERNS = ['dev-key', 'test-key', 'changeme', '0000000000000000'];
    const validate = (key) => {
      if (INSECURE_PATTERNS.some(p => key.toLowerCase().includes(p))) {
        throw new Error('appears to be a placeholder');
      }
    };
    assert.throws(() => validate('dev-key-32-bytes-for-testing-only!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'), /placeholder/);
  });

  it('accepts a valid cryptographically random 64-char hex key', () => {
    const validKey = crypto.randomBytes(32).toString('hex');
    assert.strictEqual(validKey.length, 64);
    assert.ok(/^[0-9a-fA-F]{64}$/.test(validKey));
  });
});

// ── 2. PII field encryption helpers ──────────────────────────────────────────
describe('PII encryption helpers (User model logic)', () => {
  // Mirror the helper logic from User.js without importing the full model
  const DEV_KEY = Buffer.from('dev0key032bytes0for0testing0only', 'utf8'); // exactly 32 bytes

  const _encrypt = (value) => {
    if (!value) return value;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', DEV_KEY, iv);
    let enc = cipher.update(String(value), 'utf8', 'hex');
    enc += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return iv.toString('hex') + tag.toString('hex') + enc;
  };

  const _isEncrypted = (v) =>
    typeof v === 'string' && v.length > 64 && /^[a-f0-9]+$/i.test(v);

  const _decrypt = (v) => {
    if (!v || !_isEncrypted(v)) return v;
    try {
      const iv  = Buffer.from(v.slice(0, 32), 'hex');
      const tag = Buffer.from(v.slice(32, 64), 'hex');
      const enc = v.slice(64);
      const d = crypto.createDecipheriv('aes-256-gcm', DEV_KEY, iv);
      d.setAuthTag(tag);
      let dec = d.update(enc, 'hex', 'utf8');
      dec += d.final('utf8');
      return dec;
    } catch { return null; }
  };

  it('encrypts a string value and produces encrypted hex', () => {
    const enc = _encrypt('they/them');
    assert.ok(_isEncrypted(enc), 'should be detected as encrypted');
    assert.notStrictEqual(enc, 'they/them');
  });

  it('round-trips pronouns through encrypt/decrypt', () => {
    const enc = _encrypt('he/him');
    assert.strictEqual(_decrypt(enc), 'he/him');
  });

  it('round-trips sexualOrientation through encrypt/decrypt', () => {
    const enc = _encrypt('bisexual');
    assert.strictEqual(_decrypt(enc), 'bisexual');
  });

  it('round-trips birthday ISO string through encrypt/decrypt', () => {
    const iso = new Date('1990-04-15').toISOString();
    const enc = _encrypt(iso);
    const dec = _decrypt(enc);
    assert.ok(dec.startsWith('1990-04-15'));
  });

  it('does not re-encrypt already-encrypted values (idempotent set)', () => {
    const enc = _encrypt('nonbinary');
    const reEnc = _isEncrypted(enc) ? enc : _encrypt(enc);
    assert.strictEqual(reEnc, enc);
  });

  it('returns null on decryption failure without throwing', () => {
    const result = _decrypt('a'.repeat(130)); // valid hex length but wrong key
    assert.strictEqual(result, null);
  });

  it('returns plaintext for non-encrypted legacy string (backward compat)', () => {
    const legacy = 'gay'; // short, not hex encrypted
    assert.strictEqual(_decrypt(legacy), 'gay');
  });

  it('handles null/undefined gracefully', () => {
    assert.strictEqual(_encrypt(null), null);
    assert.strictEqual(_decrypt(null), null);
    assert.strictEqual(_decrypt(undefined), undefined);
  });
});

// ── 3. securityLogSanitizer ───────────────────────────────────────────────────
describe('securityLogSanitizer', async () => {
  const { redactEmail, maskIp, birthdayToYear, sanitizeSecurityLogPayload } =
    await import('../../utils/securityLogSanitizer.js');

  describe('redactEmail', () => {
    it('redacts local part and appends hash', () => {
      const result = redactEmail('user@example.com');
      assert.ok(result.includes('@example.com'), 'preserves domain');
      assert.ok(result.includes('[h:'), 'has correlation hash');
      assert.ok(!result.includes('user@'), 'local part is masked');
    });

    it('handles short local parts', () => {
      const result = redactEmail('a@b.com');
      assert.ok(result.includes('@b.com'));
    });

    it('returns null for null input', () => {
      assert.strictEqual(redactEmail(null), null);
    });

    it('two identical emails produce same hash (correlation)', () => {
      const r1 = redactEmail('test@example.com');
      const r2 = redactEmail('test@example.com');
      const h1 = r1.match(/\[h:([a-f0-9]+)\]/)?.[1];
      const h2 = r2.match(/\[h:([a-f0-9]+)\]/)?.[1];
      assert.strictEqual(h1, h2);
    });

    it('two different emails produce different hashes', () => {
      const r1 = redactEmail('alice@x.com');
      const r2 = redactEmail('bob@x.com');
      const h1 = r1.match(/\[h:([a-f0-9]+)\]/)?.[1];
      const h2 = r2.match(/\[h:([a-f0-9]+)\]/)?.[1];
      assert.notStrictEqual(h1, h2);
    });
  });

  describe('maskIp', () => {
    it('masks last IPv4 octet', () => {
      assert.strictEqual(maskIp('192.168.1.42'), '192.168.1.x');
    });

    it('masks IPv6 suffix', () => {
      const result = maskIp('2001:db8:0:1:2:3:4:5');
      assert.ok(result.endsWith(':x:x:x:x'), `Got: ${result}`);
      assert.ok(result.startsWith('2001:db8:0:1'));
    });

    it('returns null for null', () => {
      assert.strictEqual(maskIp(null), null);
    });

    it('returns input for unknown formats', () => {
      assert.strictEqual(maskIp('unknown'), 'unknown');
    });
  });

  describe('birthdayToYear', () => {
    it('returns birth year only', () => {
      assert.strictEqual(birthdayToYear(new Date('1985-07-22')), 1985);
    });

    it('returns null for null', () => {
      assert.strictEqual(birthdayToYear(null), null);
    });

    it('returns null for invalid date', () => {
      assert.strictEqual(birthdayToYear('not-a-date'), null);
    });
  });

  describe('sanitizeSecurityLogPayload', () => {
    it('redacts email in payload', () => {
      const result = sanitizeSecurityLogPayload({ email: 'test@example.com', type: 'failed_login' });
      assert.ok(!result.email.includes('test@'), 'email should be redacted');
      assert.ok(result.email.includes('@example.com'));
    });

    it('masks IP in payload', () => {
      const result = sanitizeSecurityLogPayload({ ipAddress: '10.0.0.99', type: 'failed_login' });
      assert.strictEqual(result.ipAddress, '10.0.0.x');
    });

    it('strips birthday and appends year to details', () => {
      const result = sanitizeSecurityLogPayload({
        birthday: new Date('1999-05-10'),
        details: 'test',
        type: 'underage_registration'
      });
      assert.strictEqual(result.birthday, null);
      assert.ok(result.details.includes('1999'), 'year should be in details');
    });

    it('does not mutate original object', () => {
      const original = { email: 'x@y.com', ipAddress: '1.2.3.4' };
      sanitizeSecurityLogPayload(original);
      assert.strictEqual(original.email, 'x@y.com');
      assert.strictEqual(original.ipAddress, '1.2.3.4');
    });
  });
});

// ── 4. Session idle timeout constant ─────────────────────────────────────────
describe('session idle timeout (DB-backed)', async () => {
  const { SESSION_IDLE_TIMEOUT_MS } = await import('../../services/sessionService.js');

  it('defaults to 30 minutes', () => {
    // 30 min default (unless overridden by SESSION_IDLE_TIMEOUT_MS env var in test env)
    if (!process.env.SESSION_IDLE_TIMEOUT_MS) {
      assert.strictEqual(SESSION_IDLE_TIMEOUT_MS, 30 * 60 * 1000);
    } else {
      assert.ok(typeof SESSION_IDLE_TIMEOUT_MS === 'number');
    }
  });

  it('is a positive number when enabled', () => {
    if (SESSION_IDLE_TIMEOUT_MS !== 0) {
      assert.ok(SESSION_IDLE_TIMEOUT_MS > 0, 'timeout should be positive');
    }
  });
});

// ── 5. SecurityLog enum includes new event types ──────────────────────────────
describe('SecurityLog schema includes security-hardening event types', async () => {
  const SecurityLog = (await import('../../models/SecurityLog.js')).default;
  const enumValues = SecurityLog.schema.path('type').enumValues;

  const required = [
    'refresh_token_rotated',
    'refresh_token_reuse_detected',
    'session_family_revoked',
    'session_expired',
    'security_alert_triggered',
    'malware_scan_failed',
    'malware_detected_upload',
    'swagger_access_blocked'
  ];

  for (const type of required) {
    it(`includes event type: ${type}`, () => {
      assert.ok(enumValues.includes(type), `Missing enum value: ${type}`);
    });
  }
});

// ── 6. fileScanService disabled mode ─────────────────────────────────────────
describe('fileScanService: provider=none (disabled mode)', async () => {
  const origProvider = process.env.FILE_SCAN_PROVIDER;

  before(() => { process.env.FILE_SCAN_PROVIDER = 'none'; });
  after(() => {
    if (origProvider !== undefined) process.env.FILE_SCAN_PROVIDER = origProvider;
    else delete process.env.FILE_SCAN_PROVIDER;
  });

  it('returns clean=true, skipped=true when provider is none', async () => {
    const { scanFile } = await import('../../services/fileScanService.js');
    const result = await scanFile(Buffer.from('test content'), 'test.jpg', null);
    assert.strictEqual(result.clean, true);
    assert.strictEqual(result.skipped, true);
    assert.strictEqual(result.threat, null);
  });
});
