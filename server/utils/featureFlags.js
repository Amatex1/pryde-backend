/**
 * Admin Feature Flag View
 * 
 * Admin-only view:
 * - See which features are degraded
 * - See why (telemetry signal)
 * - Override temporarily if needed
 */

// Feature flag state
const featureFlags = new Map();

// Feature degradation reasons
const degradationReasons = new Map();

// Admin overrides
const adminOverrides = new Map();

/**
 * Feature flag configuration
 */
const FEATURES = {
  PWA: {
    name: 'Progressive Web App',
    description: 'Offline support, install prompts, service worker',
    defaultEnabled: true,
    canDegrade: true
  },
  SOCKETS: {
    name: 'WebSockets',
    description: 'Real-time updates and notifications',
    defaultEnabled: true,
    canDegrade: true
  },
  POLLING: {
    name: 'Background Polling',
    description: 'Periodic background updates',
    defaultEnabled: true,
    canDegrade: true
  },
  OPTIMISTIC_UI: {
    name: 'Optimistic UI',
    description: 'Instant UI updates before server confirmation',
    defaultEnabled: true,
    canDegrade: true
  },
  OFFLINE_QUEUE: {
    name: 'Offline Queue',
    description: 'Queue actions when offline',
    defaultEnabled: true,
    canDegrade: true
  },
  PUSH_NOTIFICATIONS: {
    name: 'Push Notifications',
    description: 'Browser push notifications',
    defaultEnabled: true,
    canDegrade: true
  }
};

/**
 * Initialize feature flags
 */
export function initializeFeatureFlags() {
  for (const [key, config] of Object.entries(FEATURES)) {
    featureFlags.set(key, config.defaultEnabled);
  }
}

/**
 * Get all feature flags
 * @returns {Array} Feature flags with status
 */
export function getAllFeatureFlags() {
  const flags = [];
  
  for (const [key, config] of Object.entries(FEATURES)) {
    const enabled = featureFlags.get(key) ?? config.defaultEnabled;
    const override = adminOverrides.get(key);
    const reason = degradationReasons.get(key);
    
    flags.push({
      key,
      name: config.name,
      description: config.description,
      enabled,
      degraded: !enabled && config.canDegrade,
      reason,
      override,
      canDegrade: config.canDegrade
    });
  }
  
  return flags;
}

/**
 * Get feature flag status
 * @param {string} feature - Feature key
 * @returns {boolean} True if feature is enabled
 */
export function isFeatureEnabled(feature) {
  // Check admin override first
  const override = adminOverrides.get(feature);
  if (override !== undefined) {
    return override.enabled;
  }
  
  // Check feature flag
  const enabled = featureFlags.get(feature);
  if (enabled !== undefined) {
    return enabled;
  }
  
  // Fall back to default
  const config = FEATURES[feature];
  return config ? config.defaultEnabled : false;
}

/**
 * Degrade feature
 * @param {string} feature - Feature key
 * @param {string} reason - Reason for degradation
 */
export function degradeFeature(feature, reason) {
  const config = FEATURES[feature];
  if (!config || !config.canDegrade) {
    return false;
  }
  
  featureFlags.set(feature, false);
  degradationReasons.set(feature, {
    reason,
    timestamp: Date.now(),
    source: 'automatic'
  });
  
  console.log(`[Feature Flags] Degraded ${feature}: ${reason}`);
  return true;
}

/**
 * Restore feature
 * @param {string} feature - Feature key
 */
export function restoreFeature(feature) {
  const config = FEATURES[feature];
  if (!config) {
    return false;
  }
  
  featureFlags.set(feature, config.defaultEnabled);
  degradationReasons.delete(feature);
  
  console.log(`[Feature Flags] Restored ${feature}`);
  return true;
}

/**
 * Set admin override
 * @param {string} feature - Feature key
 * @param {boolean} enabled - Override value
 * @param {string} adminId - Admin user ID
 * @param {number} duration - Duration in milliseconds (optional)
 */
export function setAdminOverride(feature, enabled, adminId, duration = null) {
  const config = FEATURES[feature];
  if (!config) {
    return false;
  }
  
  const override = {
    enabled,
    adminId,
    timestamp: Date.now(),
    expiresAt: duration ? Date.now() + duration : null
  };
  
  adminOverrides.set(feature, override);
  
  console.log(`[Feature Flags] Admin ${adminId} set override for ${feature}: ${enabled}`);
  
  // Auto-remove override after duration
  if (duration) {
    setTimeout(() => {
      removeAdminOverride(feature);
    }, duration);
  }
  
  return true;
}

/**
 * Remove admin override
 * @param {string} feature - Feature key
 */
export function removeAdminOverride(feature) {
  adminOverrides.delete(feature);
  console.log(`[Feature Flags] Removed admin override for ${feature}`);
  return true;
}

/**
 * Get degraded features
 * @returns {Array} Degraded features
 */
export function getDegradedFeatures() {
  return getAllFeatureFlags().filter(f => f.degraded);
}

/**
 * Get features with overrides
 * @returns {Array} Features with admin overrides
 */
export function getFeaturesWithOverrides() {
  return getAllFeatureFlags().filter(f => f.override);
}

// Initialize on module load
initializeFeatureFlags();

