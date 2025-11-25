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
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  }
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
  return user;
};

export default mongoose.model('User', userSchema);
