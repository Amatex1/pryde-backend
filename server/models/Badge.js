/**
 * Badge Model
 * 
 * Non-hierarchical badge system for user recognition.
 * Badges are assigned via admin tools or automated systems.
 * 
 * Types:
 * - platform: Official Pryde team/staff badges
 * - community: Community recognition badges
 * - activity: Earned through platform activity
 */

import mongoose from 'mongoose';

const badgeSchema = new mongoose.Schema({
  // Unique identifier for the badge (e.g., 'early_member', 'pryde_team')
  id: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  // Display label (e.g., 'Early Member', 'Pryde Team')
  label: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  // Badge category
  type: {
    type: String,
    enum: ['platform', 'community', 'activity'],
    required: true
  },
  // Emoji or icon identifier
  icon: {
    type: String,
    required: true,
    default: '⭐'
  },
  // Tooltip text shown on hover
  tooltip: {
    type: String,
    required: true,
    maxlength: 200
  },
  // Display priority (lower = shown first, max 2 shown inline)
  priority: {
    type: Number,
    default: 100
  },
  // Whether badge is currently assignable
  isActive: {
    type: Boolean,
    default: true
  },
  // CSS color class or hex color
  color: {
    type: String,
    default: 'default'
  }
}, {
  timestamps: true
});

// Index for efficient lookup
badgeSchema.index({ id: 1 });
badgeSchema.index({ type: 1, priority: 1 });

const Badge = mongoose.model('Badge', badgeSchema);

export default Badge;

