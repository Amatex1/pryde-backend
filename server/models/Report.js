import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  reportedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  reportType: {
    type: String,
    enum: ['post', 'comment', 'message', 'user'],
    required: true
  },
  reportedContent: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'onModel'
  },
  onModel: {
    type: String,
    enum: ['Post', 'Comment', 'Message', 'User']
  },
  reason: {
    type: String,
    enum: [
      'spam',
      'harassment',
      'hate_speech',
      'violence',
      'nudity',
      'misinformation',
      'impersonation',
      'self_harm',
      'other'
    ],
    required: true
  },
  description: {
    type: String,
    maxlength: 1000
  },
  status: {
    type: String,
    enum: ['pending', 'reviewing', 'resolved', 'dismissed'],
    default: 'pending'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewNotes: {
    type: String,
    maxlength: 2000
  },
  action: {
    type: String,
    enum: ['none', 'warning', 'content_removed', 'user_suspended', 'user_banned']
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  reviewedAt: {
    type: Date
  },

  // Phase 3: Immutable content snapshot captured at report time
  // Preserves content even if the original is later edited or deleted
  contentSnapshot: {
    text: { type: String, maxlength: 5000 },
    media: [{ type: String }],
    authorId: { type: mongoose.Schema.Types.ObjectId },
    authorUsername: { type: String },
    authorDisplayName: { type: String },
    createdAt: { type: Date },
    // metadata: reply depth, parent references, message recipient context, etc.
    metadata: { type: mongoose.Schema.Types.Mixed }
  },

  // Phase 4: Severity scoring for moderation prioritisation
  severityScore: {
    type: Number,
    default: 1,
    min: 1,
    max: 10,
    index: true
  },
  severityLabel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },

  // Improvement 1: Moderator action history — full audit trail per report
  actionHistory: [
    {
      action: {
        type: String,
        enum: ['none', 'warning', 'content_removed', 'user_suspended', 'user_banned', 'reviewing']
      },
      moderatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      moderatorUsername: { type: String },
      timestamp: { type: Date, default: Date.now },
      notes: { type: String, maxlength: 2000 }
    }
  ]
});

// ── Existing indexes ──────────────────────────────────────────────────────────
reportSchema.index({ reporter: 1, createdAt: -1 });
reportSchema.index({ reportedUser: 1, status: 1 });
reportSchema.index({ status: 1, createdAt: -1 });

// Phase 1: Compound index for duplicate-report detection
// (reporter, reportType, reportedContent) — fast lookup before create
reportSchema.index({ reporter: 1, reportType: 1, reportedContent: 1 });

// Phase 4+6: Sorting by severity in the admin queue
reportSchema.index({ severityScore: -1, createdAt: -1 });

// Phase 5+6: Aggregating reports per target
reportSchema.index({ reportType: 1, reportedContent: 1, status: 1 });

export default mongoose.model('Report', reportSchema);
