/**
 * Life-Signal Feature 1: Reflection Prompts
 * 
 * Admin-managed prompts that encourage reflection and creative expression.
 * - Displayed at top of feed & journals (dismissible)
 * - CTA options: Write privately (Journal), Share publicly (Post), Skip
 * - Opt-in only, no tracking, no streaks, no engagement stats
 */

import mongoose from 'mongoose';

const reflectionPromptSchema = new mongoose.Schema({
  // The prompt text shown to users
  text: {
    type: String,
    required: true,
    maxlength: 500,
    trim: true
  },
  
  // How often this prompt should appear
  cadence: {
    type: String,
    enum: ['daily', 'weekly'],
    default: 'daily'
  },
  
  // Only one prompt can be active at a time
  active: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Admin who created the prompt
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // When the prompt was created
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  // When the prompt was last activated
  activatedAt: {
    type: Date,
    default: null
  }
});

// Ensure only one prompt is active at a time
reflectionPromptSchema.pre('save', async function(next) {
  if (this.active && this.isModified('active')) {
    // Deactivate all other prompts when activating this one
    await mongoose.model('ReflectionPrompt').updateMany(
      { _id: { $ne: this._id } },
      { active: false }
    );
    this.activatedAt = Date.now();
  }
  next();
});

// Index for efficient active prompt lookup
reflectionPromptSchema.index({ active: 1 });
reflectionPromptSchema.index({ createdAt: -1 });

const ReflectionPrompt = mongoose.model('ReflectionPrompt', reflectionPromptSchema);

export default ReflectionPrompt;

