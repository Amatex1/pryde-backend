/**
 * System Prompt Model
 * 
 * Rotating prompts that the pryde_prompts system account posts to the feed.
 * These create a gentle "heartbeat" for the platform without pressure.
 * 
 * Key features:
 * - Rotation logic: oldest lastPostedAt gets selected next
 * - No engagement tracking (by design)
 * - Admin can enable/disable individual prompts
 * - Global pause capability via SystemConfig
 */

import mongoose from 'mongoose';

const systemPromptSchema = new mongoose.Schema({
  // The prompt text shown in the post
  text: {
    type: String,
    required: true,
    maxlength: 1000,
    trim: true
  },
  
  // Optional category for organization
  category: {
    type: String,
    enum: ['reflection', 'grounding', 'identity', 'connection', 'general', null],
    default: 'general'
  },
  
  // Whether this prompt is available for rotation
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // When this prompt was last posted (null = never posted)
  lastPostedAt: {
    type: Date,
    default: null,
    index: true
  },
  
  // Reference to the Post created when this prompt was posted
  lastPostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    default: null
  },
  
  // How many times this prompt has been posted (for analytics, not user-facing)
  timesPosted: {
    type: Number,
    default: 0
  },
  
  // Admin who created the prompt (null for seeded prompts)
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Indexes for efficient queries
systemPromptSchema.index({ isActive: 1, lastPostedAt: 1 }); // For rotation query
systemPromptSchema.index({ createdAt: -1 }); // For admin listing

/**
 * Static method to get the next prompt to post
 * Rotation logic:
 * 1. Select prompts where isActive === true
 * 2. Prefer prompts where lastPostedAt IS NULL (never posted)
 * 3. Otherwise, select the oldest lastPostedAt
 */
systemPromptSchema.statics.getNextPrompt = async function() {
  // First, try to find a prompt that has never been posted
  let prompt = await this.findOne({
    isActive: true,
    lastPostedAt: null
  }).sort({ createdAt: 1 }); // Oldest created first

  if (prompt) {
    return prompt;
  }

  // All prompts have been posted at least once, get the oldest
  prompt = await this.findOne({
    isActive: true
  }).sort({ lastPostedAt: 1 }); // Oldest posted first

  return prompt;
};

/**
 * Instance method to mark this prompt as posted
 */
systemPromptSchema.methods.markAsPosted = async function(postId) {
  this.lastPostedAt = new Date();
  this.lastPostId = postId;
  this.timesPosted = (this.timesPosted || 0) + 1;
  return this.save();
};

const SystemPrompt = mongoose.model('SystemPrompt', systemPromptSchema);

export default SystemPrompt;

