import crypto from 'crypto';

// Generate unique session ID
export function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
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
export function isSuspiciousLogin(user, ipAddress, deviceInfo) {
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

  // Suspicious if both IP and device are new and not trusted
  return !knownIp && !knownDevice && !trustedDevice;
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
export function findOrCreateSession(user, ipAddress, deviceInfo, browser, os) {
  // Look for existing session with same IP and device info
  const existingSession = user.activeSessions.find(session =>
    session.ipAddress === ipAddress && session.deviceInfo === deviceInfo
  );

  if (existingSession) {
    // Update existing session
    existingSession.lastActive = new Date();
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
    location: {
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

