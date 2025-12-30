/**
 * Phase 5A: Manual, Calm Group Discovery
 * Phase 6A: Group Moderation (Calm Owner Controls)
 *
 * Group Model - Private, join-gated community groups
 *
 * Visibility:
 * - listed: Appears in /groups index (public discovery)
 * - unlisted: Only accessible via direct link
 *
 * Join Mode:
 * - auto: Anyone can join immediately
 * - approval: Requires owner/moderator approval
 *
 * Moderation (Phase 6A):
 * - mutedMembers: Users who can view but not post/comment
 * - blockedUsers: Users who cannot re-request to join
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
  /**
   * Phase 5A: Discovery visibility
   * - listed: Appears in /groups index (default)
   * - unlisted: Direct link only
   *
   * NOTE: 'private', 'public', 'hidden' are legacy values, treated as:
   * - private/hidden → unlisted
   * - public → listed
   */
  visibility: {
    type: String,
    enum: ['listed', 'unlisted', 'private', 'public', 'hidden'],
    default: 'listed'
  },
  /**
   * Phase 5A: Join mode
   * - auto: Anyone can join immediately
   * - approval: Requires owner/moderator approval (default)
   */
  joinMode: {
    type: String,
    enum: ['auto', 'approval'],
    default: 'approval'
  },
  /**
   * Phase 5A: Pending join requests
   * Users who have requested to join (when joinMode = 'approval')
   */
  joinRequests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
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
  /**
   * Phase 6A: Muted members
   * Users who can view group content but cannot post or comment
   * Mute can be permanent (mutedUntil = null) or temporary
   */
  mutedMembers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    mutedAt: {
      type: Date,
      default: Date.now
    },
    mutedUntil: {
      type: Date,
      default: null // null = permanent, Date = temporary
    },
    mutedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  }],
  /**
   * Phase 6A: Blocked users
   * Users who cannot request to join this group
   * Removed members are NOT automatically blocked - they can re-request
   */
  blockedUsers: [{
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
groupSchema.index({ joinMode: 1 });
groupSchema.index({ joinRequests: 1 });
// Phase 6A: Indexes for moderation
groupSchema.index({ 'mutedMembers.user': 1 });
groupSchema.index({ blockedUsers: 1 });

// Update the updatedAt timestamp before saving
groupSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

/**
 * Phase 5A: Normalize legacy visibility values
 * Maps old values to new listed/unlisted system
 */
groupSchema.methods.isListed = function() {
  // 'listed' and 'public' are listed; everything else is unlisted
  return this.visibility === 'listed' || this.visibility === 'public';
};

// Helper method to check if a user is a member
groupSchema.methods.isMember = function(userId) {
  const userIdStr = userId.toString();

  // Handle both populated and unpopulated arrays
  const getMemberId = (m) => {
    if (!m) return null;
    if (m._id) return m._id.toString();
    return m.toString();
  };

  const getOwnerId = () => {
    if (!this.owner) return null;
    if (this.owner._id) return this.owner._id.toString();
    return this.owner.toString();
  };

  return this.members.some(m => getMemberId(m) === userIdStr) ||
         this.moderators.some(m => getMemberId(m) === userIdStr) ||
         getOwnerId() === userIdStr;
};

// Helper method to check if a user is a moderator or owner
groupSchema.methods.canModerate = function(userId) {
  const userIdStr = userId.toString();

  // Handle both populated and unpopulated arrays
  const getId = (m) => {
    if (!m) return null;
    if (m._id) return m._id.toString();
    return m.toString();
  };

  const getOwnerId = () => {
    if (!this.owner) return null;
    if (this.owner._id) return this.owner._id.toString();
    return this.owner.toString();
  };

  return this.moderators.some(m => getId(m) === userIdStr) ||
         getOwnerId() === userIdStr;
};

// Phase 5A: Check if user has a pending join request
groupSchema.methods.hasPendingRequest = function(userId) {
  const userIdStr = userId.toString();
  return this.joinRequests?.some(r => r.toString() === userIdStr) || false;
};

/**
 * Phase 6A: Check if a user is muted (cannot post/comment)
 * Returns the mute record if muted, null otherwise
 */
groupSchema.methods.isMuted = function(userId) {
  const userIdStr = userId.toString();
  const mute = this.mutedMembers?.find(m =>
    m.user.toString() === userIdStr
  );

  if (!mute) return null;

  // Check if mute has expired
  if (mute.mutedUntil && new Date(mute.mutedUntil) < new Date()) {
    return null; // Mute expired
  }

  return mute;
};

/**
 * Phase 6A: Check if a user is blocked (cannot join)
 */
groupSchema.methods.isBlocked = function(userId) {
  const userIdStr = userId.toString();
  return this.blockedUsers?.some(b => b.toString() === userIdStr) || false;
};

/**
 * Phase 6A: Check if user can post/comment in the group
 * Members can post unless muted
 */
groupSchema.methods.canPost = function(userId) {
  if (!this.isMember(userId)) return false;
  return !this.isMuted(userId);
};

const Group = mongoose.model('Group', groupSchema);

export default Group;

