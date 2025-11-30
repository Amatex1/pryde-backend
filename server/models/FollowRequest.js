import mongoose from 'mongoose';

const followRequestSchema = new mongoose.Schema({
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
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
followRequestSchema.index({ sender: 1, receiver: 1 });
followRequestSchema.index({ receiver: 1, status: 1 });

const FollowRequest = mongoose.model('FollowRequest', followRequestSchema);

export default FollowRequest;

