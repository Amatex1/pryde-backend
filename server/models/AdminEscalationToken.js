import mongoose from 'mongoose';

/**
 * Admin Escalation Token Model
 * 
 * PURPOSE: Privileged Admin Escalation
 * Sensitive admin actions (posting as system accounts, bans, deletes, policy changes)
 * require a second factor (Passkey/WebAuthn preferred; TOTP fallback) even if the
 * attacker has Mat's password/session cookie.
 * 
 * SECURITY: A compromised Mat session must NOT be enough to use /admin powers.
 * 
 * TTL: 15 minutes default (configurable)
 * Binds to current session/user
 */

const adminEscalationTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  method: {
    type: String,
    enum: ['passkey', 'totp', 'password'],
    required: true
  },
  deviceId: {
    type: String,
    default: null
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    default: null
  },
  issuedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  revoked: {
    type: Boolean,
    default: false
  },
  revokedAt: {
    type: Date,
    default: null
  },
  revokedReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Index for cleanup of expired tokens
adminEscalationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for efficient lookup
adminEscalationTokenSchema.index({ userId: 1, sessionId: 1, revoked: 1 });

/**
 * Static method to create a new escalation token
 * @param {Object} params - Token parameters
 * @returns {Promise<Object>} Created token
 */
adminEscalationTokenSchema.statics.createToken = async function({
  userId,
  sessionId,
  method,
  deviceId = null,
  ipAddress,
  userAgent = null,
  ttlMinutes = 15
}) {
  const crypto = await import('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  
  return await this.create({
    userId,
    sessionId,
    token,
    method,
    deviceId,
    ipAddress,
    userAgent,
    issuedAt: new Date(),
    expiresAt,
    revoked: false
  });
};

/**
 * Static method to verify a token
 * @param {String} token - Token to verify
 * @param {String} userId - User ID
 * @param {String} sessionId - Session ID
 * @returns {Promise<Object|null>} Token if valid, null otherwise
 */
adminEscalationTokenSchema.statics.verifyToken = async function(token, userId, sessionId) {
  const escalationToken = await this.findOne({
    token,
    userId,
    sessionId,
    revoked: false,
    expiresAt: { $gt: new Date() }
  });
  
  return escalationToken;
};

/**
 * Static method to revoke all tokens for a user
 * @param {String} userId - User ID
 * @param {String} reason - Revocation reason
 * @returns {Promise<Number>} Number of tokens revoked
 */
adminEscalationTokenSchema.statics.revokeAllForUser = async function(userId, reason = 'User logout') {
  const result = await this.updateMany(
    { userId, revoked: false },
    {
      $set: {
        revoked: true,
        revokedAt: new Date(),
        revokedReason: reason
      }
    }
  );
  
  return result.modifiedCount;
};

const AdminEscalationToken = mongoose.model('AdminEscalationToken', adminEscalationTokenSchema);

export default AdminEscalationToken;

