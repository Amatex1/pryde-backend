/**
 * Environment-based logging utility for backend
 * Only logs debug/info in development mode
 * Production error logs are redacted to prevent PII leakage
 */

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

/**
 * Log levels
 */
const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
};

/**
 * Logger class with environment-aware logging
 */
class Logger {
  constructor(context = '') {
    this.context = context;
  }

  /**
   * Format log message with context and timestamp
   */
  _formatMessage(message, ...args) {
    const timestamp = new Date().toISOString();
    const prefix = this.context ? `[${timestamp}] [${this.context}]` : `[${timestamp}]`;
    return [prefix, message, ...args].filter(Boolean);
  }

  /**
   * Debug logs - only in development
   */
  debug(message, ...args) {
    if (isDev) {
      console.log(...this._formatMessage(message, ...args));
    }
  }

  /**
   * Info logs - only in development
   */
  info(message, ...args) {
    if (isDev) {
      console.info(...this._formatMessage(message, ...args));
    }
  }

  /**
   * Warning logs - always shown, redacted in production
   */
  warn(message, ...args) {
    console.warn(...this._formatMessage(redact(message), ...args.map(redact)));
  }

  /**
   * Error logs - always shown, redacted in production
   */
  error(message, ...args) {
    console.error(...this._formatMessage(redact(message), ...args.map(redact)));
  }

  /**
   * Socket-specific logs with emoji
   */
  socket(message, ...args) {
    if (isDev) {
      console.log('🔌', ...this._formatMessage(message, ...args));
    }
  }

  /**
   * API-specific logs with emoji
   */
  api(message, ...args) {
    if (isDev) {
      console.log('📡', ...this._formatMessage(message, ...args));
    }
  }

  /**
   * Database-specific logs with emoji
   */
  db(message, ...args) {
    if (isDev) {
      console.log('💾', ...this._formatMessage(message, ...args));
    }
  }

  /**
   * Auth-specific logs with emoji
   */
  auth(message, ...args) {
    if (isDev) {
      console.log('🔐', ...this._formatMessage(message, ...args));
    }
  }

  /**
   * Success logs with emoji
   */
  success(message, ...args) {
    if (isDev) {
      console.log('✅', ...this._formatMessage(message, ...args));
    }
  }

  /**
   * Security logs - always shown, redacted in production
   */
  security(message, ...args) {
    console.log('🔒', ...this._formatMessage(redact(message), ...args.map(redact)));
  }
}

/**
 * Create logger instance with optional context
 */
export const createLogger = (context) => new Logger(context);

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Export log level constants
 */
export { LogLevel };

/**
 * Convenience exports for common use cases
 */
export default logger;

