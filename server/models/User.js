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
    default: '',
    trim: true
  },
  displayName: {
    type: String,
    default: ''
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
    default: '',
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
  relationshipStatus: {
    type: String,
    default: '',
    trim: true
  },
  birthday: {
    type: Date,
    default: null
  },
  bio: {
    type: String,
    default: '',
    maxlength: 500
  },
  profilePhoto: {
    type: String,
    default: ''
  },
  coverPhoto: {
    type: String,
    default: ''
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
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  bookmarkedPosts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  }],
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
  pushSubscription: {
    type: Object,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
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
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationRequested: {
    type: Boolean,
    default: false
  },
  verificationRequestDate: {
    type: Date,
    default: null
  },
  verificationRequestReason: {
    type: String,
    default: '',
    maxlength: 500
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
  passkeys: [{
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
    transports: [{
      type: String,
      enum: ['usb', 'nfc', 'ble', 'internal', 'hybrid', 'cable', 'smart-card']
    }],
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
  // Session Management
  activeSessions: [{
    sessionId: {
      type: String,
      required: true
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
  trustedDevices: [{
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
  loginHistory: [{
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
    // PHASE 1 REFACTOR: Deprecated (friends system removed)
    whoCanSendFriendRequests: {
      type: String,
      enum: ['everyone', 'friends-of-friends', 'no-one'],
      default: 'everyone',
      select: false // Hide from queries by default
    },
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
    whoCanSeeMyPosts: {
      type: String,
      enum: ['public', 'followers', 'only-me'], // REMOVED: 'friends'
      default: 'public'
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
  // PHASE 5: Creator Mode
  isCreator: {
    type: Boolean,
    default: false
  },
  creatorTagline: {
    type: String,
    maxlength: 100,
    default: ''
  },
  creatorBio: {
    type: String,
    maxlength: 1000,
    default: ''
  },
  featuredPosts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  }],
  // PHASE 6: Ally System
  isAlly: {
    type: Boolean,
    default: false
  },
  onboardingCompleted: {
    type: Boolean,
    default: false
  },
  // Blocked Users
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
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
  moderationHistory: [{
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
  }]
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
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
