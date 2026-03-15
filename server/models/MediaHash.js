import mongoose from 'mongoose';

/**
 * Tracks SHA-256 hashes of every uploaded file.
 *
 * Benefits:
 *  - Repeat-upload detection (spam / repost abuse)
 *  - Admin blocklist: flag a hash → all future uploads of that file are rejected
 *  - Storage deduplication awareness
 */
const mediaHashSchema = new mongoose.Schema({
  hash:        { type: String, required: true, unique: true, index: true },
  uploadCount: { type: Number, default: 1, min: 0 },
  firstSeenAt: { type: Date,   default: Date.now },
  lastSeenAt:  { type: Date,   default: Date.now },
  flagged:     { type: Boolean, default: false, index: true },
  flagReason:  { type: String,  default: null },
});

export default mongoose.model('MediaHash', mediaHashSchema);
