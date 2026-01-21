import crypto from 'crypto';

// Generate unique session ID
export function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

// Get IP geolocation data
export async function getIpGeolocation(ipAddress) {
  // Skip geolocation for local/private IPs
  if (!ipAddress ||
      ipAddress === 'Unknown' ||
      ipAddress.startsWith('127.') ||
      ipAddress.startsWith('192.168.') ||
      ipAddress.startsWith('10.') ||
      ipAddress === '::1' ||
      ipAddress === 'localhost') {
    return {
      country: '',
      countryCode: '', // ISO 3166-1 alpha-2 code for SafetyWarning
      region: '',
      city: ''
    };
  }

  try {
    // Use ipapi.co - free tier, no API key required
    // Rate limit: 1,000 requests/day for free tier
    const response = await fetch(`https://ipapi.co/${ipAddress}/json/`, {
      headers: {
        'User-Agent': 'Pryde-Social-Backend/1.0'
      },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    if (!response.ok) {
      console.warn(`IP geolocation API returned ${response.status} for IP ${ipAddress}`);
      return { country: '', countryCode: '', region: '', city: '' };
    }

    const data = await response.json();

    // Check for API error response
    if (data.error) {
      console.warn(`IP geolocation API error for IP ${ipAddress}:`, data.reason);
      return { country: '', countryCode: '', region: '', city: '' };
    }

    return {
      country: data.country_name || '',
      countryCode: data.country_code || '', // ISO 3166-1 alpha-2 code for SafetyWarning
      region: data.region || '',
      city: data.city || ''
    };
  } catch (error) {
    // Don't fail login if geolocation fails
    console.warn(`Failed to get geolocation for IP ${ipAddress}:`, error.message);
    return {
      country: '',
      countryCode: '',
      region: '',
      city: ''
    };
  }
}

// Parse user agent to extract device info
export function parseUserAgent(userAgent) {
  if (!userAgent) {
    return {
      browser: 'Unknown',
      os: 'Unknown',
      deviceInfo: 'Unknown Device'
    };
  }

  let browser = 'Unknown';
  let os = 'Unknown';

  // Detect browser
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    browser = 'Chrome';
  } else if (userAgent.includes('Firefox')) {
    browser = 'Firefox';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browser = 'Safari';
  } else if (userAgent.includes('Edg')) {
    browser = 'Edge';
  } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
    browser = 'Opera';
  }

  // Detect OS
  if (userAgent.includes('Windows')) {
    os = 'Windows';
  } else if (userAgent.includes('Mac OS X')) {
    os = 'macOS';
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
  } else if (userAgent.includes('Android')) {
    os = 'Android';
  } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    os = 'iOS';
  }

  const deviceInfo = `${browser} on ${os}`;

  return { browser, os, deviceInfo };
}

// Get client IP address (handles proxies)
export function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         'Unknown';
}

// Check if this is a new device (for login alerts)
export function isNewDevice(user, ipAddress, deviceInfo) {
  if (!user.loginHistory || user.loginHistory.length === 0) {
    return true; // First login, definitely new device
  }

  // Check if IP address has been used before
  const knownIp = user.loginHistory.some(login =>
    login.success && login.ipAddress === ipAddress
  );

  // Check if device has been used before
  const knownDevice = user.loginHistory.some(login =>
    login.success && login.deviceInfo === deviceInfo
  );

  // Check if this is a trusted device
  const trustedDevice = user.trustedDevices?.some(device =>
    device.ipAddress === ipAddress || device.deviceInfo === deviceInfo
  );

  // New device if BOTH IP and device are unknown and not trusted
  return !knownIp && !knownDevice && !trustedDevice;
}

// Check if login is suspicious
export function isSuspiciousLogin(user, ipAddress, deviceInfo, currentLocation = null) {
  if (!user.loginHistory || user.loginHistory.length === 0) {
    return false; // First login, not suspicious
  }

  // Check if IP address has been used before
  const knownIp = user.loginHistory.some(login =>
    login.success && login.ipAddress === ipAddress
  );

  // Check if device has been used before
  const knownDevice = user.loginHistory.some(login =>
    login.success && login.deviceInfo === deviceInfo
  );

  // Check if this is a trusted device
  const trustedDevice = user.trustedDevices?.some(device =>
    device.ipAddress === ipAddress || device.deviceInfo === deviceInfo
  );

  // Check for country change (if location data is available)
  let countryChanged = false;
  if (currentLocation && currentLocation.country) {
    // Get the most recent successful login with location data
    const recentLogins = user.loginHistory
      .filter(login => login.success && login.location && login.location.country)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (recentLogins.length > 0) {
      const lastCountry = recentLogins[0].location.country;
      countryChanged = lastCountry !== currentLocation.country;
    }
  }

  // Suspicious if:
  // 1. Both IP and device are new and not trusted, OR
  // 2. Country has changed from last login
  return (!knownIp && !knownDevice && !trustedDevice) || countryChanged;
}

