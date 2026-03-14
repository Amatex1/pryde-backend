/**
 * Story model — ephemeral content that expires after 24 hours.
 *
 * Inspired by Instagram/Snapchat Stories. Each story belongs to one user and
 * is visible to followers (or everyone, depending on privacy setting).
 *
 * TTL index on `expiresAt` lets MongoDB automatically purge expired documents.
 */

import mongoose from 'mongoose';

const storySchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Media URL (R2 or GridFS — same as post media)
  mediaUrl: {
    type: String,
    required: true
  },

  mediaType: {
    type: String,
    enum: ['image', 'video'],
    required: true
  },

  // Optional text overlay
  caption: {
    type: String,
    default: '',
    maxlength: 150
  },

  // Optional content warning
  contentWarning: {
    type: String,
    default: '',
    maxlength: 100
  },

  // 'public' = anyone, 'followers' = followers only
  visibility: {
    type: String,
    enum: ['public', 'followers'],
    default: 'followers'
  },

  // Tracks who has viewed this story
  viewedBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    viewedAt: { type: Date, default: Date.now }
  }],

  // TTL field — MongoDB deletes the document when now > expiresAt
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

// TTL index — MongoDB auto-deletes stories after 24 hours
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Efficient feed queries (all active stories by a user)
storySchema.index({ author: 1, expiresAt: 1 });

// Feed: stories from followed users that haven't expired
storySchema.index({ author: 1, visibility: 1, expiresAt: 1 });

export default mongoose.model('Story', storySchema);
