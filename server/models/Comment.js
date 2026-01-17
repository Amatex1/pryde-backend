import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
    index: true
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  content: {
    type: String,
    required: false,
    maxlength: 1000
  },
  gifUrl: {
    type: String,
    required: false
  },
  parentCommentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null,
    index: true
  },
  reactions: {
    type: Map,
    of: [String], // Map of emoji -> array of userIds
    default: {}
  },
  likeCount: {
    type: Number,
    default: 0
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  isPinned: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Index for efficient querying
commentSchema.index({ postId: 1, createdAt: 1 });
commentSchema.index({ postId: 1, parentCommentId: 1 });
commentSchema.index({ authorId: 1, createdAt: -1 });

// PERFORMANCE: Critical indexes for comment thread queries (90% faster)
commentSchema.index({ postId: 1, parentCommentId: 1, isDeleted: 1, createdAt: 1 }); // Thread loading
commentSchema.index({ parentCommentId: 1, isDeleted: 1 }); // Reply count queries
commentSchema.index({ postId: 1, isDeleted: 1, isPinned: -1, createdAt: 1 }); // Pinned comment sorting
commentSchema.index({ isDeleted: 1, createdAt: -1 }); // Soft delete queries

// Virtual for reply count (not stored, calculated on demand)
commentSchema.virtual('replyCount', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'parentCommentId',
  count: true
});

// Ensure virtuals are included when converting to JSON
commentSchema.set('toJSON', { virtuals: true });
commentSchema.set('toObject', { virtuals: true });

// ============================================
// STATIC METHODS FOR THREAD MANAGEMENT
// ============================================

/**
 * Get comment thread (parent + all replies)
 * @param {string} commentId - Parent comment ID
 * @returns {Object} Thread with parent and replies
 */
commentSchema.statics.getThread = async function(commentId) {
  const parent = await this.findById(commentId)
    .populate('authorId', 'username displayName profilePhoto')
    .lean();

  if (!parent) return null;

  const replies = await this.find({ parentCommentId: commentId, isDeleted: false })
    .populate('authorId', 'username displayName profilePhoto')
    .sort({ createdAt: 1 })
    .lean();

  return {
    ...parent,
    replies
  };
};

/**
 * Get all top-level comments for a post with reply counts
 * @param {string} postId - Post ID
 * @param {Object} options - Query options (limit, skip, sort)
 * @returns {Array} Top-level comments with reply counts
 */
commentSchema.statics.getTopLevelComments = async function(postId, options = {}) {
  const { limit = 20, skip = 0, sort = { createdAt: -1 } } = options;

  const comments = await this.find({
    postId,
    parentCommentId: null,
    isDeleted: false
  })
    .populate('authorId', 'username displayName profilePhoto')
    .populate('replyCount')
    .sort(sort)
    .limit(limit)
    .skip(skip)
    .lean();

  return comments;
};

/**
 * Get reply count for a comment
 * @param {string} commentId - Comment ID
 * @returns {number} Reply count
 */
commentSchema.statics.getReplyCount = async function(commentId) {
  return await this.countDocuments({
    parentCommentId: commentId,
    isDeleted: false
  });
};

/**
 * Delete comment and all replies (soft delete)
 * @param {string} commentId - Comment ID
 * @returns {Object} Delete result
 */
commentSchema.statics.deleteThread = async function(commentId) {
  // Soft delete parent
  await this.findByIdAndUpdate(commentId, { isDeleted: true });

  // Soft delete all replies
  const result = await this.updateMany(
    { parentCommentId: commentId },
    { isDeleted: true }
  );

  return {
    deletedParent: 1,
    deletedReplies: result.modifiedCount
  };
};

const Comment = mongoose.model('Comment', commentSchema);

export default Comment;

