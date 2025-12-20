import { getSocket } from './socket';
import logger from './logger';

// Re-export getSocket for convenience (components can import from socketHelpers)
export { getSocket };

/**
 * Waits for socket to be initialized and connected, then executes a setup callback.
 * Handles retry logic with configurable interval and max retries.
 *
 * @param {Function} setupCallback - Function to call when socket is ready
 * @param {Object} options - Configuration options
 * @param {number} options.retryInterval - Milliseconds between retries (default: 750ms)
 * @param {number} options.maxRetries - Maximum retry attempts (default: 20, ~15 seconds)
 * @param {Function} options.onTimeout - Callback if max retries exceeded
 * @returns {Function} Cleanup function to cancel pending retries
 *
 * @example
 * const cleanup = setupSocketListeners(() => {
 *   const socket = getSocket();
 *   socket.on('event', handler);
 * });
 *
 * // Later, on component unmount:
 * cleanup();
 */
export function setupSocketListeners(setupCallback, options = {}) {
  const {
    retryInterval = 750,
    maxRetries = 20,
    onTimeout = null
  } = options;

  let retryCount = 0;
  let timeoutId = null;
  let isCancelled = false;

  const checkSocket = () => {
    // If cleanup was called, stop retrying
    if (isCancelled) {
      logger.debug('🛑 Socket retry cancelled');
      return;
    }

    const socket = getSocket();

    if (!socket) {
      retryCount++;
      if (retryCount < maxRetries) {
        logger.debug(`⏳ Socket not initialized yet, retrying in ${retryInterval}ms... (${retryCount}/${maxRetries})`);
        timeoutId = setTimeout(checkSocket, retryInterval);
      } else {
        logger.warn(`⚠️ Socket initialization timed out after ${maxRetries} retries (~${(maxRetries * retryInterval) / 1000}s)`);
        if (onTimeout) onTimeout();
      }
      return;
    }

    logger.debug('✅ Socket found, checking connection status');

    // Set up listeners if already connected, or wait for connection
    if (socket.connected) {
      logger.debug('✅ Socket already connected, setting up listeners');
      setupCallback(socket);
    } else {
      logger.debug('⏳ Socket not connected yet, waiting for connection...');
      const onConnect = () => {
        logger.debug('✅ Socket connected, setting up listeners');
        setupCallback(socket);
      };
      socket.once('connect', onConnect);
    }
  };

  // Start the retry loop
  checkSocket();

  // Return cleanup function
  return () => {
    isCancelled = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
}

/**
 * Simplified version for components that don't need retry logic.
 * Returns socket immediately if available, null otherwise.
 * 
 * @returns {Object|null} Socket instance or null
 * 
 * @example
 * const socket = getSocketOrNull();
 * if (!socket) return;
 * socket.on('event', handler);
 */
export function getSocketOrNull() {
  const socket = getSocket();
  if (!socket) {
    logger.debug('⏳ Socket not initialized yet');
    return null;
  }
  return socket;
}

