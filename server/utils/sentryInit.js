/**
 * Sentry error monitoring — production only, privacy-safe
 *
 * Rules:
 * - Only initialises when SENTRY_DSN is set AND NODE_ENV is production
 * - Request bodies are always redacted
 * - Authorization / Cookie headers are stripped before sending
 * - User context = userId only (no email, no username)
 */
import * as Sentry from '@sentry/node';

const isProduction = process.env.NODE_ENV === 'production';

const SENSITIVE_HEADERS = new Set([
  'authorization', 'cookie', 'set-cookie',
  'x-csrf-token', 'x-refresh-token', 'x-auth-token'
]);

function redactHeaders(headers) {
  if (!headers || typeof headers !== 'object') return headers;
  const safe = {};
  for (const [key, value] of Object.entries(headers)) {
    safe[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? '[redacted]' : value;
  }
  return safe;
}

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || !isProduction) return;

  Sentry.init({
    dsn,
    environment: 'production',

    // 10% of transactions — minimal overhead
    tracesSampleRate: 0.1,

    beforeSend(event) {
      if (event.request) {
        // Strip sensitive headers
        if (event.request.headers) {
          event.request.headers = redactHeaders(event.request.headers);
        }
        // Never send request body (may contain passwords, messages, tokens)
        if (event.request.data !== undefined) {
          event.request.data = '[redacted]';
        }
        // Never send cookies
        if (event.request.cookies !== undefined) {
          event.request.cookies = '[redacted]';
        }
      }

      // Strip extra user context — keep userId only
      if (event.user) {
        const { id } = event.user;
        event.user = id ? { id } : null;
      }

      return event;
    },
  });

  console.log('✅ Sentry initialised for production error monitoring');
}

export { Sentry };
