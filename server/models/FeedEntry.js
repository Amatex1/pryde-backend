/**
 * FeedEntry Model
 * 
 * Stores pre-computed feed items per user for fan-out-on-write feed architecture.
 * Feeds are pre-built during post creation instead of computed on request.
 * 
 * Indexes:
 * - { userId: 1, score: -1, createdAt: -1 } - Primary feed query index
 * - { userId: 1, postId: 1 } - Unique constraint to prevent duplicates
 */

import mongoose from 'mongoose';
import logger from '../utils/logger.js';

const feedEntrySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    // null for global community signals (shown to all users)
    default: null,
    index: true
  },
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    // null for community_signal entries
    default: null,
    index: true
  },
  score: {
    type: Number,
    default: 0,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  // ── Community Signal fields ─────────────────────────────────────────────────
  type: {
    type: String,
    enum: ['post', 'community_signal'],
    default: 'post',
    index: true
  },
  signalType: {
    type: String,
    enum: ['new_member', 'conversation_heating', 'active_journal', 'group_discussion', 'reply_spike']
  },
  signalData: {
    type: Object
  }
}, {
  timestamps: false // We manage createdAt manually
});

// Compound index for efficient feed queries: userId + score + createdAt
// This optimizes: db.feedEntries.find({ userId: ... }).sort({ score: -1, createdAt: -1 })
feedEntrySchema.index(
  { userId: 1, score: -1, createdAt: -1 },
  { name: 'feed_user_score_time' }
);

// Unique compound index to prevent duplicate feed entries for same user+post (posts only)
feedEntrySchema.index(
  { userId: 1, postId: 1 },
  { unique: true, sparse: true, partialFilterExpression: { type: 'post' }, name: 'feed_user_post_unique' }
);

// Index for efficient global signal queries (type + signalType + createdAt)
feedEntrySchema.index(
  { type: 1, signalType: 1, createdAt: -1 },
  { name: 'feed_signal_type_time' }
);

// Static method: Add multiple feed entries efficiently
feedEntrySchema.statics.insertManySafe = async function(entries, options = {}) {
  try {
    // Use ordered: false for better performance, continue on duplicate errors
    const result = await this.insertMany(entries, { 
      ordered: false,
      ...options
    });
    return result;
  } catch (error) {
    // Handle duplicate key errors gracefully (expected when re-processing)
    if (error.code === 11000) {
      // Extract successfully inserted count from error message
      const matched = error.message.match(/(\d+) document\(s\)/);
      const insertedCount = matched ? parseInt(matched[1]) : 0;
      logger.debug(`[FeedEntry] ${insertedCount} entries inserted, duplicates skipped`);
      return [];
    }
    throw error;
  }
};

// Static method: Get feed entries for a user
feedEntrySchema.statics.getUserFeed = async function(userId, limit = 50) {
  return this.find({ userId })
    .sort({ score: -1, createdAt: -1 })
    .limit(limit)
    .lean();
};

// Static method: Delete all feed entries for a specific post
feedEntrySchema.statics.deleteByPostId = async function(postId) {
  return this.deleteMany({ postId });
};

// Static method: Get recent global community signals
feedEntrySchema.statics.getRecentSignals = async function(sinceMs = 2 * 60 * 60 * 1000, limit = 5) {
  const since = new Date(Date.now() - sinceMs);
  return this.find({ type: 'community_signal', createdAt: { $gte: since } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Static method: Update score for a specific post (when engagement changes)
feedEntrySchema.statics.updateScore = async function(postId, newScore) {
  return this.updateMany({ postId }, { $set: { score: newScore } });
};

const FeedEntry = mongoose.model('FeedEntry', feedEntrySchema);

export default FeedEntry;

