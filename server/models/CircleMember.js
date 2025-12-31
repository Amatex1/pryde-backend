/**
 * Life-Signal Feature 4: Circle Members
 * 
 * Links users to circles with roles.
 * - Roles: owner, member
 * - Tracks when user joined
 */

import mongoose from 'mongoose';

const circleMemberSchema = new mongoose.Schema({
  // The circle
  circle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Circle',
    required: true,
    index: true
  },
  
  // The user
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Role in the circle
  role: {
    type: String,
    enum: ['owner', 'member'],
    default: 'member'
  },
  
  // When the user joined
  joinedAt: {
    type: Date,
    default: Date.now
  },
  
  // Last time user viewed the circle (for unread tracking)
  lastViewedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to prevent duplicate memberships
circleMemberSchema.index({ circle: 1, user: 1 }, { unique: true });

// Indexes for efficient queries
circleMemberSchema.index({ user: 1, joinedAt: -1 });
circleMemberSchema.index({ circle: 1, role: 1 });

const CircleMember = mongoose.model('CircleMember', circleMemberSchema);

export default CircleMember;

