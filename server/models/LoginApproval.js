import mongoose from 'mongoose';

const loginApprovalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // 2-digit verification code shown on login screen
  verificationCode: {
    type: String,
    required: true,
    length: 2
  },
  // Device trying to log in
  deviceInfo: {
    type: String,
    required: true
  },
  browser: {
    type: String,
    default: ''
  },
  os: {
    type: String,
    default: ''
  },
  ipAddress: {
    type: String,
    required: true
  },
  location: {
    city: { type: String, default: '' },
    region: { type: String, default: '' },
    country: { type: String, default: '' }
  },
  // Status of the approval request
  status: {
    type: String,
    enum: ['pending', 'approved', 'denied', 'expired'],
    default: 'pending',
    index: true
  },
  // When the request was approved/denied
  respondedAt: {
    type: Date,
    default: null
  },
  // Temporary token to complete login after approval
  tempToken: {
    type: String,
    required: true
  },
  // Expires after 5 minutes
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Indexes for efficient queries
loginApprovalSchema.index({ user: 1, status: 1, createdAt: -1 });
loginApprovalSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired requests

export default mongoose.model('LoginApproval', loginApprovalSchema);

