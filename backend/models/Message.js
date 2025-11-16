import mongoose from 'mongoose';

/**
 * Message model with support for text, images, and read receipts
 */
const messageSchema = new mongoose.Schema({
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    default: ''
  },
  image_url: {
    type: String,
    default: ''
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  read_by: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, { timestamps: true });

// Index for efficient querying
messageSchema.index({ from: 1, to: 1, created_at: -1 });

export default mongoose.model('Message', messageSchema);
