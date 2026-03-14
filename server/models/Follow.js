/**
 * Follow model — dedicated collection for the social graph.
 *
 * Each document represents a single directed follow edge:
 *   follower → following
 *
 * Benefits over the legacy User.followers/following arrays:
 *  - O(1) lookups via compound index instead of array scans on User documents
 *  - Independent pagination without loading entire User documents
 *  - Supports follower timestamps, mutual-follow detection, and analytics
 *  - Eliminates document size pressure on very popular accounts
 *
 * Migration: run scripts/migrateFollows.js to backfill from User arrays.
 * Legacy User.followers / User.following arrays are kept in sync during the
 * transition period; they will be removed in a future release.
 */

import mongoose from 'mongoose';

const followSchema = new mongoose.Schema({
  follower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  following: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

// One follow edge per pair — prevents duplicate rows
followSchema.index({ follower: 1, following: 1 }, { unique: true });

// Look up all followers of a user efficiently
followSchema.index({ following: 1, createdAt: -1 });

// Look up everyone a user follows efficiently
followSchema.index({ follower: 1, createdAt: -1 });

export default mongoose.model('Follow', followSchema);
