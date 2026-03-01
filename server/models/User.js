import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
  },
  profileSlug: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    validate: {
      validator: function(password) {
        // Password must be at least 8 characters
        if (password.length < 8) return false;

        // Password must contain at least one uppercase letter
        if (!/[A-Z]/.test(password)) return false;

        // Password must contain at least one lowercase letter
        if (!/[a-z]/.test(password)) return false;

        // Password must contain at least one number
        if (!/[0-9]/.test(password)) return false;

        return true;
      },
      message: 'Password must be at least 8 characters and contain uppercase, lowercase, and numbers'
    }
  },
  fullName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2
  },
  displayName: {
    type: String,
    default: null
  },
  identity: {
    type: String,
    enum: ['LGBTQ+', 'Ally', null],
    default: null
  },
  nickname: {
    type: String,
    default: '',
    trim: true
  },
  displayNameType: {
    type: String,
    enum: ['fullName', 'nickname', 'custom'],
    default: 'fullName'
  },
  customDisplayName: {
    type: String,
    default: '',
    trim: true
  },
  pronouns: {
    type: String,
    default: null,
    trim: true
  },
  gender: {
    type: String,
    default: '',
    trim: true
  },
  sexualOrientation: {
    type: String,
    default: '',
    trim: true
  },
  // REMOVED 2025-12-26: relationshipStatus field deleted (Phase 5)
  birthday: {
    type: Date,
    default: null
  },
  bio: {
    type: String,
    default: null,
    maxlength: 500
  },
  profilePhoto: {
    type: String,
    default: ''
  },
  profilePhotoPosition: {
    x: { type: Number, default: 50 },
    y: { type: Number, default: 50 },
    scale: { type: Number, default: 1 },
    bgX: { type: Number, default: null },
    bgY: { type: Number, default: null }
  },
  coverPhoto: {
    type: String,
    default: ''
  },
  coverPhotoPosition: {
    x: { type: Number, default: 50 },
    y: { type: Number, default: 50 },
    scale: { type: Number, default: 1 },
    bgX: { type: Number, default: null },
    bgY: { type: Number, default: null }
  },
  location: {
    type: String,
    default: ''
  },
  postcode: {
    type: String,
    default: '',
    trim: true
  },
  city: {
    type: String,
    default: '',
    trim: true
  },
  website: {
    type: String,
    default: ''
  },
  socialLinks: [{
    platform: {
      type: String,
      required: true,
      trim: true
    },
    url: {
      type: String,
      required: true,
      trim: true
    }
  }],
  interests: [{
    type: String,
    trim: true
  }],
  lookingFor: [{
    type: String,
    enum: ['friends', 'support', 'community', 'networking'],
    lowercase: true
  }],
  communicationStyle: {
    type: String,
    default: '',
    trim: true
  },
  safetyPreferences: {
    type: String,
    default: '',
    trim: true
  },
  // PHASE 1 REFACTOR: Friends field deprecated - kept for legacy data only
  // Use followers/following system instead
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    select: false // Hide from queries by default
  }],
  // Follow system (primary social graph)
  followers: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    default: []
  },
  following: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    default: []
  },
  // Optional: Who invited this user (for referral tracking)
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  bookmarkedPosts: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post'
    }],
    default: []
  },
  ageVerified: {
    type: Boolean,
    required: true,
    default: false
  },
  termsAccepted: {
    type: Boolean,
    required: true,
    default: false
  },
  termsAcceptedAt: {
    type: Date,
    default: null
  },
  termsVersion: {
    type: String,
    default: null
  },
  privacyAcceptedAt: {
    type: Date,
    default: null
  },
  privacyVersion: {
    type: String,
    default: null
  },
  pushSubscription: {
    type: Object,
    default: null
  },
  pushSubscriptions: {
    type: [Object],
    default: []
  },
  isActive: {
    type: Boolean,
    default: true
  },
  deactivatedAt: {
    type: Date,
    default: null
  },
  role: {
    type: String,
    enum: ['user', 'moderator', 'admin', 'super_admin'],
    default: 'user'
  },
  // ============================================================================
  // SYSTEM ACCOUNTS (First-Class Implementation)
  //
  // Platform-owned accounts that support onboarding, clarity, and platform rhythm.
  // System accounts must be visibly non-human, limited in scope, and never imitate
  // community members.
  // ============================================================================

  // Whether this account is operated by the platform (not a human user)
  isSystemAccount: {
    type: Boolean,
    default: false,
    index: true
  },

  // System account role - determines permissions and behavioral limits
  // CORE: Essential platform functions (future: pryde_safety, pryde_support)
  // PROMPTS: Can create scheduled prompt posts, cannot reply/react/DM
  // GUIDE: Can post onboarding guidance, reply with predefined info only
  // MODERATION: Can post notices, lock threads, cannot argue
  // ANNOUNCEMENTS: Rare platform updates only (max 1-2 per month)
  // SAFETY: Safety resources and crisis support (future)
  systemRole: {
    type: String,
    enum: ['CORE', 'PROMPTS', 'GUIDE', 'MODERATION', 'ANNOUNCEMENTS', 'SAFETY', null],
    default: null
  },

  // Who created this system account (for audit trail)
  systemCreatedBy: {
    type: String,
    default: null,
    trim: true
  },

  // Public-facing explanation of what this system account does
  // Shown on profile and when users hover over the system badge
  systemDescription: {
    type: String,
    default: null,
    maxlength: 500
  },
  permissions: {
    canViewReports: { type: Boolean, default: false },
    canResolveReports: { type: Boolean, default: false },
    canManageUsers: { type: Boolean, default: false },
    canViewAnalytics: { type: Boolean, default: false },
    canManageAdmins: { type: Boolean, default: false }
  },
  // Badges: Non-hierarchical recognition system (added 2025-12-28)
  // Stores badge IDs that reference the Badge model
  badges: {
    type: [{
      type: String,
      ref: 'Badge'
    }],
    default: []
  },
  // Badge visibility settings (added 2026-01-09)
  // User can choose up to 3 badges to display publicly
  // CORE_ROLE badges (Founder/Admin/Moderator/Verified) are always visible
  publicBadges: {
    type: [{
      type: String,
      ref: 'Badge'
    }],
    default: [],
    validate: {
      validator: function(v) {
        return v.length <= 3; // Max 3 public badges
      },
      message: 'You can only display up to 3 public badges'
    }
  },
  // Badges user has chosen to hide (only STATUS and COSMETIC badges can be hidden)
  hiddenBadges: {
    type: [{
      type: String,
      ref: 'Badge'
    }],
    default: []
  },
  // REMOVED 2025-12-26: isVerified, verificationRequested, verificationRequestDate, verificationRequestReason (Phase 5)
  // Email verification
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    default: null
  },
  emailVerificationExpires: {
    type: Date,
    default: null
  },
  isSuspended: {
    type: Boolean,
    default: false
  },
  suspendedUntil: {
    type: Date,
    default: null
  },
  suspensionReason: {
    type: String,
    default: ''
  },
  isBanned: {
    type: Boolean,
    default: false
  },
  bannedReason: {
    type: String,
    default: ''
  },
  // Account lockout for failed login attempts
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockoutUntil: {
    type: Date,
    default: null
  },
  // Passkeys (WebAuthn credentials)
  passkeys: {
    type: [{
      credentialId: {
        type: String,
        required: true
      },
      publicKey: {
        type: String,
        required: true
      },
      counter: {
        type: Number,
        required: true,
        default: 0
      },
      deviceName: {
        type: String,
        default: 'Unknown Device'
      },
      transports: {
        type: [{
          type: String,
          enum: ['usb', 'nfc', 'ble', 'internal', 'hybrid', 'cable', 'smart-card']
        }],
        default: []
      },
      deviceType: {
        type: String,
        enum: ['singleDevice', 'multiDevice'],
        default: 'singleDevice'
      },
      backedUp: {
        type: Boolean,
        default: false
      },
      createdAt: {
        type: Date,
        default: Date.now
      },
      lastUsedAt: {
        type: Date,
        default: Date.now
      }
    }],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  },
  // Two-Factor Authentication
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    default: null
  },
  twoFactorBackupCodes: [{
    code: {
      type: String,
      required: true
    },
    used: {
      type: Boolean,
      default: false
    }
  }],
  // Push-based 2FA (approve login via app notification)
  pushTwoFactorEnabled: {
    type: Boolean,
    default: false
  },
  // Prefer push 2FA over TOTP if both are enabled
  preferPushTwoFactor: {
    type: Boolean,
    default: true
  },
  // Session Management
  activeSessions: {
    type: [{
      sessionId: {
        type: String,
        required: true
      },
      refreshToken: {
        type: String,
        default: null,
        select: false // never return tokens by default
      },
      refreshTokenHash: {
        type: String,
        default: null,
        select: false
      },
      refreshTokenExpiry: {
        type: Date,
        default: null
      },
      // Grace period: previous token still valid for 30 mins after rotation
      previousRefreshToken: {
        type: String,
        default: null,
        select: false
      },
      previousRefreshTokenHash: {
        type: String,
        default: null,
        select: false
      },
      previousTokenExpiry: {
        type: Date,
        default: null
      },
      lastTokenRotation: {
        type: Date,
        default: null
      },
      deviceInfo: {
        type: String,
        default: ''
      },
      browser: {
        type: String,
        default: ''
      },
      os: {
        type: String,
        default: ''
      },
      ipAddress: {
        type: String,
        default: ''
      },
      location: {
        city: { type: String, default: '' },
        region: { type: String, default: '' },
        country: { type: String, default: '' }
      },
      createdAt: {
        type: Date,
        default: Date.now
      },
      lastActive: {
        type: Date,
        default: Date.now
      }
    }],
    default: []
  },
  // Login Alerts & Security
  loginAlerts: {
    enabled: {
      type: Boolean,
      default: true
    },
    emailOnNewDevice: {
      type: Boolean,
      default: true
    },
    emailOnSuspiciousLogin: {
      type: Boolean,
      default: true
    }
  },
  trustedDevices: {
    type: [{
      deviceId: {
        type: String,
        required: true
      },
      deviceInfo: {
        type: String,
        default: ''
      },
      ipAddress: {
        type: String,
        default: ''
      },
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],
    default: []
  },
  loginHistory: {
    type: [{
      ipAddress: {
        type: String,
        required: true
      },
      deviceInfo: {
        type: String,
        default: ''
      },
      location: {
        city: { type: String, default: '' },
        region: { type: String, default: '' },
        country: { type: String, default: '' }
      },
      success: {
        type: Boolean,
        default: true
      },
      failureReason: {
        type: String,
        default: ''
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    default: []
  },
  // Trusted Recovery Contacts
  recoveryContacts: {
    type: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      status: {
        type: String,
        enum: ['pending', 'accepted', 'declined'],
        default: 'pending'
      },
      addedAt: {
        type: Date,
        default: Date.now
      },
      acceptedAt: {
        type: Date,
        default: null
      }
    }],
    default: []
  },
  // Recovery requests initiated by this user
  recoveryRequests: {
    type: [{
      requestId: {
        type: String,
        required: true,
        unique: true
      },
      contactsNotified: {
        type: [{
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }],
        default: []
      },
      contactsApproved: {
        type: [{
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }],
        default: []
      },
      requiredApprovals: {
        type: Number,
        default: 2 // Require 2 out of 3 contacts to approve
      },
      status: {
        type: String,
        enum: ['pending', 'approved', 'denied', 'expired'],
        default: 'pending'
      },
      createdAt: {
        type: Date,
        default: Date.now
      },
      expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      },
      newPasswordHash: {
        type: String,
        default: null
      }
    }],
    default: []
  },
  // Privacy Settings
  // PHASE 1 REFACTOR: Simplified privacy options
  privacySettings: {
    profileVisibility: {
      type: String,
      enum: ['public', 'followers', 'private'], // REMOVED: 'friends'
      default: 'public'
    },
    // New: Private account toggle (replaces whoCanSendFriendRequests)
    isPrivateAccount: {
      type: Boolean,
      default: false
    },
    // REMOVED 2025-12-26: whoCanSendFriendRequests deleted (Phase 5)
    whoCanMessage: {
      type: String,
      enum: ['everyone', 'followers', 'no-one'], // REMOVED: 'friends'
      default: 'followers'
    },
    showOnlineStatus: {
      type: Boolean,
      default: true
    },
    showLastSeen: {
      type: Boolean,
      default: true
    },
    // PHASE 2: Quiet Mode - calm UX with reduced metrics
    quietModeEnabled: {
      type: Boolean,
      default: false
    },
    // QUIET MODE V2: Sub-toggles for granular control
    // Calm visuals: Reduces motion, visual noise, and urgency
    quietVisuals: {
      type: Boolean,
      default: true // Enabled by default when quiet mode is on
    },
    // Writing focus: Distraction-free space for journaling and posts
    quietWriting: {
      type: Boolean,
      default: true // Enabled by default when quiet mode is on
    },
    // Hide engagement metrics: Hide likes and counts to reduce comparison
    quietMetrics: {
      type: Boolean,
      default: false // Opt-in, not on by default
    },
    // Automatic Quiet Hours (21:00-06:00 local time)
    autoQuietHoursEnabled: {
      type: Boolean,
      default: true
    },
    // Safe Mode - stability fallback (disables PWA, sockets, polling, optimistic UI)
    safeModeEnabled: {
      type: Boolean,
      default: false
    },
    // BADGE SYSTEM V1: Hide badges option (CSS-only, no data removal)
    // When enabled, badges are not rendered on profiles and posts
    hideBadges: {
      type: Boolean,
      default: false
    },
    // CURSOR CUSTOMIZATION: Optional, accessibility-safe cursor styles
    // system = OS/browser default (no overrides)
    // soft-rounded = Softer edges for long reading sessions
    // calm-dot = Small circular cursor for content areas
    // high-contrast = Larger, high-contrast for accessibility
    // reduced-motion = System cursor with no hover/transition effects
    cursorStyle: {
      type: String,
      enum: ['system', 'soft-rounded', 'calm-dot', 'high-contrast', 'reduced-motion'],
      default: 'system'
    },
    // THEME PERSISTENCE: Stored in DB so Safari/cross-device preserves user choice
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'dark'
    },
    galaxyMode: {
      type: Boolean,
      default: true // Galaxy ON by default (core identity)
    },
    whoCanSeeMyPosts: {
      type: String,
      enum: ['public', 'followers', 'only-me'], // REMOVED: 'friends'
      default: 'public'
    },
    defaultPostVisibility: {
      type: String,
      enum: ['public', 'followers', 'private'],
      default: 'followers'
    },
    whoCanCommentOnMyPosts: {
      type: String,
      enum: ['everyone', 'followers', 'no-one'], // REMOVED: 'friends'
      default: 'everyone'
    },
    // PHASE 1 REFACTOR: Deprecated (friends system removed)
    whoCanSeeFriendsList: {
      type: String,
      enum: ['everyone', 'friends', 'followers', 'only-me'],
      default: 'everyone',
      select: false // Hide from queries by default
    },
    // PHASE 1 REFACTOR: Deprecated (follower counts hidden)
    whoCanSeeFollowersList: {
      type: String,
      enum: ['everyone', 'friends', 'followers', 'only-me'],
      default: 'everyone',
      select: false // Hide from queries by default
    },
    whoCanTagMe: {
      type: String,
      enum: ['everyone', 'followers', 'no-one'], // REMOVED: 'friends'
      default: 'followers'
    },
    autoHideContentWarnings: {
      type: Boolean,
      default: false
    }
  },
  // PHASE 5: Creator Mode (DEPRECATED - removed 2025-12-25)
  // isCreator, creatorTagline, creatorBio, featuredPosts removed
  // Use regular posts and profile bio instead

  // REMOVED 2025-12-26: isAlly deleted (Phase 5) - use identity field instead

  // ── Geo Safety Fields (added 2026-03-01) ───────────────────────────────────
  // Enterprise geo detection + safety acknowledgement hardening
  lastCountryCode: {
    type: String,
    default: null
  },
  safetyAcknowledgedAt: {
    type: Date,
    default: null
  },
  safetyAcknowledgedCountry: {
    type: String,
    default: null
  },

  onboardingCompleted: {
    type: Boolean,
    default: false
  },
  profileComplete: {
    type: Boolean,
    default: false
  },
  onboardingStep: {
    type: String,
    default: 'registered'
  },
  // Post-signup welcome tour (added 2025-01-02)
  // Controls the optional onboarding tour shown to new users
  hasCompletedTour: {
    type: Boolean,
    default: false
  },
  hasSkippedTour: {
    type: Boolean,
    default: false
  },
  tourCompletedAt: {
    type: Date,
    default: null
  },
  // Calm Onboarding (added 2025-02-01)
  // Tracks opt-in onboarding flow states
  onboardingTourDismissed: {
    type: Boolean,
    default: false
  },
  tourRemindLaterDate: {
    type: Date,
    default: null
  },
  lastActivityDate: {
    type: Date,
    default: null
  },
  quietReturnShownAt: {
    type: Date,
    default: null
  },
  // Blocked Users
  blockedUsers: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    default: []
  },
  // Moderation & Auto-Mute
  moderation: {
    isMuted: {
      type: Boolean,
      default: false
    },
    muteExpires: {
      type: Date,
      default: null
    },
    muteReason: {
      type: String,
      default: ''
    },
    // Speech violations (slurs, sexual, custom - NOT profanity)
    violationCount: {
      type: Number,
      default: 0
    },
    // Spam violations tracked separately from speech
    spamViolationCount: {
      type: Number,
      default: 0
    },
    // Slur violations tracked for escalation
    slurViolationCount: {
      type: Number,
      default: 0
    },
    lastViolation: {
      type: Date,
      default: null
    },
    // When the last violation decay was applied
    lastDecayApplied: {
      type: Date,
      default: null
    },
    autoMuteEnabled: {
      type: Boolean,
      default: true
    },
    // PRYDE_MODERATION_ADMIN_V2: Additional moderation controls
    shadowMute: {
      type: Boolean,
      default: false
    },
    onWatchlist: {
      type: Boolean,
      default: false
    },
    watchlistReason: {
      type: String,
      default: null
    },
    trusted: {
      type: Boolean,
      default: false
    },
    behaviorScore: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    // PRYDE_SAFETY_HARDENING_V1: Risk scoring system
    riskScore: {
      type: Number,
      default: 0,
      min: 0
    },
    riskLevel: {
      type: String,
      enum: ['low', 'moderate', 'high'],
      default: 'low'
    },
    probationUntil: {
      type: Date,
      default: null
    }
  },
  moderationHistory: {
    type: [{
      action: {
        type: String,
        enum: ['warning', 'mute', 'unmute', 'content-removed', 'spam-detected', 'slur-detected', 'decay-applied', 'admin-note'],
        required: true
      },
      reason: {
        type: String,
        default: ''
      },
      contentType: {
        type: String,
        enum: ['post', 'comment', 'message', 'profile', 'other'],
        default: 'post'
      },
      contentId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
      },
      // Store a preview of the offending content for admin review
      contentPreview: {
        type: String,
        default: '',
        maxlength: 500
      },
      // Store the detected violations (blocked words, spam indicators, etc.)
      detectedViolations: {
        type: [String],
        default: []
      },
      // Admin who took action (for manual actions)
      moderatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      automated: {
        type: Boolean,
        default: false
      }
    }],
    default: []
  },
  // ============================================================================
  // GOVERNANCE V1: Per-category strikes, global counter, and account status
  // ============================================================================

  // Per-category strike counts (rolling 30-day window)
  postStrikes: { type: Number, default: 0 },
  commentStrikes: { type: Number, default: 0 },
  dmStrikes: { type: Number, default: 0 },
  globalStrikes: { type: Number, default: 0 },

  // Timestamp of most recent violation (drives rolling window + decay)
  lastViolationAt: { type: Date, default: null },

  // Null = no active restriction; Date = restricted until this time
  restrictedUntil: { type: Date, default: null },

  // Account governance status (does not replace existing isBanned / isSuspended)
  governanceStatus: {
    type: String,
    enum: ['active', 'restricted', 'banned'],
    default: 'active'
  },

  // ============================================================================

  // Soft Deletion & Account Recovery
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletionScheduledFor: {
    type: Date,
    default: null
  },
  deletionConfirmationToken: {
    type: String,
    default: null
  },
  deletionConfirmationExpires: {
    type: Date,
    default: null
  },
  // Store original data before anonymization for recovery (ENCRYPTED)
  originalData: {
    type: Object,
    default: null,
    select: false // Never include in queries by default
  },

  // Deletion reason (optional, for analytics and abuse detection)
  deletedReason: {
    type: {
      type: String,
      enum: [
        "privacy",
        "too_many_notifications",
        "found_alternative",
        "temporary_break",
        "safety_concern",
        "other"
      ]
    },
    message: String
  },

  // PHASE 4B: Group Notification Preferences (per-user, per-group)
  // Quiet, opt-in notifications - nothing is on by default
  groupNotificationSettings: [{
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true
    },
    // Notify me about new posts in this group (OFF by default - opt-in)
    notifyOnNewPost: {
      type: Boolean,
      default: false
    },
    // Notify me when I'm mentioned in this group (ON by default)
    notifyOnMention: {
      type: Boolean,
      default: true
    }
  }],

  // ============================================================================
  // Life-Signal Feature 5: Soft Presence States
  // Optional, non-performative presence indicators
  // ============================================================================

  // Current presence state
  presenceState: {
    type: String,
    enum: ['listening', 'low_energy', 'open', 'lurking', null],
    default: null
  },

  // Whether presence is visible to others (opt-in)
  presenceVisible: {
    type: Boolean,
    default: false
  },

  // When presence was last updated (no timestamps shown to others)
  presenceUpdatedAt: {
    type: Date,
    default: null
  },

  // ============================================================================
  // Life-Signal Feature 1: Reflection Prompt Preferences
  // ============================================================================

  // Whether user wants to see reflection prompts
  reflectionPromptsEnabled: {
    type: Boolean,
    default: true
  },

  // Track dismissed prompts to avoid re-showing
  dismissedPrompts: [{
    promptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReflectionPrompt'
    },
    dismissedAt: {
      type: Date,
      default: Date.now
    }
  }]
});

