/**
 * Phase 6A: Group Moderation Log
 * 
 * Private log of all moderation actions within a group.
 * Visible ONLY to owner and moderators.
 * No public exposure, no export (yet).
 *
 * Logged Actions:
 * - join_approved: Join request approved
 * - join_declined: Join request declined
 * - member_removed: Member removed from group
 * - member_muted: Member muted (can view, cannot post)
 * - member_unmuted: Member unmuted
 * - member_blocked: User blocked from joining
 * - member_unblocked: User unblocked
 * - post_locked: Post locked (replies disabled)
 * - post_unlocked: Post unlocked
 * - post_deleted: Post deleted by moderator
 * - moderator_promoted: Member promoted to moderator
 * - moderator_demoted: Moderator demoted to member
 */

import mongoose from 'mongoose';

const groupModerationLogSchema = new mongoose.Schema({
  // The group this log entry belongs to
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
    index: true
  },
  // The user who performed the action (owner or moderator)
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // The type of moderation action
  action: {
    type: String,
    enum: [
      'join_approved',
      'join_declined',
      'member_removed',
      'member_muted',
      'member_unmuted',
      'member_blocked',
      'member_unblocked',
      'post_locked',
      'post_unlocked',
      'post_deleted',
      'moderator_promoted',
      'moderator_demoted'
    ],
    required: true,
    index: true
  },
  // The target of the action (user or post)
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  targetPostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    default: null
  },
  // Additional metadata (e.g., mute duration)
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // When the action was performed
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound indexes for efficient queries
groupModerationLogSchema.index({ groupId: 1, createdAt: -1 });
groupModerationLogSchema.index({ groupId: 1, action: 1 });
groupModerationLogSchema.index({ groupId: 1, targetUserId: 1 });

const GroupModerationLog = mongoose.model('GroupModerationLog', groupModerationLogSchema);

export default GroupModerationLog;

