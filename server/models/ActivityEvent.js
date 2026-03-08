/**
 * ActivityEvent Model
 * 
 * Tracks community activity events for the activity feed layer.
 * Events include: new_member, first_post, active_discussion, trending_post, community_prompt
 * 
 * All systems are additive - no changes to existing post models.
 */

import mongoose from 'mongoose';

const activityEventSchema = new mongoose.Schema({
  // Event type
  type: {
    type: String,
    enum: ['new_member', 'first_post', 'active_discussion', 'trending_post', 'community_prompt', 'badge_earned'],
    required: true,
    index: true
  },
  
  // Optional reference to user who triggered this event
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Optional reference to post related to this event
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    default: null
  },
  
  // Additional metadata for the event
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Badge-specific fields (for badge_earned events)
  badgeId: {
    type: String,
    default: null
  },
  
  // System-generated flag (for community prompts)
  systemGenerated: {
    type: Boolean,
    default: false
  },
  
  // Whether this event has been processed/displayed
  processed: {
    type: Boolean,
    default: false
  },
  
  // Timestamp (explicit for sorting)
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound indexes for efficient queries
activityEventSchema.index({ type: 1, createdAt: -1 });
activityEventSchema.index({ userId: 1, createdAt: -1 });
activityEventSchema.index({ postId: 1, createdAt: -1 });
activityEventSchema.index({ processed: 1, createdAt: -1 });

// TTL index: auto-delete events older than 7 days (keep feed fresh)
activityEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

// Virtual for formatted message
activityEventSchema.virtual('message', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Ensure virtuals are included
activityEventSchema.set('toJSON', { virtuals: true });
activityEventSchema.set('toObject', { virtuals: true });

// Static method to create activity event
activityEventSchema.statics.createEvent = async function(data) {
  const { type, userId, postId, meta = {}, systemGenerated = false, badgeId = null } = data;
  
  const event = new this({
    type,
    userId,
    postId,
    meta,
    systemGenerated,
    badgeId,
    createdAt: new Date()
  });
  
  await event.save();
  return event;
};

// Static method to get recent events for feed
activityEventSchema.statics.getRecentEvents = async function(options = {}) {
  const { limit = 20, types = null, hoursAgo = 24 } = options;
  
  const query = {
    createdAt: { $gte: new Date(Date.now() - hoursAgo * 60 * 60 * 1000) }
  };
  
  if (types && Array.isArray(types)) {
    query.type = { $in: types };
  }
  
  return this.find(query)
    .populate('userId', 'username displayName profilePhoto')
    .populate('postId', 'content author')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

export default mongoose.model('ActivityEvent', activityEventSchema);
