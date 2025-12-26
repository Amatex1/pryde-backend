import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  content: {
    type: String,
    required: false,
    maxlength: 5000
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
  visibility: {
    type: String,
    enum: ['public', 'followers', 'private'],
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
  // Per-post hide metrics
  hideMetrics: {
    type: Boolean,
    default: false
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
    }
  }
});

// Indexes for efficient queries
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ visibility: 1, createdAt: -1 }); // For filtering by visibility
// REMOVED 2025-12-26: hashtags and tags indexes deleted (Phase 5)

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

