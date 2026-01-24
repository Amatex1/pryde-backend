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
  // Defaults tuned for human-centric, gentle enforcement
  // ═══════════════════════════════════════════════════════════════════════════
  autoMute: {
    // Global toggle for auto-mute
    enabled: {
      type: Boolean,
      default: true
    },
    // Number of speech violations before auto-mute kicks in (gentle default)
    violationThreshold: {
      type: Number,
      default: 5, // Phase 2B: Increased from 3 to 5 for gentler enforcement
      min: 1,
      max: 10
    },
    // Minutes per violation (mute duration = violations * this value)
    minutesPerViolation: {
      type: Number,
      default: 15, // Phase 2B: Reduced from 30 to 15 for gentler enforcement
      min: 5,
      max: 1440
    },
    // Maximum mute duration in minutes (6 hours default for gentler enforcement)
    maxMuteDuration: {
      type: Number,
      default: 360, // Phase 2B: Reduced from 1440 (24h) to 360 (6h)
      min: 60,
      max: 10080 // 7 days
    },
    // Spam mute duration in minutes (separate track from speech violations)
    spamMuteDuration: {
      type: Number,
      default: 60,
      min: 15,
      max: 1440
    },
    // Slur/hate speech immediate mute duration (zero tolerance)
    slurMuteDuration: {
      type: Number,
      default: 120, // 2 hours for first offense
      min: 30,
      max: 1440
    },
    // Slur escalation multiplier for repeat offenses
    slurEscalationMultiplier: {
      type: Number,
      default: 2,
      min: 1.5,
      max: 5
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VIOLATION DECAY CONFIGURATION (Forgiveness Mechanism)
  // ═══════════════════════════════════════════════════════════════════════════
  violationDecay: {
    // Enable time-based decay of violations
    enabled: {
      type: Boolean,
      default: true
    },
    // Days without violations before speech violations decay
    cleanPeriodDays: {
      type: Number,
      default: 7,
      min: 1,
      max: 90
    },
    // How many speech violations to decay per clean period
    decayAmount: {
      type: Number,
      default: 1,
      min: 1,
      max: 5
    },
    // Days without violations before spam violations decay
    spamCleanPeriodDays: {
      type: Number,
      default: 7,
      min: 1,
      max: 90
    },
    // Days without violations before slur violations decay (much slower)
    slurCleanPeriodDays: {
      type: Number,
      default: 30, // Slurs decay slowly - 30 days
      min: 14,
      max: 365
    },
    // Whether slur violations decay at all
    slurDecayEnabled: {
      type: Boolean,
      default: false // By default, slur violations do NOT decay
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TOXICITY CONFIGURATION
  // Toxicity is used for soft warnings and moderator prioritisation only.
  // It MUST NOT trigger auto-mute or auto-ban.
  // ═══════════════════════════════════════════════════════════════════════════
  toxicity: {
    // Score threshold for soft warnings (0-100)
    warningThreshold: {
      type: Number,
      default: 65, // Phase 2B: Increased from 50 to 65 for gentler warnings
      min: 10,
      max: 100
    },
    // Points per profanity word (0 = profanity doesn't affect toxicity)
    pointsPerProfanity: {
      type: Number,
      default: 0, // Phase 2B: Set to 0 - profanity is allowed
      min: 0,
      max: 20
    },
    // Points per blocked word (non-profanity categories)
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

  // ═══════════════════════════════════════════════════════════════════════════
  // WARNING MESSAGES (Human-Centric Language)
  // Three-tier warning system with supportive, non-punitive tone
  // ═══════════════════════════════════════════════════════════════════════════
  warningMessages: {
    // Tier 1: Soft signal (no punishment)
    tier1: {
      type: String,
      default: "Hey — this conversation's getting intense. You're allowed to express yourself here, just try to keep it from turning personal."
    },
    // Tier 2: Clear boundary
    tier2: {
      type: String,
      default: "Strong opinions are fine — attacks on people aren't. Please adjust how you're engaging."
    },
    // Tier 3: Final notice
    tier3: {
      type: String,
      default: "This is a final warning. Continued personal attacks will result in a temporary mute."
    },
    // Slur/Identity harm (separate path)
    slur: {
      type: String,
      default: "This content targets identity and isn't allowed on Pryde. The content has been removed and your account is temporarily restricted."
    },
    // Spam detection
    spam: {
      type: String,
      default: "This content has been flagged as spam. Repeated spam will result in account restrictions."
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ENFORCEMENT BEHAVIOR
  // ═══════════════════════════════════════════════════════════════════════════
  enforcement: {
    // Profanity alone does NOT trigger violations (Community Guidelines)
    profanityTriggersViolation: {
      type: Boolean,
      default: false
    },
    // Slurs bypass warning ladder (zero tolerance)
    slursZeroTolerance: {
      type: Boolean,
      default: true
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

