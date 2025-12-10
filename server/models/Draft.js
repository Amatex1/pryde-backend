import mongoose from 'mongoose';

const draftSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  draftType: {
    type: String,
    enum: ['post', 'journal', 'longform', 'photoEssay'],
    required: true
  },
  // Post/Journal/Longform fields
  content: {
    type: String,
    default: '',
    maxlength: 100000
  },
  title: {
    type: String,
    default: '',
    maxlength: 300
  },
  body: {
    type: String,
    default: '',
    maxlength: 100000
  },
  // Media
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
  coverImage: {
    type: String,
    default: ''
  },
  // Settings
  visibility: {
    type: String,
    enum: ['public', 'followers', 'private'],
    default: 'followers'
  },
  contentWarning: {
    type: String,
    default: '',
    maxlength: 100
  },
  hideMetrics: {
    type: Boolean,
    default: false
  },
  // Journal-specific
  mood: {
    type: String,
    enum: ['happy', 'sad', 'anxious', 'calm', 'excited', 'reflective', 'grateful', 'other'],
    default: null
  },
  // Tags
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  // Poll (for post drafts)
  poll: {
    question: {
      type: String,
      maxlength: 200
    },
    options: [{
      text: {
        type: String,
        maxlength: 100
      }
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
  },
  // Auto-save tracking
  lastAutoSaved: {
    type: Date,
    default: Date.now
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
draftSchema.index({ user: 1, draftType: 1, updatedAt: -1 });
draftSchema.index({ user: 1, updatedAt: -1 });

// Update the updatedAt timestamp before saving
draftSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  this.lastAutoSaved = Date.now();
  next();
});

export default mongoose.model('Draft', draftSchema);

