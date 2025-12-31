import mongoose from 'mongoose';

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
    enum: [
      'friend_request', 'friend_accept', 'message', 'mention',
      'like', 'comment', 'share', 'login_approval',
      // PHASE 4B: Group notification types
      'group_post',    // New post in a group you've opted into
      'group_mention', // Someone @mentioned you in a group
      // Life-Signal Feature 3: Resonance signals
      'resonance',     // "Someone quietly resonated with something you shared"
      // Life-Signal Feature 4: Circle notifications
      'circle_invite', // Invited to join a circle
      'circle_post'    // New post in a circle (minimal)
    ],
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
  // For batched notifications (e.g., "3 new posts in Book Club")
  batchCount: {
    type: Number,
    default: 1
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

  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for efficient queries
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1 });
notificationSchema.index({ createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
