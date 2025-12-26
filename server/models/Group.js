/**
 * Migration Phase: TAGS → GROUPS (Phase 0 - Foundation)
 * 
 * Group Model - Private, join-gated community groups
 * 
 * NOTE: Tags are still legacy-active. This model is for the new group system.
 * No references to Tag model internally - groups are standalone.
 */

import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema({
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[a-z0-9-]+$/,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    default: '',
    maxlength: 500
  },
  visibility: {
    type: String,
    enum: ['private', 'public', 'hidden'],
    default: 'private'
  },
  // Admin approval status for user-created groups
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved' // Existing groups default to approved
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  moderators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Migration Phase: TAGS → GROUPS
  // This field records which legacy tag this group was created from
  // Used ONLY for backward compatibility and migration tracking
  // No direct reference to Tag model - just stores the slug string
  createdFromTag: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for efficient queries
groupSchema.index({ slug: 1 }, { unique: true });
groupSchema.index({ owner: 1 });
groupSchema.index({ members: 1 });
groupSchema.index({ visibility: 1 });
groupSchema.index({ status: 1 });
groupSchema.index({ createdFromTag: 1 });

// Update the updatedAt timestamp before saving
groupSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Helper method to check if a user is a member
groupSchema.methods.isMember = function(userId) {
  const userIdStr = userId.toString();
  return this.members.some(m => m.toString() === userIdStr) ||
         this.moderators.some(m => m.toString() === userIdStr) ||
         this.owner.toString() === userIdStr;
};

// Helper method to check if a user is a moderator or owner
groupSchema.methods.canModerate = function(userId) {
  const userIdStr = userId.toString();
  return this.moderators.some(m => m.toString() === userIdStr) ||
         this.owner.toString() === userIdStr;
};

const Group = mongoose.model('Group', groupSchema);

export default Group;

