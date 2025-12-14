/**
 * Environment-based logging utility
 * Only logs in development mode to avoid console clutter in production
 */

const isDev = import.meta.env.DEV;
const isProd = import.meta.env.PROD;

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
   * Format log message with context
   */
  _formatMessage(message, ...args) {
    const prefix = this.context ? `[${this.context}]` : '';
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
   * Success logs with emoji
   */
  success(message, ...args) {
    if (isDev) {
      console.log('✅', ...this._formatMessage(message, ...args));
    }
  }

  /**
   * Group logs - only in development
   */
  group(label, callback) {
    if (isDev) {
      console.group(label);
      callback();
      console.groupEnd();
    }
  }

  /**
   * Table logs - only in development
   */
  table(data) {
    if (isDev) {
      console.table(data);
    }
  }

  /**
   * Time measurement - only in development
   */
  time(label) {
    if (isDev) {
      console.time(label);
    }
  }

  timeEnd(label) {
    if (isDev) {
      console.timeEnd(label);
    }
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

