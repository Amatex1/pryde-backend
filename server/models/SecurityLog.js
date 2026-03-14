import mongoose from 'mongoose';

const securityLogSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'underage_registration',
      'underage_login',
      'underage_access',
      'failed_login',
      'account_locked',
      'suspicious_activity',
      'rate_limit_exceeded',
      'injection_attempt',
      'xss_attempt',
      'password_changed',
      'email_changed',
      'email_verified',
      'two_factor_enabled',
      'two_factor_disabled',
      'passkey_added',
      'passkey_removed',
      'account_deleted',
      'profile_updated',
      'privacy_settings_changed',
      'account_recovery_2fa_reset',
      'recovery_contact_notified',
      'login_after_inactivity',
      'invite_created',
      'invite_used',
      'invite_revoked',
      'underage_profile_update_attempt',
      'suspected_minor_signal',
      // Moderation pipeline signals (Phase 5)
      'reported_content_threshold_reached',
      'reported_user_threshold_reached',
      'high_severity_report_submitted',
      // Session & token security
      'refresh_token_rotated',
      'refresh_token_reuse_detected',
      'session_family_revoked',
      'session_expired',
      'security_alert_triggered',
      // Upload security
      'malware_scan_failed',
      'malware_detected_upload',
      // API docs access control
      'swagger_access_blocked'
    ],
    required: true
  },
  severity: {
    type: String,
    enum: ['info', 'low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  username: {
    type: String,
    default: null,
    maxlength: 50 // Truncated usernames only
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  details: {
    type: String,
    default: ''
  },
  action: {
    type: String,
    enum: ['blocked', 'banned', 'logged', 'flagged', 'created', 'used', 'revoked', 'sanitized'],
    default: 'logged'
  },
  resolved: {
    type: Boolean,
    default: false
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Index for faster queries
securityLogSchema.index({ type: 1, createdAt: -1 });
securityLogSchema.index({ resolved: 1 });
securityLogSchema.index({ severity: 1 });

// TTL index: auto-delete logs older than 90 days (configurable via SECURITY_LOG_TTL_DAYS)
const TTL_DAYS = parseInt(process.env.SECURITY_LOG_TTL_DAYS || '90', 10);
securityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: TTL_DAYS * 24 * 60 * 60 });

const SecurityLog = mongoose.model('SecurityLog', securityLogSchema);

export default SecurityLog;

