/**
 * PHASE 3: Longform Model
 * Longform creative posts for stories, essays, and articles
 */

import mongoose from 'mongoose';

const longformSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 300,
    trim: true
  },
  body: {
    type: String,
    required: true,
    maxlength: 100000 // Allow very long content
  },
  coverImage: {
    type: String,
    default: null
  },
  visibility: {
    type: String,
    enum: ['public', 'followers', 'private'],
    default: 'followers' // Longform defaults to followers
  },
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  readTime: {
    type: Number, // Estimated read time in minutes
    default: 0
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      required: true,
      maxlength: 2000
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  hideMetrics: {
    type: Boolean,
    default: false
  },
  editHistory: [{
    title: String,
    body: {
      type: String,
      required: true
    },
    editedAt: {
      type: Date,
      default: Date.now
    }
  }],
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
longformSchema.index({ user: 1, createdAt: -1 });
longformSchema.index({ visibility: 1, createdAt: -1 });
longformSchema.index({ tags: 1 });

// Calculate read time before saving (average 200 words per minute)
longformSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  if (this.body) {
    const wordCount = this.body.split(/\s+/).length;
    this.readTime = Math.ceil(wordCount / 200);
  }
  
  next();
});

const Longform = mongoose.model('Longform', longformSchema);

export default Longform;

