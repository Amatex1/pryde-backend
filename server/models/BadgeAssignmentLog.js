/**
 * Badge Assignment Log Model
 * 
 * Audit trail for badge assignments and revocations.
 * Manual assignments require a reason for accountability.
 */

import mongoose from 'mongoose';

const badgeAssignmentLogSchema = new mongoose.Schema({
  // The user who received/lost the badge
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Username at time of action (for historical reference)
  username: {
    type: String,
    required: true
  },
  // The badge ID
  badgeId: {
    type: String,
    required: true
  },
  // Badge label at time of action
  badgeLabel: {
    type: String,
    required: true
  },
  // Action type
  action: {
    type: String,
    enum: ['assigned', 'revoked'],
    required: true
  },
  // Who performed the action (null for automatic assignments)
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Username of performer (for historical reference)
  performedByUsername: {
    type: String,
    default: null
  },
  // Was this an automatic (system) or manual (admin) action?
  isAutomatic: {
    type: Boolean,
    default: false
  },
  // Required reason for manual assignments
  reason: {
    type: String,
    default: '',
    maxlength: 500
  },
  // For automatic assignments, which rule triggered it
  automaticRule: {
    type: String,
    default: null
  },
  // Additional context
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
badgeAssignmentLogSchema.index({ userId: 1, createdAt: -1 });
badgeAssignmentLogSchema.index({ badgeId: 1, createdAt: -1 });
badgeAssignmentLogSchema.index({ performedBy: 1, createdAt: -1 });
badgeAssignmentLogSchema.index({ action: 1, createdAt: -1 });
badgeAssignmentLogSchema.index({ isAutomatic: 1 });
badgeAssignmentLogSchema.index({ createdAt: -1 });

const BadgeAssignmentLog = mongoose.model('BadgeAssignmentLog', badgeAssignmentLogSchema);

export default BadgeAssignmentLog;

