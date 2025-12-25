/**
 * Safe Mode Banner (Conditional)
 * 
 * When Safe Mode auto-activates:
 * - Show calm banner explaining why
 * - Allow dismiss / learn more
 * 
 * Never show unless active.
 */

/**
 * Get Safe Mode banner configuration
 * @param {string} sessionId - Session ID
 * @returns {object|null} Banner configuration or null if not needed
 */
export function getSafeModeBanner(sessionId) {
  const { getSafeModeStatus } = require('./autoSafeMode.js');
  
  const status = getSafeModeStatus(sessionId);
  
  if (!status.enabled) {
    return null;
  }
  
  // Determine banner message based on trigger reason
  let message = 'Safe Mode is active to protect your experience.';
  let details = '';
  let learnMoreUrl = '/help/safe-mode';
  
  switch (status.trigger) {
    case 'auth_failures':
      message = 'Safe Mode activated due to authentication issues.';
      details = 'We\'ve temporarily disabled some features to help stabilize your session.';
      break;
      
    case 'authready_loop':
      message = 'Safe Mode activated to prevent loading loops.';
      details = 'Advanced features are disabled while we resolve the issue.';
      break;
      
    case 'sw_failures':
      message = 'Safe Mode activated due to service worker issues.';
      details = 'Offline features are temporarily disabled.';
      break;
      
    case 'stuck_mutations':
      message = 'Safe Mode activated due to sync issues.';
      details = 'Some features are disabled to prevent data conflicts.';
      break;
      
    case 'offline_thrashing':
      message = 'Safe Mode activated due to connection instability.';
      details = 'We\'ve simplified the experience to work better with your connection.';
      break;
      
    case 'error_clusters':
      message = 'Safe Mode activated due to repeated errors.';
      details = 'Advanced features are disabled to improve stability.';
      break;
      
    case 'user_manual':
      message = 'Safe Mode is enabled.';
      details = 'You can disable it anytime in Settings → Stability.';
      learnMoreUrl = '/settings/stability';
      break;
      
    default:
      message = 'Safe Mode is active.';
      details = 'Some features are temporarily disabled.';
  }
  
  return {
    show: true,
    type: 'info',
    dismissible: status.trigger === 'user_manual',
    message,
    details,
    learnMoreUrl,
    actions: [
      {
        label: 'Learn More',
        action: 'navigate',
        url: learnMoreUrl
      },
      ...(status.trigger === 'user_manual' ? [{
        label: 'Disable Safe Mode',
        action: 'disable_safe_mode',
        url: '/api/stability/safe-mode/toggle'
      }] : [])
    ]
  };
}

/**
 * Check if Safe Mode banner should be shown
 * @param {string} sessionId - Session ID
 * @returns {boolean} True if banner should be shown
 */
export function shouldShowSafeModeBanner(sessionId) {
  const { getSafeModeStatus } = require('./autoSafeMode.js');
  const status = getSafeModeStatus(sessionId);
  return status.enabled;
}

/**
 * Dismiss Safe Mode banner (for user-manual mode only)
 * @param {string} sessionId - Session ID
 * @returns {boolean} True if dismissed successfully
 */
export function dismissSafeModeBanner(sessionId) {
  const { getSafeModeStatus } = require('./autoSafeMode.js');
  const status = getSafeModeStatus(sessionId);
  
  // Only allow dismissal for user-manual mode
  if (status.trigger !== 'user_manual') {
    return false;
  }
  
  // Store dismissal in session storage (frontend will handle)
  return true;
}

/**
 * Get banner style based on severity
 * @param {string} trigger - Trigger reason
 * @returns {object} Style configuration
 */
export function getBannerStyle(trigger) {
  const styles = {
    auth_failures: {
      backgroundColor: '#FFF3CD',
      borderColor: '#FFC107',
      textColor: '#856404',
      icon: '⚠️'
    },
    authready_loop: {
      backgroundColor: '#FFF3CD',
      borderColor: '#FFC107',
      textColor: '#856404',
      icon: '🔄'
    },
    sw_failures: {
      backgroundColor: '#D1ECF1',
      borderColor: '#17A2B8',
      textColor: '#0C5460',
      icon: 'ℹ️'
    },
    stuck_mutations: {
      backgroundColor: '#FFF3CD',
      borderColor: '#FFC107',
      textColor: '#856404',
      icon: '⏸️'
    },
    offline_thrashing: {
      backgroundColor: '#D1ECF1',
      borderColor: '#17A2B8',
      textColor: '#0C5460',
      icon: '📡'
    },
    error_clusters: {
      backgroundColor: '#F8D7DA',
      borderColor: '#DC3545',
      textColor: '#721C24',
      icon: '🛡️'
    },
    user_manual: {
      backgroundColor: '#D1ECF1',
      borderColor: '#17A2B8',
      textColor: '#0C5460',
      icon: '✓'
    }
  };
  
  return styles[trigger] || styles.user_manual;
}

