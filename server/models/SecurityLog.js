import mongoose from 'mongoose';

const securityLogSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'underage_registration',
      'underage_login',
      'underage_access',
      'failed_login',
      'suspicious_activity',
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
      'recovery_contact_notified'
    ],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  username: {
    type: String,
    default: null
  },
  email: {
    type: String,
    default: null
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  birthday: {
    type: Date,
    default: null
  },
  calculatedAge: {
    type: Number,
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
    enum: ['blocked', 'banned', 'logged', 'flagged'],
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

const SecurityLog = mongoose.model('SecurityLog', securityLogSchema);

export default SecurityLog;

