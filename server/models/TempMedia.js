/**
 * TempMedia Model
 * 
 * Tracks temporary media uploads that haven't been attached to a published post.
 * This enables proper cleanup of orphaned uploads and prevents "ghost media"
 * that reappears after refresh.
 * 
 * Lifecycle:
 * 1. TEMPORARY - Just uploaded, awaiting attachment or deletion
 * 2. ATTACHED - Attached to a draft (will become permanent on publish)
 * 3. PUBLISHED - Attached to a published post (permanent, cleanup this record)
 * 4. DELETED - Marked for cleanup (physical file should be deleted)
 */

import mongoose from 'mongoose';

const tempMediaSchema = new mongoose.Schema({
  // Owner information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Media file information
  filename: {
    type: String,
    required: true,
    index: true
  },
  url: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['image', 'video', 'gif'],
    required: true
  },
  mimetype: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    default: 0
  },

  // Responsive sizes (if generated)
  sizes: {
    thumbnail: String,
    small: String,
    medium: String,
    // Avatar/feed specific sizes
    avatar: {
      webp: String,
      avif: String
    },
    feed: {
      webp: String,
      avif: String
    },
    full: {
      webp: String,
      avif: String
    }
  },

  // Status tracking
  status: {
    type: String,
    enum: ['temporary', 'attached', 'published', 'deleted'],
    default: 'temporary',
    index: true
  },

  // Owner relationship
  ownerType: {
    type: String,
    enum: ['none', 'draft', 'post', 'journal', 'longform', 'photoessay'],
    default: 'none'
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
    index: true
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  attachedAt: {
    type: Date,
    default: null
  },
  publishedAt: {
    type: Date,
    default: null
  },
  deletedAt: {
    type: Date,
    default: null
  },

  // Cleanup tracking
  cleanupAttempts: {
    type: Number,
    default: 0
  },
  lastCleanupAttempt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
tempMediaSchema.index({ status: 1, createdAt: 1 }); // For cleanup job
tempMediaSchema.index({ userId: 1, status: 1 }); // For user media queries
tempMediaSchema.index({ ownerId: 1, ownerType: 1 }); // For owner lookups

// Virtual for age calculation
tempMediaSchema.virtual('ageMinutes').get(function() {
  return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60));
});

// Static method to find orphaned media for cleanup
tempMediaSchema.statics.findOrphanedMedia = function(maxAgeMinutes = 60) {
  const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  return this.find({
    status: 'temporary',
    ownerId: null,
    createdAt: { $lt: cutoffTime }
  });
};

// Static method to attach media to a draft
tempMediaSchema.statics.attachToDraft = async function(mediaId, draftId, userId) {
  return this.findOneAndUpdate(
    { _id: mediaId, userId, status: { $in: ['temporary', 'attached'] } },
    { 
      status: 'attached',
      ownerType: 'draft',
      ownerId: draftId,
      attachedAt: new Date()
    },
    { new: true }
  );
};

// Static method to mark media as published
tempMediaSchema.statics.markAsPublished = async function(draftId, postId) {
  return this.updateMany(
    { ownerId: draftId, ownerType: 'draft' },
    { 
      status: 'published',
      ownerType: 'post',
      ownerId: postId,
      publishedAt: new Date()
    }
  );
};

const TempMedia = mongoose.model('TempMedia', tempMediaSchema);

export default TempMedia;

