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
  tags: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tag'
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
photoEssaySchema.index({ user: 1, createdAt: -1 });
photoEssaySchema.index({ visibility: 1, createdAt: -1 });

// Update the updatedAt timestamp before saving
photoEssaySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const PhotoEssay = mongoose.model('PhotoEssay', photoEssaySchema);

export default PhotoEssay;

