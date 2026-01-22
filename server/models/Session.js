import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * Phase 3B-A: First-Class Session Model
 * 
 * This is the authoritative session store for horizontal scale.
 * User.activeSessions remains as a bounded rolling cache for UI.
 * 
 * Dual-write strategy:
 * - All session operations write to BOTH this collection and User.activeSessions
 * - Read from this collection (authoritative), fallback to User.activeSessions
 * - Rollback = stop reading from this collection
 */

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    required: true
  },

  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // SHA-256 hashed refresh token (never store plaintext)
  refreshTokenHash: {
    type: String,
    select: false
  },

  // Previous token hash for grace period during rotation
  previousRefreshTokenHash: {
    type: String,
    select: false
  },

  // Token expiry timestamp
  refreshTokenExpiry: {
    type: Date
  },

  // Previous token expiry (grace period)
  previousTokenExpiry: {
    type: Date
  },

  // Last rotation timestamp (for 4-hour rotation policy)
  lastTokenRotation: {
    type: Date
  },

  // Device information
  deviceInfo: { type: String, default: '' },
  browser: { type: String, default: '' },
  os: { type: String, default: '' },
  ipAddress: { type: String, default: '' },

  location: {
    city: String,
    region: String,
    country: String
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  lastActiveAt: {
    type: Date,
    default: Date.now
  },

  revokedAt: {
    type: Date,
    default: null
  },

  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
});

// Compound index for auth lookups
sessionSchema.index({ userId: 1, isActive: 1 });
sessionSchema.index({ userId: 1, sessionId: 1 });

// Phase 4B: TTL index for automatic cleanup of revoked sessions
// MongoDB will automatically delete revoked sessions 30 days after revokedAt
const REVOKED_SESSION_TTL_DAYS = parseInt(process.env.SESSION_REVOKED_TTL_DAYS || '30', 10);
const REVOKED_SESSION_TTL_SECONDS = REVOKED_SESSION_TTL_DAYS * 24 * 60 * 60;
sessionSchema.index({ revokedAt: 1 }, { expireAfterSeconds: REVOKED_SESSION_TTL_SECONDS });

/**
 * Hash a refresh token using SHA-256
 */
sessionSchema.statics.hashToken = function(token) {
  if (!token) return null;
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Verify a refresh token against stored hash
 */
sessionSchema.methods.verifyRefreshToken = function(providedToken) {
  if (!providedToken) return false;
  
  const providedHash = crypto.createHash('sha256').update(providedToken).digest('hex');
  
  // Check current hash first
  if (this.refreshTokenHash && this.refreshTokenHash === providedHash) {
    return true;
  }
  
  // Check previous hash (grace period during rotation)
  if (this.previousRefreshTokenHash && 
      this.previousTokenExpiry && 
      new Date() < this.previousTokenExpiry &&
      this.previousRefreshTokenHash === providedHash) {
    return true;
  }
  
  return false;
};

/**
 * Rotate refresh token with grace period
 * @param {string} newToken - The new refresh token
 * @param {string} [currentToken] - The current token being presented (used if refreshTokenHash is null)
 */
sessionSchema.methods.rotateToken = function(newToken, currentToken = null) {
  // 🔧 FIX: Move current to previous (grace period)
  // If refreshTokenHash is null (legacy session), hash the current token being presented
  // This ensures grace period works even for sessions that haven't been migrated yet
  if (this.refreshTokenHash) {
    this.previousRefreshTokenHash = this.refreshTokenHash;
  } else if (currentToken) {
    // Hash the current token to use as previous (for legacy sessions)
    this.previousRefreshTokenHash = crypto.createHash('sha256').update(currentToken).digest('hex');
  }
  // Note: If both are null, previousRefreshTokenHash remains null (can't create grace period from nothing)

  this.previousTokenExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 min grace

  // Set new hash
  this.refreshTokenHash = crypto.createHash('sha256').update(newToken).digest('hex');
  this.lastTokenRotation = new Date();
};

export default mongoose.model('Session', sessionSchema);