// Clean up old sessions (remove sessions inactive for more than 30 days)
export function cleanupOldSessions(user) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  user.activeSessions = user.activeSessions.filter(session =>
    new Date(session.lastActive) > thirtyDaysAgo
  );

  return user;
}

// Find or create session for device/IP combination
// This prevents duplicate sessions from the same device
export function findOrCreateSession(user, ipAddress, deviceInfo, browser, os, location = null) {
  // Look for existing session with same IP and device info
  const existingSession = user.activeSessions.find(session =>
    session.ipAddress === ipAddress && session.deviceInfo === deviceInfo
  );

  if (existingSession) {
    // Update existing session with new location data if provided
    existingSession.lastActive = new Date();
    if (location) {
      existingSession.location = location;
    }
    return { session: existingSession, isNew: false };
  }

  // Create new session if none exists
  const sessionId = generateSessionId();
  const newSession = {
    sessionId,
    deviceInfo,
    browser,
    os,
    ipAddress,
    location: location || {
      city: '',
      region: '',
      country: ''
    },
    createdAt: new Date(),
    lastActive: new Date()
  };

  return { session: newSession, isNew: true };
}

// Limit login history to last 50 entries
export function limitLoginHistory(user) {
  if (user.loginHistory && user.loginHistory.length > 50) {
    user.loginHistory = user.loginHistory.slice(-50);
  }
  return user;
}

// Maximum concurrent sessions per user
const MAX_SESSIONS_PER_USER = 5;

/**
 * Enforce maximum concurrent sessions limit
 * If limit is exceeded, removes oldest sessions first
 * @param {Object} user - User document with activeSessions array
 * @param {Function} logSecurityEvent - Optional callback to log security events
 * @returns {Object} Result with removedSessions array
 */
export function enforceMaxSessions(user, logSecurityEvent = null) {
  const result = { removedSessions: [] };

  if (!user.activeSessions || user.activeSessions.length <= MAX_SESSIONS_PER_USER) {
    return result;
  }

  // Sort sessions by lastActive (oldest first)
  const sortedSessions = [...user.activeSessions].sort((a, b) =>
    new Date(a.lastActive) - new Date(b.lastActive)
  );

  // Calculate how many sessions to remove
  const sessionsToRemove = sortedSessions.length - MAX_SESSIONS_PER_USER;

  if (sessionsToRemove > 0) {
    // Get the oldest sessions to remove
    const removedSessions = sortedSessions.slice(0, sessionsToRemove);
    result.removedSessions = removedSessions;

    // Keep only the newest MAX_SESSIONS_PER_USER sessions
    const sessionIdsToKeep = sortedSessions.slice(sessionsToRemove).map(s => s.sessionId);
    user.activeSessions = user.activeSessions.filter(s =>
      sessionIdsToKeep.includes(s.sessionId)
    );

    // Log security event if callback provided
    if (logSecurityEvent && removedSessions.length > 0) {
      logSecurityEvent({
        type: 'max_sessions_enforced',
        severity: 'low',
        userId: user._id,
        details: {
          removedCount: removedSessions.length,
          removedSessions: removedSessions.map(s => ({
            sessionId: s.sessionId,
            deviceInfo: s.deviceInfo,
            ipAddress: s.ipAddress,
            lastActive: s.lastActive
          })),
          remainingSessions: MAX_SESSIONS_PER_USER
        }
      });
    }

    console.log(`🔒 Enforced max sessions for user ${user._id}: removed ${removedSessions.length} oldest session(s)`);
  }

  return result;
}

// Export the constant for use elsewhere
export const MAX_CONCURRENT_SESSIONS = MAX_SESSIONS_PER_USER;

