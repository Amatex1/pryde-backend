import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  groupChat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GroupChat',
    default: null
  },
  // Per-user settings
  archivedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  mutedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    mutedUntil: {
      type: Date,
      default: null // null means muted indefinitely
    }
  }],
  // Track unread status per user
  unreadFor: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    markedUnreadAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes for efficient queries
conversationSchema.index({ participants: 1 }); // For finding conversations by participant
conversationSchema.index({ groupChat: 1 }); // For finding group chat conversations
conversationSchema.index({ archivedBy: 1 }); // For filtering archived conversations
conversationSchema.index({ updatedAt: -1 }); // For sorting conversations by last activity

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;

