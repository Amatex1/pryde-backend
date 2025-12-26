/**
 * Migration Phase: TAGS → GROUPS (Phase 0 - Foundation)
 * 
 * TagGroupMapping - Legacy bridge collection
 * 
 * PURPOSE:
 * - Maps legacy tag slugs to new group IDs
 * - Used ONLY for migration and backward compatibility
 * - Allows /tags/:slug to detect if tag has been migrated to a group
 * - Does NOT modify or interact with Tag model
 * 
 * NOTE: Tags are still legacy-active. This is a read-only lookup table.
 */

import mongoose from 'mongoose';

const tagGroupMappingSchema = new mongoose.Schema({
  // The legacy tag slug (e.g., 'deepthoughts', 'queerlife')
  legacyTag: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  // Reference to the new Group
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
    index: true
  },
  // When this mapping was created
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for efficient lookups
tagGroupMappingSchema.index({ legacyTag: 1 }, { unique: true });
tagGroupMappingSchema.index({ groupId: 1 });

const TagGroupMapping = mongoose.model('TagGroupMapping', tagGroupMappingSchema);

export default TagGroupMapping;

