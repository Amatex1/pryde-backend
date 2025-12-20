/**
 * AUTH STATUS STATE MANAGEMENT
 * 
 * Prevents auth lifecycle desynchronization bugs:
 * - Logout is FINAL (no auto-redirect on cookie clear)
 * - /feed cannot load without confirmed auth
 * - Socket connects only when auth is confirmed
 * - Explicit state transitions prevent race conditions
 */

// Auth status enum - explicit states prevent ambiguity
export const AUTH_STATUS = {
  UNKNOWN: "unknown",           // Initial state - auth not yet checked
  AUTHENTICATED: "authenticated", // User is confirmed logged in
  UNAUTHENTICATED: "unauthenticated", // User is confirmed logged out
};

// Global auth state - single source of truth
let currentAuthStatus = AUTH_STATUS.UNKNOWN;
let authListeners = [];

/**
 * Get current auth status
 * @returns {string} Current AUTH_STATUS value
 */
export const getAuthStatus = () => currentAuthStatus;

/**
 * Set auth status and notify listeners
 * @param {string} status - New AUTH_STATUS value
 */
export const setAuthStatus = (status) => {
  if (!Object.values(AUTH_STATUS).includes(status)) {
    console.error(`[AuthStatus] Invalid status: ${status}`);
    return;
  }

  const previousStatus = currentAuthStatus;
  currentAuthStatus = status;

  console.log(`[AuthStatus] ${previousStatus} → ${status}`);

  // Notify all listeners of status change
  authListeners.forEach(listener => {
    try {
      listener(status, previousStatus);
    } catch (error) {
      console.error('[AuthStatus] Listener error:', error);
    }
  });
};

/**
 * Subscribe to auth status changes
 * @param {Function} listener - Callback(newStatus, oldStatus)
 * @returns {Function} Unsubscribe function
 */
export const subscribeToAuthStatus = (listener) => {
  authListeners.push(listener);

  // Return unsubscribe function
  return () => {
    authListeners = authListeners.filter(l => l !== listener);
  };
};

/**
 * Check if user is authenticated
 * @returns {boolean} True if AUTHENTICATED, false otherwise
 */
export const isAuthConfirmed = () => {
  return currentAuthStatus === AUTH_STATUS.AUTHENTICATED;
};

/**
 * Check if user is unauthenticated
 * @returns {boolean} True if UNAUTHENTICATED, false otherwise
 */
export const isUnauthConfirmed = () => {
  return currentAuthStatus === AUTH_STATUS.UNAUTHENTICATED;
};

/**
 * Check if auth status is still unknown
 * @returns {boolean} True if UNKNOWN, false otherwise
 */
export const isAuthUnknown = () => {
  return currentAuthStatus === AUTH_STATUS.UNKNOWN;
};

/**
 * Reset auth status to UNKNOWN (for testing or re-initialization)
 */
export const resetAuthStatus = () => {
  setAuthStatus(AUTH_STATUS.UNKNOWN);
};

/**
 * Mark user as authenticated
 * Call this after successful login or token validation
 */
export const markAuthenticated = () => {
  setAuthStatus(AUTH_STATUS.AUTHENTICATED);
};

/**
 * Mark user as unauthenticated
 * Call this after logout or auth failure
 */
export const markUnauthenticated = () => {
  setAuthStatus(AUTH_STATUS.UNAUTHENTICATED);
};

/**
 * Get human-readable status description
 * @returns {string} Status description
 */
export const getAuthStatusDescription = () => {
  switch (currentAuthStatus) {
    case AUTH_STATUS.UNKNOWN:
      return "Authentication status unknown - checking...";
    case AUTH_STATUS.AUTHENTICATED:
      return "User is authenticated";
    case AUTH_STATUS.UNAUTHENTICATED:
      return "User is not authenticated";
    default:
      return "Invalid auth status";
  }
};

/**
 * Debug helper - get all current state
 * @returns {Object} Current auth state
 */
export const getAuthDebugInfo = () => {
  return {
    status: currentAuthStatus,
    description: getAuthStatusDescription(),
    listenerCount: authListeners.length,
    isAuthenticated: isAuthConfirmed(),
    isUnauthenticated: isUnauthConfirmed(),
    isUnknown: isAuthUnknown(),
  };
};

