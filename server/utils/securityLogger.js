import SecurityLog from '../models/SecurityLog.js';

/**
 * Log a security event
 * 
 * @param {Object} eventData - Security event data
 * @param {string} eventData.type - Type of security event
 * @param {string} eventData.severity - Severity level (low, medium, high, critical)
 * @param {string} eventData.userId - User ID (if applicable)
 * @param {string} eventData.username - Username (if applicable)
 * @param {string} eventData.email - Email (if applicable)
 * @param {string} eventData.ipAddress - IP address
 * @param {string} eventData.userAgent - User agent string
 * @param {string} eventData.details - Additional details
 * @param {string} eventData.action - Action taken (blocked, banned, logged, flagged)
 */
export const logSecurityEvent = async (eventData) => {
  try {
    const {
      type,
      severity = 'medium',
      userId = null,
      username = null,
      email = null,
      ipAddress = null,
      userAgent = null,
      details = '',
      action = 'logged'
    } = eventData;

    const securityLog = new SecurityLog({
      type,
      severity,
      userId,
      username,
      email,
      ipAddress,
      userAgent,
      details,
      action
    });

    await securityLog.save();
    console.log(`🔒 Security event logged: ${type} (${severity})`);
    
    return securityLog;
  } catch (error) {
    console.error('Error logging security event:', error);
    // Don't throw - logging should never break the main flow
    return null;
  }
};

/**
 * Log password change event
 */
export const logPasswordChange = async (user, ipAddress, userAgent) => {
  return logSecurityEvent({
    type: 'password_changed',
    severity: 'medium',
    userId: user._id,
    username: user.username,
    email: user.email,
    ipAddress,
    userAgent,
    details: 'User changed their password'
  });
};

/**
 * Log email change event
 */
export const logEmailChange = async (user, oldEmail, newEmail, ipAddress, userAgent) => {
  return logSecurityEvent({
    type: 'email_changed',
    severity: 'high',
    userId: user._id,
    username: user.username,
    email: newEmail,
    ipAddress,
    userAgent,
    details: `Email changed from ${oldEmail} to ${newEmail}`
  });
};

/**
 * Log email verification event
 */
export const logEmailVerification = async (user, ipAddress, userAgent) => {
  return logSecurityEvent({
    type: 'email_verified',
    severity: 'low',
    userId: user._id,
    username: user.username,
    email: user.email,
    ipAddress,
    userAgent,
    details: 'User verified their email address'
  });
};

/**
 * Log 2FA enabled event
 */
export const logTwoFactorEnabled = async (user, ipAddress, userAgent) => {
  return logSecurityEvent({
    type: 'two_factor_enabled',
    severity: 'low',
    userId: user._id,
    username: user.username,
    email: user.email,
    ipAddress,
    userAgent,
    details: 'User enabled two-factor authentication'
  });
};

/**
 * Log 2FA disabled event
 */
export const logTwoFactorDisabled = async (user, ipAddress, userAgent) => {
  return logSecurityEvent({
    type: 'two_factor_disabled',
    severity: 'medium',
    userId: user._id,
    username: user.username,
    email: user.email,
    ipAddress,
    userAgent,
    details: 'User disabled two-factor authentication'
  });
};

/**
 * Log account deletion event
 */
export const logAccountDeletion = async (user, ipAddress, userAgent) => {
  return logSecurityEvent({
    type: 'account_deleted',
    severity: 'high',
    userId: user._id,
    username: user.username,
    email: user.email,
    ipAddress,
    userAgent,
    details: 'User deleted their account'
  });
};

/**
 * Log failed authentication attempt
 */
export const logFailedAuth = async (email, ipAddress, userAgent, reason = 'invalid_credentials') => {
  return logSecurityEvent({
    type: 'failed_authentication',
    severity: 'medium',
    email,
    ipAddress,
    userAgent,
    details: `Failed login attempt: ${reason}`,
    action: 'logged'
  });
};

/**
 * Log suspicious request (potential attack)
 */
export const logSuspiciousRequest = async (req, reason) => {
  return logSecurityEvent({
    type: 'suspicious_request',
    severity: 'high',
    userId: req.user?._id || null,
    username: req.user?.username || null,
    ipAddress: req.ip || req.headers['x-forwarded-for']?.split(',')[0] || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    details: `${reason} | Path: ${req.path} | Method: ${req.method}`,
    action: 'flagged'
  });
};

/**
 * Log rate limit exceeded
 */
export const logRateLimitExceeded = async (req, limiterType) => {
  return logSecurityEvent({
    type: 'rate_limit_exceeded',
    severity: 'medium',
    userId: req.user?._id || null,
    username: req.user?.username || null,
    ipAddress: req.ip || req.headers['x-forwarded-for']?.split(',')[0] || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    details: `Rate limit exceeded for ${limiterType} | Path: ${req.path}`,
    action: 'blocked'
  });
};

/**
 * Log SQL/NoSQL injection attempt
 */
export const logInjectionAttempt = async (req, payload) => {
  return logSecurityEvent({
    type: 'injection_attempt',
    severity: 'critical',
    userId: req.user?._id || null,
    username: req.user?.username || null,
    ipAddress: req.ip || req.headers['x-forwarded-for']?.split(',')[0] || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    details: `Potential injection detected | Path: ${req.path} | Payload snippet: ${payload.substring(0, 100)}`,
    action: 'blocked'
  });
};

/**
 * Log XSS attempt
 */
export const logXSSAttempt = async (req, payload) => {
  return logSecurityEvent({
    type: 'xss_attempt',
    severity: 'high',
    userId: req.user?._id || null,
    username: req.user?.username || null,
    ipAddress: req.ip || req.headers['x-forwarded-for']?.split(',')[0] || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    details: `Potential XSS detected | Path: ${req.path} | Payload snippet: ${payload.substring(0, 100)}`,
    action: 'sanitized'
  });
};

export default {
  logSecurityEvent,
  logPasswordChange,
  logEmailChange,
  logEmailVerification,
  logTwoFactorEnabled,
  logTwoFactorDisabled,
  logAccountDeletion,
  logFailedAuth,
  logSuspiciousRequest,
  logRateLimitExceeded,
  logInjectionAttempt,
  logXSSAttempt
};

