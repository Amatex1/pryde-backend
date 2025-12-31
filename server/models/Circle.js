/**
 * Life-Signal Feature 4: Small Circles (Micro-Communities)
 * 
 * Intimate groups with a 20 member limit.
 * - Invite-only by default
 * - Separate feed per circle (not in global feed)
 * - Slower posting encouraged, minimal notifications
 * - No discovery algorithm, no public metrics
 */

import mongoose from 'mongoose';

const circleSchema = new mongoose.Schema({
  // Circle name
  name: {
    type: String,
    required: true,
    maxlength: 100,
    trim: true
  },
  
  // Required intent statement - what is this circle for?
  intent: {
    type: String,
    required: true,
    maxlength: 500,
    trim: true
  },
  
  // Optional rules or norms (e.g., "Lurking welcome")
  rules: {
    type: String,
    maxlength: 1000,
    default: '',
    trim: true
  },
  
  // Circle owner
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Maximum members allowed (capped at 20)
  memberLimit: {
    type: Number,
    default: 20,
    max: 20,
    min: 2
  },
  
  // Always invite-only for intimacy
  isInviteOnly: {
    type: Boolean,
    default: true
  },
  
  // Circle visibility - unlisted by default
  visibility: {
    type: String,
    enum: ['unlisted', 'members_only'],
    default: 'unlisted'
  },
  
  // When the circle was created
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  // When the circle was last active
  lastActivityAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for efficient queries
circleSchema.index({ owner: 1 });
circleSchema.index({ createdAt: -1 });
circleSchema.index({ lastActivityAt: -1 });

const Circle = mongoose.model('Circle', circleSchema);

export default Circle;

