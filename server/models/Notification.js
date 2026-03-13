import mongoose from 'mongoose';
import { ALL_NOTIFICATION_TYPES, validateNotificationType, isForbiddenNotificationType } from '../constants/notificationTypes.js';
import logger from '../utils/logger.js';

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ALL_NOTIFICATION_TYPES,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  read: {
    type: Boolean,
    default: false
  },
  link: {
    type: String
  },
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  },
  commentId: {
    type: mongoose.Schema.Types.ObjectId
  },
  // PHASE 4B: Group reference for group notifications
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  },
  // Group slug for client-side navigation (avoids needing to populate)
  groupSlug: {
    type: String
  },
  // Group name for display purposes
  groupName: {
    type: String
  },
  // DEPRECATED: batchCount - notifications should NOT be batched per calm-first spec
  // Kept for backward compatibility but should always be 1
  // DO NOT use this field for new features
  batchCount: {
    type: Number,
    default: 1,
    max: 1 // Enforce no batching
  },
  // For login approval notifications
  loginApprovalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LoginApproval'
  },
  // Additional data for login approvals
  loginApprovalData: {
    verificationCode: String,
    deviceInfo: String,
    browser: String,
    os: String,
    ipAddress: String,
    location: {
      city: String,
      region: String,
      country: String
    }
  },

  // Life-Signal Feature 4: Circle reference
  circleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Circle'
  },
  circleName: {
    type: String
  },

  // Priority level — controls delivery timing and quiet-mode suppression
  // New values: 'critical' | 'high' | 'normal' | 'low'
  // Legacy values kept for backward compat: 'important' | 'passive'
  priority: {
    type: String,
    enum: ['critical', 'high', 'normal', 'low', 'important', 'passive'],
    default: 'normal'
  },
  // When true the notification is held back until quiet hours end
  queued: {
    type: Boolean,
    default: false,
    index: true
  },
  // The time after which the notification should be surfaced (quiet mode)
  deliverAfter: {
    type: Date,
    default: null
  },

  // Bundling — groups repeated activity (e.g. multiple likes on same post)
  bundleKey: {
    type: String,
    index: true
  },
  // All actors who contributed to this bundle (populated on read)
  actorIds: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: []
  },

  // Deep link path for client-side navigation (e.g. /feed?post=X&comment=Y)
  url: {
    type: String
  },

  // Aggregated interaction count (incremented when notifications are merged)
  count: {
    type: Number,
    default: 0
  },

  // Engagement score — used to surface high-value notifications first
  engagementScore: {
    type: Number,
    default: 0
  },

  // Batch ID — groups notifications created in the same batch window
  batchId: {
    type: String,
    index: true
  },

  // Delivery tracking — true once the notification has been emitted via socket
  delivered: {
    type: Boolean,
    default: false,
    index: true
  },

  // When to deliver — set by notificationDeliveryService based on priority
  deliveryScheduledAt: {
    type: Date,
    default: null
  },

  // Generic metadata field for additional context
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// ============================================
// PRE-SAVE VALIDATION (Calm-First Enforcement)
// ============================================
notificationSchema.pre('save', function(next) {
  const validation = validateNotificationType(this.type);

  if (!validation.valid) {
    // Log warning but don't block (non-fatal per spec)
    logger.warn(`[Notification] ${validation.reason}`, {
      type: this.type,
      recipient: this.recipient?.toString(),
      sender: this.sender?.toString()
    });

    // Block forbidden types entirely
    if (isForbiddenNotificationType(this.type)) {
      return next(new Error(validation.reason));
    }
  }

  next();
});

// Indexes for efficient queries
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1 });
notificationSchema.index({ createdAt: -1 });
// Index for type-based filtering (social vs message)
notificationSchema.index({ recipient: 1, type: 1, createdAt: -1 });
// Index for aggregation lookup (find recent unread notification of same type+post)
notificationSchema.index({ recipient: 1, type: 1, postId: 1 });
// Section 9: Delivery worker query index
notificationSchema.index({ recipient: 1, delivered: 1 });
// Batch grouping lookup
notificationSchema.index({ batchId: 1 });

export default mongoose.model('Notification', notificationSchema);
