/**
 * Moderation Settings Model
 * 
 * Stores configurable auto-moderation settings that admins can adjust.
 * Uses a singleton pattern - there's only one document in this collection.
 */

import mongoose from 'mongoose';

const moderationSettingsSchema = new mongoose.Schema({
  // Singleton key - ensures only one document exists
  _singleton: {
    type: String,
    default: 'settings',
    unique: true,
    immutable: true
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOCKED WORDS CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════
  blockedWords: {
    // Profanity words
    profanity: {
      type: [String],
      default: ['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'damn', 'crap']
    },
    // Slurs and hate speech
    slurs: {
      type: [String],
      default: []
    },
    // Sexual content keywords
    sexual: {
      type: [String],
      default: ['porn', 'xxx', 'nude', 'naked']
    },
    // Spam indicator phrases
    spam: {
      type: [String],
      default: ['click here', 'buy now', 'limited time', 'act now', 'free money', 'make money fast', 'work from home', 'lose weight fast']
    },
    // Custom words added by admins
    custom: {
      type: [String],
      default: []
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTO-MUTE CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════
  autoMute: {
    // Global toggle for auto-mute
    enabled: {
      type: Boolean,
      default: true
    },
    // Number of violations before auto-mute kicks in
    violationThreshold: {
      type: Number,
      default: 3,
      min: 1,
      max: 10
    },
    // Minutes per violation (mute duration = violations * this value)
    minutesPerViolation: {
      type: Number,
      default: 30,
      min: 5,
      max: 1440
    },
    // Maximum mute duration in minutes (24 hours default)
    maxMuteDuration: {
      type: Number,
      default: 1440,
      min: 60,
      max: 10080 // 7 days
    },
    // Spam mute duration in minutes
    spamMuteDuration: {
      type: Number,
      default: 60,
      min: 15,
      max: 1440
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TOXICITY CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════
  toxicity: {
    // Score threshold for warnings (0-100)
    warningThreshold: {
      type: Number,
      default: 50,
      min: 10,
      max: 100
    },
    // Points per blocked word found
    pointsPerBlockedWord: {
      type: Number,
      default: 10,
      min: 1,
      max: 50
    },
    // Points for spam content
    pointsForSpam: {
      type: Number,
      default: 20,
      min: 5,
      max: 50
    }
  },

  // Who last updated these settings
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

/**
 * Static method to get the settings (creates default if none exist)
 */
moderationSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne({ _singleton: 'settings' });
  if (!settings) {
    settings = await this.create({ _singleton: 'settings' });
  }
  return settings;
};

/**
 * Static method to update settings
 */
moderationSettingsSchema.statics.updateSettings = async function(updates, userId = null) {
  return this.findOneAndUpdate(
    { _singleton: 'settings' },
    { ...updates, updatedBy: userId },
    { upsert: true, new: true, runValidators: true }
  );
};

/**
 * Get all blocked words as a flat array
 */
moderationSettingsSchema.methods.getAllBlockedWords = function() {
  const { profanity, slurs, sexual, spam, custom } = this.blockedWords;
  return [...profanity, ...slurs, ...sexual, ...spam, ...custom];
};

const ModerationSettings = mongoose.model('ModerationSettings', moderationSettingsSchema);

export default ModerationSettings;

