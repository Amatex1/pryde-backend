/**
 * PHASE 5: PhotoEssay Model
 * Rich visual storytelling through photo collections
 */

import mongoose from 'mongoose';

const photoEssaySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 200,
    trim: true
  },
  description: {
    type: String,
    maxlength: 2000,
    default: ''
  },
  photos: [{
    url: {
      type: String,
      required: true
    },
    caption: {
      type: String,
      maxlength: 500,
      default: ''
    },
    sortOrder: {
      type: Number,
      default: 0
    }
  }],
  visibility: {
    type: String,
    enum: ['public', 'followers', 'private'],
    default: 'public'
  },
  // 🔥 FIX: Changed from ObjectId ref to String array (Tag model deprecated in Phase 4C)
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
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
      maxlength: 1000
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
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for efficient queries
photoEssaySchema.index({ user: 1, createdAt: -1 }); // For user's photo essay timeline
photoEssaySchema.index({ visibility: 1, createdAt: -1 }); // For public/followers discovery
// 🔥 FIX: Updated index for string tags (not ObjectId refs anymore)
photoEssaySchema.index({ tags: 1 }); // For tag-based discovery (string array)

// Update the updatedAt timestamp before saving
photoEssaySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const PhotoEssay = mongoose.model('PhotoEssay', photoEssaySchema);

export default PhotoEssay;

