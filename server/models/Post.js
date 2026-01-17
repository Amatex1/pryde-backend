import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // PHASE C: Acting On Behalf Of
  // When an admin posts as a system account:
  // - author = system account (what users see)
  // - createdBy = admin who actually created it (audit trail)
  // For regular posts: createdBy = author
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  content: {
    type: String,
    required: false,
    maxlength: 5000
  },
  /**
   * Phase 2: Group-only posting
   *
   * groupId links a post to a specific Group.
   * - null = normal post (appears in global feed, profile, etc.)
   * - ObjectId = group post (ONLY visible within that group)
   *
   * Group posts are intentionally isolated from global feeds.
   * Tags are legacy entry points only.
   */
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    default: null,
    index: true
  },

  /**
   * Life-Signal Feature 4: Circle-only posting
   *
   * circleId links a post to a specific Circle (micro-community).
   * - null = normal post
   * - ObjectId = circle post (ONLY visible within that circle)
   *
   * Circle posts are intentionally isolated from global feeds.
   */
  circleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Circle',
    default: null,
    index: true
  },
  // REMOVED 2025-12-26: hashtags, tags, tagOnly deleted (Phase 5)
  images: [{
    type: String
  }],
  media: [{
    url: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['image', 'video', 'gif'],
      required: true
    },
    sizes: {
      thumbnail: String,
      small: String,
      medium: String
    }
  }],
  // GIF URL for posts (alternative to media array for GIF-only posts)
  gifUrl: {
    type: String,
    required: false
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    emoji: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // NOTE: Embedded comments array kept for backward compatibility
  // The codebase heavily relies on post.comments.id(), post.comments.push(), populate('comments.user'), etc.
  // Future migration: Move to Comment collection only, but requires refactoring ~50+ usages
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
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
    edited: {
      type: Boolean,
      default: false
    },
    editedAt: {
      type: Date
    },
    reactions: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      emoji: {
        type: String,
        required: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    createdAt: {
      type: Date,
      default: Date.now
    },
    // Threaded comments (replies)
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    replies: [{
      type: mongoose.Schema.Types.ObjectId
    }]
  }],
  // REMOVED 2025-12-26: shares, isShared, originalPost, shareComment deleted (Phase 5)
  // PHASE 1 REFACTOR: Simplified to 3 options (removed 'friends' and 'custom')
  // Phase 2: Added 'group' visibility for group-only posts
  visibility: {
    type: String,
    enum: ['public', 'followers', 'private', 'group'],
    default: 'followers'
  },
  // REMOVED 2025-12-26: hiddenFrom, sharedWith deleted (Phase 5)
  contentWarning: {
    type: String,
    default: '',
    maxlength: 100
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  // PHASE 2: Slow Feed - optional manual promotion
  promotedUntil: {
    type: Date,
    default: null
  },
  // OPTIONAL FEATURES: Pinned posts
  isPinned: {
    type: Boolean,
    default: false
  },
  pinnedAt: {
    type: Date,
    default: null
  },
  // System posts are created by the pryde_prompts account automatically
  // They have special styling and bypass rate limits
  isSystemPost: {
    type: Boolean,
    default: false,
    index: true
  },
  // Per-post hide metrics
  hideMetrics: {
    type: Boolean,
    default: false
  },
  /**
   * Phase 6A: Post locking (disable replies)
   * Locked posts can be viewed but not replied to
   * Owner/moderators can lock/unlock
   */
  isLocked: {
    type: Boolean,
    default: false
  },
  lockedAt: {
    type: Date,
    default: null
  },
  lockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // REMOVED 2025-12-26: editHistory deleted (Phase 5)
  // Poll feature
  poll: {
    question: {
      type: String,
      maxlength: 200
    },
    options: [{
      text: {
        type: String,
        required: true,
        maxlength: 100
      },
      votes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }]
    }],
    endsAt: {
      type: Date,
      default: null
    },
    allowMultipleVotes: {
      type: Boolean,
      default: false
    },
    showResultsBeforeVoting: {
      type: Boolean,
      default: false
    },
    // Who can see poll results: 'public' (everyone) or 'author' (poster only)
    // Note: null is allowed for backward compatibility with existing posts that have poll: null
    resultsVisibility: {
      type: String,
      enum: ['public', 'author', null],
      default: 'public'
    }
  }
});

// Indexes for efficient queries
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ visibility: 1, createdAt: -1 }); // For filtering by visibility
// Phase 2: Index for group posts - efficient group feed queries
postSchema.index({ groupId: 1, createdAt: -1 });
// Life-Signal Feature 4: Index for circle posts
postSchema.index({ circleId: 1, createdAt: -1 });
// REMOVED 2025-12-26: hashtags and tags indexes deleted (Phase 5)

// PERFORMANCE: Critical compound indexes for feed queries (40-60% faster)
postSchema.index({ visibility: 1, groupId: 1, createdAt: -1 }); // Global feed filtering
postSchema.index({ visibility: 1, author: 1, groupId: 1, createdAt: -1 }); // Followers feed
postSchema.index({ isPinned: -1, createdAt: -1 }); // Pinned post sorting
postSchema.index({ isLocked: 1, createdAt: -1 }); // Locked post queries

// Virtual for comment count from Comment collection
postSchema.virtual('commentCount', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'postId',
  count: true,
  match: { isDeleted: false, parentCommentId: null } // Only count top-level, non-deleted comments
});

// Ensure virtuals are included when converting to JSON
postSchema.set('toJSON', { virtuals: true });
postSchema.set('toObject', { virtuals: true });

// Update the updatedAt timestamp before saving
postSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  // REMOVED 2025-12-26: hashtag extraction deleted (Phase 5)
  next();
});

export default mongoose.model('Post', postSchema);

