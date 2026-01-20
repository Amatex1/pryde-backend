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
 */
sessionSchema.methods.rotateToken = function(newToken) {
  // Move current to previous (grace period)
  this.previousRefreshTokenHash = this.refreshTokenHash;
  this.previousTokenExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 min grace
  
  // Set new hash
  this.refreshTokenHash = crypto.createHash('sha256').update(newToken).digest('hex');
  this.lastTokenRotation = new Date();
};

export default mongoose.model('Session', sessionSchema);

