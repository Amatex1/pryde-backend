/**
 * Life-Signal Feature 2: Personal Collections (Expanded Bookmarks)
 * 
 * Named collections for organizing saved posts.
 * - Private by default, optional manual share toggle
 * - No public counts, no discovery, no notifications to authors
 */

import mongoose from 'mongoose';

const collectionSchema = new mongoose.Schema({
  // Owner of the collection
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Collection name
  title: {
    type: String,
    required: true,
    maxlength: 100,
    trim: true
  },
  
  // Optional description
  description: {
    type: String,
    maxlength: 500,
    default: '',
    trim: true
  },
  
  // Privacy setting - private by default
  isPrivate: {
    type: Boolean,
    default: true
  },
  
  // When the collection was created
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  // When the collection was last updated
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp before saving
collectionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes for efficient queries
collectionSchema.index({ user: 1, createdAt: -1 });
collectionSchema.index({ user: 1, title: 1 });

const Collection = mongoose.model('Collection', collectionSchema);

export default Collection;

