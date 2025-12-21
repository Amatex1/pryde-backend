import mongoose from 'mongoose';

/**
 * Universal Reaction Model
 * 
 * Supports reactions for posts, comments, and replies using a single collection.
 * Enforces one reaction per user per target.
 */
const reactionSchema = new mongoose.Schema({
  targetType: {
    type: String,
    enum: ['post', 'comment'],
    required: true,
    index: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  emoji: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Compound index to enforce one reaction per user per target
reactionSchema.index({ targetType: 1, targetId: 1, userId: 1 }, { unique: true });

// Index for efficient aggregation queries
reactionSchema.index({ targetType: 1, targetId: 1, emoji: 1 });

const Reaction = mongoose.model('Reaction', reactionSchema);

export default Reaction;

