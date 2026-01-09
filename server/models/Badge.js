/**
 * Badge Model
 *
 * Non-hierarchical badge system for user recognition.
 * Badges are either automatic (system-assigned) or manual (admin-assigned).
 *
 * Assignment Types:
 * - automatic: System-assigned based on rules (view-only in admin)
 * - manual: Admin-assigned with required reason
 *
 * Badge Types:
 * - platform: Official Pryde team/staff badges
 * - community: Community recognition badges
 * - activity: Earned through platform activity
 *
 * Badge Categories (for user control):
 * - CORE_ROLE: Founder/Admin/Moderator/Verified (always visible, cannot be hidden)
 * - STATUS: Active this month, Group organizer, Profile complete, Event host (user-controlled)
 * - COSMETIC: Pride flags, Fun emojis, Seasonal, Collectibles (user-controlled)
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
  // Badge category for user control (determines if user can hide it)
  category: {
    type: String,
    enum: ['CORE_ROLE', 'STATUS', 'COSMETIC'],
    default: 'STATUS'
  },
  // Assignment type: automatic (system) or manual (admin)
  assignmentType: {
    type: String,
    enum: ['automatic', 'manual'],
    default: 'manual'
  },
  // For automatic badges: the rule that triggers assignment
  // e.g., 'early_member', 'founding_member', 'profile_complete', 'active_this_month', 'group_organizer'
  automaticRule: {
    type: String,
    default: null
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
  // User-facing description explaining what this badge means
  description: {
    type: String,
    default: '',
    maxlength: 500
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
badgeSchema.index({ assignmentType: 1 });
badgeSchema.index({ automaticRule: 1 });

const Badge = mongoose.model('Badge', badgeSchema);

export default Badge;

