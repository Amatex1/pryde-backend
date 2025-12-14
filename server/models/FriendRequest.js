import mongoose from 'mongoose';

const friendRequestSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for efficient queries
friendRequestSchema.index({ sender: 1, receiver: 1 }, { unique: true }); // Prevent duplicate requests
friendRequestSchema.index({ receiver: 1, status: 1 }); // For filtering requests by status
friendRequestSchema.index({ status: 1, createdAt: -1 }); // For filtering pending requests by date

export default mongoose.model('FriendRequest', friendRequestSchema);
