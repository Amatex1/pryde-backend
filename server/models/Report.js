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
  }
});

// Index for efficient queries
reportSchema.index({ reporter: 1, createdAt: -1 });
reportSchema.index({ reportedUser: 1, status: 1 });
reportSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('Report', reportSchema);

