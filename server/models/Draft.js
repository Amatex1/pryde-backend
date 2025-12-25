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
  // Media - CRITICAL: All fields optional for drafts
  // Drafts should accept partial/incomplete media data
  media: [{
    url: {
      type: String
      // NOT required - drafts may have incomplete media
    },
    type: {
      type: String,
      enum: ['image', 'video', 'gif']
      // NOT required - drafts may not specify type yet
    },
    // TempMedia tracking ID for proper cleanup
    tempMediaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TempMedia'
      // Optional - legacy uploads may not have this
    },
    width: {
      type: Number
      // Optional - may not be available during draft
    },
    height: {
      type: Number
      // Optional - may not be available during draft
    },
    // Responsive sizes (if generated)
    sizes: {
      thumbnail: String,
      small: String,
      medium: String
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
  // CRITICAL: mood is optional - default: undefined allows absence
  // Enum validation only applies when value is present
  mood: {
    type: String,
    enum: ['happy', 'sad', 'anxious', 'calm', 'excited', 'reflective', 'grateful', 'other'],
    default: undefined // Allow absence, do NOT use null
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

