import mongoose from 'mongoose';

const globalMessageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  text: {
    type: String,
    required: false,
    maxlength: 2000,
    trim: true
  },
  gifUrl: {
    type: String,
    required: false
  },
  contentWarning: {
    type: String,
    maxlength: 50,
    trim: true,
    default: null
  },
  // Soft delete for all users (sender or admin can do this)
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  deletedAt: {
    type: Date,
    default: null
  },
  // Track who deleted for themselves only (message still visible to others)
  deletedFor: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deletedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for efficient pagination queries
globalMessageSchema.index({ createdAt: -1, _id: -1 });

// Index for moderation queries
globalMessageSchema.index({ isDeleted: 1, createdAt: -1 });

// Index for deletedFor queries
globalMessageSchema.index({ 'deletedFor.user': 1 });

// Update the updatedAt timestamp before saving
globalMessageSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('GlobalMessage', globalMessageSchema);

