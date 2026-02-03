/**
 * ModerationOverride Model
 * 
 * PRYDE_MODERATION_ADMIN_V2: Admin override tracking
 * 
 * Stores admin override actions with:
 * - Original automated decision preserved for audit
 * - Admin ID and reason
 * - Override type (reverse, restore, adjust, etc.)
 * - Training flag (whether to use for system learning)
 * 
 * NON-NEGOTIABLE CONSTRAINTS:
 * - No automated action is final
 * - Admin decisions always supersede bot decisions
 * - All actions must be reversible
 */

import mongoose from 'mongoose';

const moderationOverrideSchema = new mongoose.Schema({
  // Reference to the original moderation event
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ModerationEvent',
    required: true,
    index: true
  },

  // The user whose content was moderated
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // The admin who performed the override
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Type of override action
  overrideAction: {
    type: String,
    enum: [
      'APPROVE',           // Confirm automated decision was correct
      'CONFIRM',           // Same as approve
      'UNDO',              // Reverse the automated action
      'RESTORE_CONTENT',   // Restore hidden/removed content
      'ADJUST_PENALTY',    // Modify the penalty (duration, type)
      'QUEUE_FOR_REVIEW',  // Move to review queue
      'CLEAR_STRIKES',     // Clear user's violation count
      'RESET_BEHAVIOR',    // Reset behavior score
      'ADD_NOTE',          // Add admin note without changing action
      'REMOVE_HISTORY'     // Remove this entry from user's moderation history
    ],
    required: true,
    index: true
  },

  // Admin's reason for the override
  reason: {
    type: String,
    required: true,
    maxlength: 1000
  },

  // Original automated decision (preserved for audit)
  originalDecision: {
    action: String,
    confidence: Number,
    explanation: String,
    layerOutputs: mongoose.Schema.Types.Mixed
  },

  // New decision after override (if applicable)
  newDecision: {
    action: String,
    penalty: {
      type: { type: String },
      duration: Number, // minutes
      expires: Date
    }
  },

  // Training flag - should this override be used to train the system?
  trainSystem: {
    type: Boolean,
    default: false
  },

  // Whether this override has been applied
  applied: {
    type: Boolean,
    default: true
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
moderationOverrideSchema.index({ adminId: 1, createdAt: -1 });
moderationOverrideSchema.index({ userId: 1, createdAt: -1 });
moderationOverrideSchema.index({ overrideAction: 1, createdAt: -1 });
moderationOverrideSchema.index({ trainSystem: 1, createdAt: -1 });

/**
 * Static method to create an override and update the event
 */
moderationOverrideSchema.statics.createOverride = async function({
  eventId,
  userId,
  adminId,
  overrideAction,
  reason,
  originalDecision,
  newDecision = null,
  trainSystem = false
}) {
  const ModerationEvent = mongoose.model('ModerationEvent');
  
  // Create the override
  const override = await this.create({
    eventId,
    userId,
    adminId,
    overrideAction,
    reason,
    originalDecision,
    newDecision,
    trainSystem
  });

  // Update the event's override status
  await ModerationEvent.findByIdAndUpdate(eventId, {
    overrideStatus: overrideAction === 'APPROVE' || overrideAction === 'CONFIRM' 
      ? 'confirmed' 
      : 'overridden',
    overrideId: override._id
  });

  return override;
};

const ModerationOverride = mongoose.model('ModerationOverride', moderationOverrideSchema);

export default ModerationOverride;

