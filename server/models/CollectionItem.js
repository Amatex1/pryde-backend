/**
 * Life-Signal Feature 2: Collection Items
 * 
 * Links posts to collections with optional notes.
 * - Posts can be in multiple collections
 * - Optional personal note per saved item
 */

import mongoose from 'mongoose';

const collectionItemSchema = new mongoose.Schema({
  // The collection this item belongs to
  collection: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Collection',
    required: true,
    index: true
  },
  
  // The saved post
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
    index: true
  },
  
  // Optional personal note about why this was saved
  note: {
    type: String,
    maxlength: 500,
    default: '',
    trim: true
  },
  
  // When the item was added
  addedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to prevent duplicates
collectionItemSchema.index({ collection: 1, post: 1 }, { unique: true });

// Index for efficient lookups
collectionItemSchema.index({ collection: 1, addedAt: -1 });
collectionItemSchema.index({ post: 1 });

const CollectionItem = mongoose.model('CollectionItem', collectionItemSchema);

export default CollectionItem;

