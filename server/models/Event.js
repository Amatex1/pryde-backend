import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  eventType: {
    type: String,
    enum: ['in-person', 'virtual', 'hybrid'],
    required: true
  },
  category: {
    type: String,
    enum: ['pride', 'support-group', 'social', 'activism', 'education', 'arts', 'sports', 'other'],
    default: 'social'
  },
  startDate: {
    type: Date,
    required: true,
    index: true
  },
  endDate: {
    type: Date,
    required: true
  },
  location: {
    venue: {
      type: String,
      default: ''
    },
    address: {
      type: String,
      default: ''
    },
    city: {
      type: String,
      default: ''
    },
    country: {
      type: String,
      default: ''
    },
    virtualLink: {
      type: String,
      default: ''
    }
  },
  coverImage: {
    type: String,
    default: ''
  },
  attendees: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['going', 'interested', 'not-going'],
      default: 'going'
    },
    rsvpDate: {
      type: Date,
      default: Date.now
    }
  }],
  maxAttendees: {
    type: Number,
    default: null // null means unlimited
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  requiresApproval: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  externalLink: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for efficient queries
eventSchema.index({ startDate: 1 }); // For chronological event listing
eventSchema.index({ 'location.city': 1 }); // For location-based discovery
eventSchema.index({ category: 1 }); // For category filtering
eventSchema.index({ creator: 1, createdAt: -1 }); // For user's created events
eventSchema.index({ startDate: 1, category: 1 }); // For filtered event browsing
eventSchema.index({ isPrivate: 1, startDate: 1 }); // For public event discovery

// Update the updatedAt timestamp before saving
eventSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('Event', eventSchema);

