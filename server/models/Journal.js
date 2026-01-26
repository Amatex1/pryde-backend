/**
 * PHASE 3: Journal Model
 * Personal journaling for reflection and creative expression
 */

import mongoose from 'mongoose';

const journalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    maxlength: 200,
    trim: true
  },
  body: {
    type: String,
    required: true,
    maxlength: 50000 // Allow long journal entries
  },
  visibility: {
    type: String,
    enum: ['public', 'followers', 'private'],
    default: 'private' // Journals default to private
  },
  mood: {
    type: String,
    enum: ['happy', 'sad', 'anxious', 'calm', 'excited', 'reflective', 'grateful', 'other', null],
    default: null
  },
  tags: [{
    type: String,
    lowercase: true,
    trim: true
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
journalSchema.index({ user: 1, createdAt: -1 }); // For user's journal timeline
journalSchema.index({ visibility: 1, createdAt: -1 }); // For public/followers journal discovery
journalSchema.index({ tags: 1 }); // For tag-based discovery

// Update the updatedAt timestamp before saving
journalSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Journal = mongoose.model('Journal', journalSchema);

export default Journal;

