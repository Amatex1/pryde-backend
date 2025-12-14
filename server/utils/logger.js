/**
 * Environment-based logging utility for backend
 * Only logs debug/info in development mode
 */

const isDev = process.env.NODE_ENV === 'development';
const isProd = process.env.NODE_ENV === 'production';

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
   * Warning logs - always shown
   */
  warn(message, ...args) {
    console.warn(...this._formatMessage(message, ...args));
  }

  /**
   * Error logs - always shown
   */
  error(message, ...args) {
    console.error(...this._formatMessage(message, ...args));
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
   * Security logs - always shown
   */
  security(message, ...args) {
    console.log('🔒', ...this._formatMessage(message, ...args));
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