// Indexes for efficient queries
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ createdAt: -1 });
userSchema.index({ isActive: 1, isBanned: 1, isSuspended: 1 });
userSchema.index({ role: 1 });
userSchema.index({ 'followers': 1 });
userSchema.index({ 'following': 1 });
userSchema.index({ 'passkeys.credentialId': 1 });
userSchema.index({ resetPasswordToken: 1 });
userSchema.index({ lastSeen: -1 });
userSchema.index({ 'groupNotificationSettings.groupId': 1 });

// PERFORMANCE: Admin dashboard and user management indexes
userSchema.index({ isSuspended: 1, createdAt: -1 }); // Suspension tracking
userSchema.index({ isBanned: 1, createdAt: -1 }); // Ban tracking
userSchema.index({ isDeleted: 1, createdAt: -1 }); // Deleted account queries
userSchema.index({ emailVerified: 1 }); // Email verification status
userSchema.index({ lastLogin: -1 }); // Active user queries
// Text index for user search (faster than regex)
userSchema.index({ username: 'text', displayName: 'text' });

// =========================
// PHASE 3A: SAFE CAPS
// Enforce rolling caps on embedded arrays to prevent 16MB document limit
// =========================
// NOTE: activeSessions is now just a UI cache - Session collection is authoritative
// Increased from 5 to 10 to show more recent sessions in the UI
const CAPS = {
  activeSessions: 10,
  loginHistory: 50,
  moderationHistory: 100
};

