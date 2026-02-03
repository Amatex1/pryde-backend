/**
 * ModerationEvent Model
 *
 * PRYDE_MODERATION_PLATFORM_V3: Real-time moderation event stream
 *
 * Stores every moderation decision made by PRYDE_MODERATION_V2 for:
 * - Admin visibility and review
 * - Override tracking
 * - Audit trail
 * - Training data (if corrective actions applied)
 * - Shadow mode testing
 *
 * DATA CONTRACT (AUTHORITATIVE - Frontend must never infer logic):
 * - expression: { classification, expressiveRatio, realWordRatio }
 * - intent: { category, score, targetDetected }
 * - behavior: { score, trend, accountAgeDays }
 * - response: { action, durationMinutes, automated }
 */

import mongoose from 'mongoose';

const moderationEventSchema = new mongoose.Schema({
  // The user whose content was moderated
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Content details
  contentType: {
    type: String,
    enum: ['post', 'comment', 'message', 'global_chat', 'profile', 'other'],
    required: true,
    index: true
  },

  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },

  contentPreview: {
    type: String,
    maxlength: 500,
    default: ''
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // V3 DATA CONTRACT: Expression Layer
  // ═══════════════════════════════════════════════════════════════════════════
  expression: {
    classification: {
      type: String,
      enum: ['normal', 'emphatic'],
      default: 'normal'
    },
    expressiveRatio: { type: Number, default: 0 },
    realWordRatio: { type: Number, default: 0 }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // V3 DATA CONTRACT: Intent Layer
  // ═══════════════════════════════════════════════════════════════════════════
  intent: {
    category: {
      type: String,
      enum: ['expressive', 'neutral', 'disruptive', 'hostile', 'dangerous'],
      default: 'neutral'
    },
    score: { type: Number, default: 0 },
    targetDetected: { type: Boolean, default: false }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // V3 DATA CONTRACT: Behavior Layer
  // ═══════════════════════════════════════════════════════════════════════════
  behavior: {
    score: { type: Number, default: 0 },
    trend: {
      type: String,
      enum: ['stable', 'rising', 'falling'],
      default: 'stable'
    },
    accountAgeDays: { type: Number, default: 0 }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // V3 DATA CONTRACT: Response Layer
  // ═══════════════════════════════════════════════════════════════════════════
  response: {
    action: {
      type: String,
      enum: ['ALLOW', 'NOTE', 'DAMPEN', 'REVIEW', 'MUTE', 'BLOCK'],
      default: 'ALLOW'
    },
    durationMinutes: { type: Number, default: 0 },
    automated: { type: Boolean, default: true }
  },

  // Confidence level (0-100)
  confidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },

  // V3: Explanation code for human-first language mapping
  explanationCode: {
    type: String,
    default: 'ALLOWED'
  },

  // V3: Shadow mode flag - if true, no user-facing penalties were applied
  shadowMode: {
    type: Boolean,
    default: false,
    index: true
  },

  // Legacy layer outputs (kept for backward compatibility)
  layerOutputs: {
    layer1: {
      expressive_ratio: { type: Number, default: 0 },
      real_word_ratio: { type: Number, default: 0 },
      formatting_signals: [String],
      classification: { type: String, default: 'neutral' }
    },
    layer2: {
      intent_category: { type: String, default: 'neutral' },
      intent_score: { type: Number, default: 0 },
      targets: [String],
      hostility_markers: [String],
      threat_patterns: [String],
      confidence: { type: Number, default: 0 }
    },
    layer3: {
      behavior_score: { type: Number, default: 0 },
      frequency_score: { type: Number, default: 0 },
      duplicate_score: { type: Number, default: 0 },
      account_age_score: { type: Number, default: 0 },
      history_score: { type: Number, default: 0 }
    },
    layer4: {
      combined_score: { type: Number, default: 0 },
      dampening_duration: { type: Number, default: 0 },
      queue_priority: { type: String, default: 'normal' }
    }
  },

  // Visibility dampening details
  dampeningDuration: {
    type: Number,
    default: 0 // minutes
  },

  dampeningExpires: {
    type: Date,
    default: null
  },

  // Queue priority for review
  queuePriority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },

  // Override status
  overrideStatus: {
    type: String,
    enum: ['none', 'pending_review', 'overridden', 'confirmed'],
    default: 'none',
    index: true
  },

  // Reference to override if one exists
  overrideId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ModerationOverride',
    default: null
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
moderationEventSchema.index({ userId: 1, createdAt: -1 });
moderationEventSchema.index({ 'response.action': 1, createdAt: -1 });
moderationEventSchema.index({ contentType: 1, createdAt: -1 });
moderationEventSchema.index({ overrideStatus: 1, createdAt: -1 });
moderationEventSchema.index({ queuePriority: 1, overrideStatus: 1, createdAt: -1 });
moderationEventSchema.index({ shadowMode: 1, createdAt: -1 }); // V3: Shadow mode queries
moderationEventSchema.index({ explanationCode: 1, createdAt: -1 }); // V3: Explanation code queries

// TTL index - auto-delete events older than 90 days (configurable)
moderationEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

/**
 * V3 DATA CONTRACT: Transform to frontend-safe shape
 * Frontend must never infer logic - this is the authoritative response shape
 */
moderationEventSchema.methods.toV3Contract = function() {
  return {
    id: this._id.toString(),
    contentId: this.contentId?.toString() || null,
    contentType: this.contentType,
    contentPreview: this.contentPreview,
    userId: this.userId?.toString(),
    createdAt: this.createdAt?.toISOString(),
    expression: {
      classification: this.expression?.classification || 'normal',
      expressiveRatio: this.expression?.expressiveRatio || 0,
      realWordRatio: this.expression?.realWordRatio || 0
    },
    intent: {
      category: this.intent?.category || 'neutral',
      score: this.intent?.score || 0,
      targetDetected: this.intent?.targetDetected || false
    },
    behavior: {
      score: this.behavior?.score || 0,
      trend: this.behavior?.trend || 'stable',
      accountAgeDays: this.behavior?.accountAgeDays || 0
    },
    response: {
      action: this.response?.action || 'ALLOW',
      durationMinutes: this.response?.durationMinutes || 0,
      automated: this.response?.automated !== false
    },
    confidence: this.confidence,
    explanationCode: this.explanationCode,
    shadowMode: this.shadowMode,
    overridden: this.overrideStatus === 'overridden'
  };
};

/**
 * Static method to transform array of events to V3 contract
 */
moderationEventSchema.statics.toV3ContractArray = function(events) {
  return events.map(event => {
    if (event.toV3Contract) {
      return event.toV3Contract();
    }
    // Handle lean() results
    return {
      id: event._id?.toString(),
      contentId: event.contentId?.toString() || null,
      contentType: event.contentType,
      contentPreview: event.contentPreview,
      userId: event.userId?.toString(),
      createdAt: event.createdAt,
      expression: event.expression || { classification: 'normal', expressiveRatio: 0, realWordRatio: 0 },
      intent: event.intent || { category: 'neutral', score: 0, targetDetected: false },
      behavior: event.behavior || { score: 0, trend: 'stable', accountAgeDays: 0 },
      response: event.response || { action: 'ALLOW', durationMinutes: 0, automated: true },
      confidence: event.confidence,
      explanationCode: event.explanationCode,
      shadowMode: event.shadowMode,
      overridden: event.overrideStatus === 'overridden'
    };
  });
};

const ModerationEvent = mongoose.model('ModerationEvent', moderationEventSchema);

export default ModerationEvent;

