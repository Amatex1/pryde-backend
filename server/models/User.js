import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
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
    minlength: 6
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
    scale: { type: Number, default: 1 }
  },
  coverPhoto: {
    type: String,
    default: ''
  },
  coverPhotoPosition: {
    x: { type: Number, default: 50 },
    y: { type: Number, default: 50 },
    scale: { type: Number, default: 1 }
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
  permissions: {
    canViewReports: { type: Boolean, default: false },
    canResolveReports: { type: Boolean, default: false },
    canManageUsers: { type: Boolean, default: false },
    canViewAnalytics: { type: Boolean, default: false },
    canManageAdmins: { type: Boolean, default: false }
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
        required: true,
        unique: true
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
        default: null
      },
      refreshTokenExpiry: {
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
    violationCount: {
      type: Number,
      default: 0
    },
    lastViolation: {
      type: Date,
      default: null
    },
    autoMuteEnabled: {
      type: Boolean,
      default: true
    }
  },
  moderationHistory: {
    type: [{
      action: {
        type: String,
        enum: ['warning', 'mute', 'unmute', 'content-removed', 'spam-detected'],
        required: true
      },
      reason: {
        type: String,
        default: ''
      },
      contentType: {
        type: String,
        enum: ['post', 'comment', 'message', 'profile'],
        default: 'post'
      },
      contentId: {
        type: mongoose.Schema.Types.ObjectId,
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

// Hash password before saving
// SECURITY: Using 12 rounds for stronger protection (OWASP recommended minimum)
userSchema.pre('save', async function(next) {
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

// Method to get public profile
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.twoFactorSecret;
  delete user.twoFactorBackupCodes;
  delete user.resetPasswordToken;
  return user;
};

// Method to check if account is locked
userSchema.methods.isLocked = function() {
  // Check if lockout is active
  return !!(this.lockoutUntil && this.lockoutUntil > Date.now());
};

// Method to increment login attempts
userSchema.methods.incrementLoginAttempts = async function() {
  // If we have a previous lockout that has expired, reset attempts
  if (this.lockoutUntil && this.lockoutUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockoutUntil: 1 }
    });
  }

  // Otherwise increment attempts
  const updates = { $inc: { loginAttempts: 1 } };

  // Lock account after 5 failed attempts
  const maxAttempts = 5;
  const lockoutDuration = 15 * 60 * 1000; // 15 minutes

  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked()) {
    updates.$set = { lockoutUntil: Date.now() + lockoutDuration };
  }

  return this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = async function() {
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockoutUntil: 1 }
  });
};

export default mongoose.model('User', userSchema);