function capArray(arr, limit) {
  if (!Array.isArray(arr)) return arr;
  if (arr.length <= limit) return arr;
  // Keep the most recent entries (last N items)
  return arr.slice(-limit);
}

// Hash password before saving + enforce array caps
// SECURITY: Using 12 rounds for stronger protection (OWASP recommended minimum)
userSchema.pre('save', async function(next) {
  // PHASE 3A: Enforce caps on embedded arrays
  this.activeSessions = capArray(this.activeSessions, CAPS.activeSessions);
  this.loginHistory = capArray(this.loginHistory, CAPS.loginHistory);
  this.moderationHistory = capArray(this.moderationHistory, CAPS.moderationHistory);

  // Hash password if modified
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// ======================================================================
// SECURITY HELPERS
// ======================================================================

// Hash refresh tokens (one-way, leak-safe)
userSchema.methods.hashRefreshToken = function (token) {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Verify refresh token against stored hash
// PART 11: Legacy plaintext fallback removed — all tokens must be hashed
userSchema.methods.verifyRefreshToken = function (session, token) {
  const hashed = this.hashRefreshToken(token);

  // Check current hash first
  if (session.refreshTokenHash && session.refreshTokenHash === hashed) {
    return true;
  }

  // Check previous hash (grace period during rotation)
  if (session.previousRefreshTokenHash &&
      session.previousTokenExpiry &&
      new Date() < session.previousTokenExpiry &&
      session.previousRefreshTokenHash === hashed) {
    return true;
  }

  return false;
};

// Migrate legacy plaintext refresh tokens → hashed (called on successful refresh)
userSchema.methods.migrateRefreshToken = function (session, token) {
  const hashed = this.hashRefreshToken(token);

  session.previousRefreshTokenHash = session.refreshTokenHash || null;
  session.refreshTokenHash = hashed;

  // Remove plaintext storage
  session.refreshToken = null;
  session.previousRefreshToken = null;
};

// Method to get public profile
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.twoFactorSecret;
  delete user.twoFactorBackupCodes;
  delete user.resetPasswordToken;
  delete user.emailVerificationToken;
  delete user.deletionConfirmationToken;
  // CRITICAL: Never serialize originalData (contains encrypted recovery data)
  delete user.originalData;
  return user;
};

// Method to check if account is locked
userSchema.methods.isLocked = function() {
  // Check if lockout is active
  return !!(this.lockoutUntil && this.lockoutUntil > Date.now());
};

// ATOMIC login attempt tracking (race-free)
userSchema.statics.recordLoginAttempt = async function (userId, wasSuccessful) {
  const now = Date.now();
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

  // Successful login → reset counters
  if (wasSuccessful) {
    return this.updateOne(
      { _id: userId },
      {
        $set: {
          loginAttempts: 0,
          lockoutUntil: null,
          lastLogin: now
        }
      }
    );
  }

  // Failed login → atomic increment + conditional lock
  return this.updateOne(
    {
      _id: userId,
      $or: [
        { lockoutUntil: null },
        { lockoutUntil: { $lt: now } }
      ]
    },
    [
      {
        $set: {
          loginAttempts: { $add: ['$loginAttempts', 1] }
        }
      },
      {
        $set: {
          lockoutUntil: {
            $cond: [
              { $gte: [{ $add: ['$loginAttempts', 1] }, MAX_ATTEMPTS] },
              now + LOCKOUT_DURATION,
              '$lockoutUntil'
            ]
          }
        }
      }
    ]
  );
};

// ======================================================================
// PHASE 3A: ATOMIC CAPPED ARRAY OPERATIONS
// For use cases requiring atomic updates (bypasses pre-save hook)
// Uses same CAPS constant defined above
// ======================================================================

/**
 * Add a session atomically with cap enforcement
 * Keeps only the most recent sessions (uses CAPS.activeSessions)
 * @param {ObjectId} userId - User ID
 * @param {Object} session - Session object to add
 * @returns {Promise} Update result
 */
userSchema.statics.addSessionCapped = async function (userId, session) {
  // Ensure createdAt is set for sorting
  if (!session.createdAt) {
    session.createdAt = new Date();
  }
  if (!session.lastActive) {
    session.lastActive = new Date();
  }

  return this.updateOne(
    { _id: userId },
    {
      $push: {
        activeSessions: {
          $each: [session],
          $sort: { lastActive: -1 },  // Newest first
          $slice: CAPS.activeSessions  // Keep only MAX sessions
        }
      }
    }
  );
};

/**
 * Add a login history entry atomically with cap enforcement
 * Keeps only the most recent entries (uses CAPS.loginHistory)
 * @param {ObjectId} userId - User ID
 * @param {Object} entry - Login history entry
 * @returns {Promise} Update result
 */
userSchema.statics.addLoginHistoryCapped = async function (userId, entry) {
  // Ensure timestamp is set for sorting
  if (!entry.timestamp) {
    entry.timestamp = new Date();
  }

  return this.updateOne(
    { _id: userId },
    {
      $push: {
        loginHistory: {
          $each: [entry],
          $sort: { timestamp: -1 },  // Newest first
          $slice: CAPS.loginHistory   // Keep only MAX entries
        }
      }
    }
  );
};

/**
 * Add a moderation history entry atomically with cap enforcement
 * Keeps only the most recent entries (uses CAPS.moderationHistory)
 * @param {ObjectId} userId - User ID
 * @param {Object} entry - Moderation history entry
 * @returns {Promise} Update result
 */
userSchema.statics.addModerationHistoryCapped = async function (userId, entry) {
  // Ensure timestamp is set for sorting
  if (!entry.timestamp) {
    entry.timestamp = new Date();
  }

  return this.updateOne(
    { _id: userId },
    {
      $push: {
        moderationHistory: {
          $each: [entry],
          $sort: { timestamp: -1 },       // Newest first
          $slice: CAPS.moderationHistory  // Keep only MAX entries
        }
      }
    }
  );
};

/**
 * Cleanup utility: Trim existing arrays to caps (one-time migration safe)
 * Can be called on user documents that may have exceeded caps before this code was deployed
 * Uses CAPS constants for consistency
 * @param {ObjectId} userId - User ID
 * @returns {Promise} Update result
 */
userSchema.statics.enforceAllCaps = async function (userId) {
  const user = await this.findById(userId);
  if (!user) return null;

  const updates = {};
  let needsUpdate = false;

  // Trim activeSessions if needed
  if (user.activeSessions && user.activeSessions.length > CAPS.activeSessions) {
    const sorted = [...user.activeSessions].sort((a, b) =>
      new Date(b.lastActive) - new Date(a.lastActive)
    );
    updates.activeSessions = sorted.slice(0, CAPS.activeSessions);
    needsUpdate = true;
  }

  // Trim loginHistory if needed
  if (user.loginHistory && user.loginHistory.length > CAPS.loginHistory) {
    const sorted = [...user.loginHistory].sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    );
    updates.loginHistory = sorted.slice(0, CAPS.loginHistory);
    needsUpdate = true;
  }

  // Trim moderationHistory if needed
  if (user.moderationHistory && user.moderationHistory.length > CAPS.moderationHistory) {
    const sorted = [...user.moderationHistory].sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    );
    updates.moderationHistory = sorted.slice(0, CAPS.moderationHistory);
    needsUpdate = true;
  }

  if (needsUpdate) {
    return this.updateOne({ _id: userId }, { $set: updates });
  }

  return { modifiedCount: 0, message: 'No trimming needed' };
};


export default mongoose.model('User', userSchema);
