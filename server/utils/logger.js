/**
 * Structured logging utility
 *
 * - Production: outputs structured JSON via Pino (machine-readable for log aggregators)
 * - Development: human-readable console output with context labels
 *
 * PII redaction applies in production for error/warn messages.
 */

import pino from 'pino';

const isDev = process.env.NODE_ENV === 'development';
const isProd = process.env.NODE_ENV === 'production';

// Patterns that may contain PII — redacted in production error logs
const PII_PATTERNS = [
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[email]' },
  { pattern: /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*/g, replacement: 'Bearer [token]' },
  { pattern: /"password"\s*:\s*"[^"]*"/g, replacement: '"password":"[redacted]"' },
  { pattern: /'password'\s*:\s*'[^']*'/g, replacement: "'password':'[redacted]'" },
  { pattern: /password=[^&\s]*/gi, replacement: 'password=[redacted]' },
  { pattern: /token=[^&\s]*/gi, replacement: 'token=[redacted]' },
];

function redact(value) {
  if (!isProd) return value;
  if (typeof value === 'string') {
    return PII_PATTERNS.reduce((str, { pattern, replacement }) => str.replace(pattern, replacement), value);
  }
  if (value instanceof Error) {
    const redacted = new Error(redact(value.message));
    redacted.stack = value.stack ? redact(value.stack) : undefined;
    return redacted;
  }
  if (value && typeof value === 'object') {
    try {
      return JSON.parse(redact(JSON.stringify(value)));
    } catch {
      return '[unserializable object]';
    }
  }
  return value;
}

// Pino instance — JSON in production, pretty in development
const pinoLogger = pino({
  level: process.env.LOG_LEVEL || (isProd ? 'warn' : 'debug'),
  ...(isDev && {
    transport: {
      target: 'pino/file',
      options: { destination: 1 }, // stdout
    },
  }),
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
    censor: '[redacted]',
  },
  base: {
    pid: process.pid,
    env: process.env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
};

/**
 * Logger class — same interface as before, backed by Pino in production.
 */
class Logger {
  constructor(context = '') {
    this.context = context;
    this._pino = context ? pinoLogger.child({ context }) : pinoLogger;
  }

  _fmt(message, args) {
    const extra = args.length === 1 && typeof args[0] === 'object' ? args[0] : args.length ? { args } : {};
    return [extra, String(message)];
  }

  debug(message, ...args) {
    if (isDev) this._pino.debug(...this._fmt(message, args));
  }

  info(message, ...args) {
    if (isDev) this._pino.info(...this._fmt(message, args));
  }

  warn(message, ...args) {
    this._pino.warn(...this._fmt(redact(message), args.map(redact)));
  }

  error(message, ...args) {
    this._pino.error(...this._fmt(redact(message), args.map(redact)));
  }

  socket(message, ...args) {
    if (isDev) this._pino.debug({ subsystem: 'socket' }, String(message));
  }

  api(message, ...args) {
    if (isDev) this._pino.debug({ subsystem: 'api' }, String(message));
  }

  db(message, ...args) {
    if (isDev) this._pino.debug({ subsystem: 'db' }, String(message));
  }

  auth(message, ...args) {
    if (isDev) this._pino.debug({ subsystem: 'auth' }, String(message));
  }

  success(message, ...args) {
    if (isDev) this._pino.info({ subsystem: 'success' }, String(message));
  }

  security(message, ...args) {
    this._pino.warn({ subsystem: 'security' }, String(redact(message)));
  }
}

export const createLogger = (context) => new Logger(context);
export const logger = new Logger();

/**
 * pino-http middleware for request-level structured logging.
 * Mount early in server.js: app.use(httpLogger)
 */
export { pinoLogger };

export default logger;
