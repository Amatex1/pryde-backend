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
  hashtags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  // PHASE 4: Community tags for discovery
  tags: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tag'
  }],
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
      required: true,
      maxlength: 1000
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
  shares: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    sharedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Shared/Reposted content
  isShared: {
    type: Boolean,
    default: false
  },
  originalPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    default: null
  },
  shareComment: {
    type: String,
    maxlength: 500,
    default: ''
  },
  // PHASE 1 REFACTOR: Simplified to 3 options (removed 'friends' and 'custom')
  visibility: {
    type: String,
    enum: ['public', 'followers', 'private'],
    default: 'followers'
  },
  // PHASE 1 REFACTOR: Deprecated custom privacy fields (kept for legacy data)
  hiddenFrom: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    select: false // Hide from queries by default
  }],
  sharedWith: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    select: false // Hide from queries by default
  }],
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
  }
});

// Index for efficient queries
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });

// Update the updatedAt timestamp and extract hashtags before saving
postSchema.pre('save', function(next) {
  this.updatedAt = Date.now();

  // Extract hashtags from content
  if (this.content) {
    const hashtagRegex = /#[\w]+/g;
    const matches = this.content.match(hashtagRegex);
    if (matches) {
      this.hashtags = [...new Set(matches.map(tag => tag.toLowerCase()))];
    }
  }

  next();
});

export default mongoose.model('Post', postSchema);

