import mongoose from 'mongoose';

const bugReportSchema = new mongoose.Schema({
  // User who submitted the report
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // User description
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  
  // Session snapshot
  sessionSnapshot: {
    sessionId: String,
    
    // Auth state
    auth: {
      isAuthenticated: Boolean,
      userId: String,
      tokenInfo: mongoose.Schema.Types.Mixed
    },
    
    // Safe mode
    safeMode: {
      enabled: Boolean
    },
    
    // Mutation queue
    mutations: {
      total: Number,
      pending: Number,
      confirmed: Number,
      failed: Number
    },
    
    // Timeline
    timeline: {
      eventCount: Number,
      events: [mongoose.Schema.Types.Mixed]
    },
    
    // Versions
    versions: {
      frontend: String,
      backend: String,
      minFrontend: String
    },
    
    // Device context
    device: {
      userAgent: String,
      platform: String,
      language: String,
      screenResolution: String,
      isPWA: Boolean,
      isOnline: Boolean
    },
    
    // Service worker state
    serviceWorker: {
      registered: Boolean,
      state: String,
      cacheVersion: String
    },
    
    // Current route
    currentRoute: String,
    
    // Environment
    environment: String,
    
    // Timestamp
    capturedAt: Date
  },
  
  // Status
  status: {
    type: String,
    enum: ['new', 'investigating', 'resolved', 'closed'],
    default: 'new'
  },
  
  // Priority
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  
  // Admin notes
  adminNotes: {
    type: String,
    default: ''
  },
  
  // Assigned to
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Resolution
  resolution: {
    type: String,
    default: ''
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  resolvedAt: {
    type: Date,
    default: null
  }
});

// Update updatedAt on save
bugReportSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes
bugReportSchema.index({ userId: 1, createdAt: -1 });
bugReportSchema.index({ status: 1, priority: -1, createdAt: -1 });
bugReportSchema.index({ assignedTo: 1, status: 1 });

const BugReport = mongoose.model('BugReport', bugReportSchema);

export default BugReport;

