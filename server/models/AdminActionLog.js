/**
 * AdminActionLog Model
 * 
 * PHASE D: Admin Action Logs
 * 
 * Tracks all admin actions for audit trail and accountability.
 * Records who did what, when, and on behalf of whom.
 * 
 * Use cases:
 * - Admin posts as pryde_announcements
 * - Admin bans a user
 * - Admin deletes content
 * - Admin modifies system settings
 * 
 * This ensures transparency and prevents abuse of admin powers.
 */

import mongoose from 'mongoose';

const adminActionLogSchema = new mongoose.Schema({
  // The admin who performed the action (authenticated user)
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // The action performed
  action: {
    type: String,
    required: true,
    enum: [
      // Content actions
      'POST_AS_SYSTEM',
      'DELETE_POST',
      'DELETE_COMMENT',
      'EDIT_POST',
      
      // User moderation
      'BAN_USER',
      'UNBAN_USER',
      'SUSPEND_USER',
      'UNSUSPEND_USER',
      'MUTE_USER',
      'UNMUTE_USER',
      'DELETE_USER',
      'VERIFY_USER',
      'UNVERIFY_USER',

      // PRYDE_MODERATION_ADMIN_V2: Override actions
      'OVERRIDE_MODERATION',
      'RESTORE_CONTENT',
      'CLEAR_STRIKES',
      'RESET_BEHAVIOR_SCORE',
      'MANUAL_MUTE',
      'SHADOW_MUTE',
      'LOCK_THREAD',
      'UNLOCK_THREAD',
      'ADD_WATCHLIST',
      'REMOVE_WATCHLIST',
      'ADD_TRUSTED',
      'REMOVE_TRUSTED',
      'ADJUST_PENALTY',
      'QUEUE_FOR_REVIEW',
      
      // System account management
      'ACTIVATE_SYSTEM_ACCOUNT',
      'DEACTIVATE_SYSTEM_ACCOUNT',
      'CREATE_SYSTEM_ACCOUNT',
      
      // Admin management
      'PROMOTE_ADMIN',
      'DEMOTE_ADMIN',
      'MODIFY_PERMISSIONS',
      
      // System settings
      'UPDATE_MODERATION_SETTINGS',
      'UPDATE_PLATFORM_SETTINGS',
      'TOGGLE_INVITE_MODE',
      
      // Other
      'OTHER'
    ],
    index: true
  },
  
  // Target of the action (user, post, comment, etc.)
  targetType: {
    type: String,
    enum: ['USER', 'POST', 'COMMENT', 'SYSTEM_ACCOUNT', 'SETTINGS', 'OTHER'],
    default: 'OTHER'
  },
  
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
    index: true
  },
  
  // If posting as a system account, which one?
  asUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  
  // Additional context (reason, notes, etc.)
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Escalation method used for privileged actions (passkey, totp, password)
  escalationMethod: {
    type: String,
    enum: ['passkey', 'totp', 'password', null],
    default: null
  },

  // IP address of the admin (for security)
  ipAddress: {
    type: String,
    default: null
  },

  // User agent (browser/device info)
  userAgent: {
    type: String,
    default: null
  },

  // Timestamp (auto-generated)
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
adminActionLogSchema.index({ actorId: 1, timestamp: -1 });
adminActionLogSchema.index({ action: 1, timestamp: -1 });
adminActionLogSchema.index({ targetId: 1, timestamp: -1 });
adminActionLogSchema.index({ asUserId: 1, timestamp: -1 });

// Static method to log an action
adminActionLogSchema.statics.logAction = async function({
  actorId,
  action,
  targetType = 'OTHER',
  targetId = null,
  asUserId = null,
  details = {},
  escalationMethod = null,
  ipAddress = null,
  userAgent = null
}) {
  return this.create({
    actorId,
    action,
    targetType,
    targetId,
    asUserId,
    details,
    escalationMethod,
    ipAddress,
    userAgent,
    timestamp: new Date()
  });
};

const AdminActionLog = mongoose.model('AdminActionLog', adminActionLogSchema);

export default AdminActionLog;

