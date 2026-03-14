import crypto from 'crypto';

/**
 * Security Log PII Sanitizer
 *
 * Reduces plaintext PII exposure in SecurityLog documents while preserving
 * investigation utility. Strategy per field:
 *
 *   email     → redacted display + consistent hash for correlation (e.g., u***@domain.com | hash:a3f2…)
 *   ipAddress → last octet masked for IPv4, last 64 bits masked for IPv6
 *   birthday  → year-only (removes month/day so exact DOB is not logged)
 *
 * Callers can still correlate events by email hash without storing the full address.
 */

// ── Email ─────────────────────────────────────────────────────────────────────

/**
 * Redact an email for display and attach a short correlation hash.
 * e.g.  "user@example.com" → "u***@example.com [h:a3f2b1]"
 * @param {string|null} email
 * @returns {string|null}
 */
export function redactEmail(email) {
  if (!email || typeof email !== 'string') return email;

  const atIdx = email.indexOf('@');
  if (atIdx < 1) return '[redacted]';

  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx); // includes @
  const masked = local.length <= 2
    ? local[0] + '*'.repeat(local.length - 1)
    : local[0] + '***';

  // Short 6-char hex hash — enough for cross-event correlation, not for reverse lookup
  const hash = crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex').slice(0, 6);
  return `${masked}${domain} [h:${hash}]`;
}

/**
 * Return a short correlation hash for an email without exposing the address.
 * Useful when you only need the hash for joining events.
 * @param {string|null} email
 * @returns {string|null}
 */
export function hashEmail(email) {
  if (!email || typeof email !== 'string') return null;
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex').slice(0, 16);
}

// ── IP Address ────────────────────────────────────────────────────────────────

/**
 * Mask the last octet of an IPv4 address, or last 64 bits of IPv6.
 * Preserves network-level information for abuse investigation.
 * e.g. "192.168.1.42" → "192.168.1.x"
 *      "2001:db8::1"  → "2001:db8::x"
 * @param {string|null} ip
 * @returns {string|null}
 */
export function maskIp(ip) {
  if (!ip || typeof ip !== 'string') return ip;

  // IPv4
  const v4 = ip.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);
  if (v4) return `${v4[1]}.x`;

  // IPv6 — keep first 4 groups (64 bits), mask the rest
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 4) {
      return parts.slice(0, 4).join(':') + ':x:x:x:x';
    }
    return ip.slice(0, 19) + ':x';
  }

  return ip; // Unknown format — return as-is
}

// ── Birthday ──────────────────────────────────────────────────────────────────

/**
 * Reduce a birthday Date to year-only to avoid storing exact DOB in logs.
 * e.g. Date(1990-04-15) → 1990
 * @param {Date|null} birthday
 * @returns {number|null}
 */
export function birthdayToYear(birthday) {
  if (!birthday) return null;
  const d = birthday instanceof Date ? birthday : new Date(birthday);
  if (isNaN(d.getTime())) return null;
  return d.getFullYear();
}

// ── Convenience: sanitize a full SecurityLog payload ─────────────────────────

/**
 * Apply all sanitization rules to a SecurityLog data object before creating it.
 * Returns a new object — does not mutate the original.
 *
 * @param {Object} logData - Raw log payload
 * @returns {Object} Sanitized log payload
 */
export function sanitizeSecurityLogPayload(logData) {
  const sanitized = { ...logData };

  if (sanitized.email !== undefined) {
    sanitized.email = redactEmail(sanitized.email);
  }

  if (sanitized.ipAddress !== undefined) {
    sanitized.ipAddress = maskIp(sanitized.ipAddress);
  }

  if (sanitized.birthday !== undefined) {
    const year = birthdayToYear(sanitized.birthday);
    // Store year as a number in the birthday field; SecurityLog schema accepts Date or null,
    // so we move it to details and null the birthday field to avoid schema mismatch.
    sanitized.birthday = null;
    if (year && sanitized.details) {
      sanitized.details = `[birth year: ${year}] ${sanitized.details}`;
    } else if (year) {
      sanitized.details = `[birth year: ${year}]`;
    }
  }

  return sanitized;
}

export default {
  redactEmail,
  hashEmail,
  maskIp,
  birthdayToYear,
  sanitizeSecurityLogPayload
};
