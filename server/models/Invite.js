import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * Invite Model (Phase 7B)
 * 
 * Controls platform growth through deliberate invitations.
 * Invite codes are non-sequential, cryptographically secure,
 * and cannot be guessed or enumerated.
 */
const inviteSchema = new mongoose.Schema({
  // Unique invite code (cryptographically secure, non-guessable)
  code: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Who created this invite (must be admin/super_admin)
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Who used this invite (null if unused)
  usedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // When the invite was used
  usedAt: {
    type: Date,
    default: null
  },
  
  // When the invite expires (optional, null = never expires)
  expiresAt: {
    type: Date,
    default: null,
    index: true
  },
  
  // Maximum number of uses (default: 1, single-use)
  maxUses: {
    type: Number,
    default: 1,
    min: 1,
    max: 1 // Enforce single-use only for now
  },
  
  // Current number of uses
  useCount: {
    type: Number,
    default: 0
  },
  
  // Status of the invite
  status: {
    type: String,
    enum: ['active', 'used', 'expired', 'revoked'],
    default: 'active',
    index: true
  },
  
  // Optional: personal note from the creator (not shown to invitee)
  note: {
    type: String,
    maxlength: 200,
    default: ''
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
inviteSchema.index({ createdBy: 1, status: 1 });
inviteSchema.index({ code: 1, status: 1 });

/**
 * Generate a secure, non-guessable invite code
 * Format: PRYDE-XXXX-XXXX-XXXX (16 random alphanumeric chars)
 */
inviteSchema.statics.generateCode = function() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed I, O, 0, 1 for readability
  const randomBytes = crypto.randomBytes(12);
  let code = 'PRYDE-';
  
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) {
      code += '-';
    }
    code += chars[randomBytes[i] % chars.length];
  }
  
  return code;
};

/**
 * Check if an invite is valid and can be used
 */
inviteSchema.methods.isValid = function() {
  // Check if already used (maxUses reached)
  if (this.useCount >= this.maxUses) {
    return { valid: false, reason: 'already_used' };
  }
  
  // Check if revoked
  if (this.status === 'revoked') {
    return { valid: false, reason: 'revoked' };
  }
  
  // Check if expired
  if (this.expiresAt && new Date() > this.expiresAt) {
    return { valid: false, reason: 'expired' };
  }
  
  return { valid: true };
};

/**
 * Mark invite as used
 */
inviteSchema.methods.markUsed = async function(userId) {
  this.usedBy = userId;
  this.usedAt = new Date();
  this.useCount += 1;
  this.status = 'used';
  await this.save();
};

const Invite = mongoose.model('Invite', inviteSchema);

export default Invite;

