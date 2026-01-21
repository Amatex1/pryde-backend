import mongoose from 'mongoose';

/**
 * Phase 4B: Login Events Collection
 * 
 * Extracted login history for scalable audit trail.
 * TTL index automatically deletes old events after retention period.
 * 
 * Default retention: 90 days (configurable via LOGIN_EVENT_TTL_DAYS env var)
 */

const TTL_DAYS = parseInt(process.env.LOGIN_EVENT_TTL_DAYS || '90', 10);
const TTL_SECONDS = TTL_DAYS * 24 * 60 * 60;

const loginEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Event outcome
  success: {
    type: Boolean,
    required: true
  },

  // Failure reason (if applicable)
  failureReason: {
    type: String,
    default: null
  },

  // Session info (if successful)
  sessionId: {
    type: String,
    default: null
  },

  // Device/browser info
  deviceInfo: {
    type: String,
    default: ''
  },
  browser: {
    type: String,
    default: ''
  },
  os: {
    type: String,
    default: ''
  },

  // Network info
  ipAddress: {
    type: String,
    default: ''
  },

  // Location (if available)
  location: {
    city: String,
    region: String,
    country: String
  },

  // Flags
  suspicious: {
    type: Boolean,
    default: false
  },
  newDevice: {
    type: Boolean,
    default: false
  },

  // 2FA used
  twoFactorUsed: {
    type: Boolean,
    default: false
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound indexes for common queries
loginEventSchema.index({ userId: 1, createdAt: -1 });
loginEventSchema.index({ success: 1, createdAt: -1 });

// TTL index for automatic cleanup (90 days by default)
// MongoDB will automatically delete documents 90 days after createdAt
loginEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: TTL_SECONDS });

export default mongoose.model('LoginEvent', loginEventSchema);

