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
    enum: ['friend_request', 'friend_accept', 'message', 'mention', 'like', 'comment', 'share', 'login_approval'],
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
