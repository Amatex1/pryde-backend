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
    required: true,
    maxlength: 2000,
    trim: true
  },
  contentWarning: {
    type: String,
    maxlength: 50,
    trim: true,
    default: null
  },
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

// Update the updatedAt timestamp before saving
globalMessageSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('GlobalMessage', globalMessageSchema);

