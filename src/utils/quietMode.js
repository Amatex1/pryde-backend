/**
 * Quiet Mode Utility Functions
 * Handles manual quiet mode activation
 */

/**
 * Apply quiet mode to the document
 * @param {boolean} isActive - Whether quiet mode should be active
 */
export const applyQuietMode = (isActive) => {
  if (isActive) {
    document.documentElement.setAttribute('data-quiet-mode', 'true');
  } else {
    document.documentElement.removeAttribute('data-quiet-mode');
  }
};

/**
 * Initialize quiet mode on app startup
 * @param {Object} user - User object with privacy settings
 */
export const initializeQuietMode = (user) => {
  if (!user || !user.privacySettings) {
    return;
  }

  const quietModeEnabled = user.privacySettings.quietModeEnabled || false;
  applyQuietMode(quietModeEnabled);

  // Store in localStorage for persistence
  localStorage.setItem('quietMode', quietModeEnabled);

  return quietModeEnabled;
};

