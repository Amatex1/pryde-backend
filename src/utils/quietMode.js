/**
 * Quiet Mode Utility Functions
 * Handles manual and automatic quiet mode activation
 */

/**
 * Check if current time is within quiet hours (21:00-06:00 local time)
 * @returns {boolean} True if within quiet hours
 */
export const isQuietHours = () => {
  const now = new Date();
  const hour = now.getHours();
  
  // Quiet hours: 21:00 (9 PM) to 06:00 (6 AM)
  return hour >= 21 || hour < 6;
};

/**
 * Determine if Quiet Mode should be active
 * @param {boolean} manualQuietMode - User's manual quiet mode setting
 * @param {boolean} autoQuietHoursEnabled - Whether auto quiet hours is enabled
 * @returns {boolean} True if quiet mode should be active
 */
export const shouldQuietModeBeActive = (manualQuietMode, autoQuietHoursEnabled) => {
  // Manual quiet mode takes precedence
  if (manualQuietMode) {
    return true;
  }
  
  // If auto quiet hours is enabled and we're in quiet hours
  if (autoQuietHoursEnabled && isQuietHours()) {
    return true;
  }
  
  return false;
};

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

  const manualQuietMode = user.privacySettings.quietModeEnabled || false;
  const autoQuietHours = user.privacySettings.autoQuietHoursEnabled !== false; // Default true
  
  const isActive = shouldQuietModeBeActive(manualQuietMode, autoQuietHours);
  applyQuietMode(isActive);
  
  // Store in localStorage for persistence
  localStorage.setItem('quietMode', manualQuietMode);
  localStorage.setItem('autoQuietHours', autoQuietHours);
  
  return isActive;
};

/**
 * Get quiet hours time range as formatted string
 * @returns {string} Formatted time range
 */
export const getQuietHoursRange = () => {
  return '9:00 PM – 6:00 AM';
};

/**
 * Check if we're currently in quiet hours and return status message
 * @returns {Object} Status object with isActive and message
 */
export const getQuietHoursStatus = () => {
  const inQuietHours = isQuietHours();
  const now = new Date();
  const hour = now.getHours();
  
  if (inQuietHours) {
    if (hour >= 21) {
      return {
        isActive: true,
        message: 'Quiet Hours are currently active (until 6:00 AM)'
      };
    } else {
      return {
        isActive: true,
        message: 'Quiet Hours are currently active (until 6:00 AM)'
      };
    }
  } else {
    const hoursUntilQuiet = 21 - hour;
    return {
      isActive: false,
      message: `Quiet Hours will begin in ${hoursUntilQuiet} hour${hoursUntilQuiet !== 1 ? 's' : ''} (at 9:00 PM)`
    };
  }
};

