/**
 * PHASE 4: Tag Model
 * Community tags for discovery and browsing
 */

import mongoose from 'mongoose';

const tagSchema = new mongoose.Schema({
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[a-z0-9-]+$/
  },
  label: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    maxlength: 500,
    default: ''
  },
  icon: {
    type: String,
    default: '🏷️'
  },
  postCount: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
tagSchema.index({ slug: 1 });
tagSchema.index({ postCount: -1 });

const Tag = mongoose.model('Tag', tagSchema);

export default Tag;

