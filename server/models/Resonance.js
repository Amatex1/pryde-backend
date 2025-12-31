/**
 * Life-Signal Feature 3: "Someone felt this too" Resonance Signals
 * 
 * Silent resonance events that occasionally trigger soft notifications to authors.
 * - User ID hidden from authors
 * - No exposed counts
 * - Rate-limited notifications
 */

import mongoose from 'mongoose';

const resonanceSchema = new mongoose.Schema({
  // The user who resonated (never exposed to author)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // The post that was resonated with
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
    index: true
  },
  
  // Type of resonance event
  type: {
    type: String,
    enum: ['reaction', 'bookmark', 'read'],
    required: true
  },
  
  // When the resonance occurred
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to prevent duplicate resonance events
resonanceSchema.index({ user: 1, post: 1, type: 1 }, { unique: true });

// Index for efficient aggregation by post
resonanceSchema.index({ post: 1, createdAt: -1 });

// Index for rate-limiting notification triggers
resonanceSchema.index({ post: 1, createdAt: 1 });

const Resonance = mongoose.model('Resonance', resonanceSchema);

export default Resonance;

