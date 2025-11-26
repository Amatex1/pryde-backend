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
  pronouns: {
    type: String,
    enum: ['', 'He/Him', 'She/Her', 'They/Them', 'He/They', 'She/They', 'Any Pronouns', 'Prefer Not to Say', 'Custom'],
    default: ''
  },
  customPronouns: {
    type: String,
    default: '',
    trim: true
  },
  gender: {
    type: String,
    enum: ['', 'Male', 'Female', 'Non-Binary', 'Transgender', 'Genderfluid', 'Agender', 'Intersex', 'Prefer Not to Say', 'Custom'],
    default: ''
  },
  customGender: {
    type: String,
    default: '',
    trim: true
  },
  relationshipStatus: {
    type: String,
    enum: ['', 'Single', 'Taken', 'It\'s Complicated', 'Married', 'Looking for Friends', 'Prefer Not to Say'],
    default: ''
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
  friends: [{
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
  privacySettings: {
    profileVisibility: {
      type: String,
      enum: ['public', 'friends', 'private'],
      default: 'public'
    },
    whoCanSendFriendRequests: {
      type: String,
      enum: ['everyone', 'friends-of-friends', 'no-one'],
      default: 'everyone'
    },
    whoCanMessage: {
      type: String,
      enum: ['everyone', 'friends', 'no-one'],
      default: 'friends'
    },
    showOnlineStatus: {
      type: Boolean,
      default: true
    },
    showLastSeen: {
      type: Boolean,
      default: true
    },
    whoCanSeeMyPosts: {
      type: String,
      enum: ['public', 'friends', 'only-me'],
      default: 'public'
    },
    whoCanCommentOnMyPosts: {
      type: String,
      enum: ['everyone', 'friends', 'no-one'],
      default: 'everyone'
    },
    whoCanSeeFriendsList: {
      type: String,
      enum: ['everyone', 'friends', 'only-me'],
      default: 'everyone'
    },
    whoCanTagMe: {
      type: String,
      enum: ['everyone', 'friends', 'no-one'],
      default: 'friends'
    }
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

export default mongoose.model('User', userSchema);
