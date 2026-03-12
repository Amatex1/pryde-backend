import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  contentType: String,
  size: Number,
  contentId: String, // For inline images
  raw: Buffer, // Store raw attachment data (limit size)
  url: String // Signed URL if uploaded to R2/S3
}, { _id: false });

const inboundEmailSchema = new mongoose.Schema({
  // Raw Resend webhook data
  rawWebhook: {
    id: String,
    from: String,
    to: [String],
    subject: String,
    html: String,
    text: String,
    createdAt: Date,
    headers: mongoose.Schema.Types.Mixed,
    attachments: [attachmentSchema]
  },
  
  // Parsed normalized data
  sender: {
    email: { type: String, required: true },
    name: String
  },
  recipients: [{
    email: String,
    name: String
  }],
  subject: String,
  bodyHtml: String,
  bodyText: String,
  headers: {
    messageId: String,
    date: Date,
    userAgent: String,
    xMailer: String
  },
  attachments: [attachmentSchema],
  
  // Categorization
  mailbox: {
    type: String,
    enum: ['noreply', 'support'], // noreply@prydeapp.com, support@prydeapp.com
    required: true
  },
  
  // Admin processing
  status: {
    type: String,
    enum: ['new', 'read', 'replied', 'archived', 'spam'],
    default: 'new'
  },
  readBy: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readAt: Date
  }],
  repliedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    repliedAt: Date
  },
  adminNotes: String
}, {
  timestamps: true
});

// Compound indexes for admin queries
inboundEmailSchema.index({ mailbox: 1, status: 1, createdAt: -1 });
inboundEmailSchema.index({ sender: 1, createdAt: -1 });
inboundEmailSchema.index({ status: 1, 'readBy.userId': 1 });

// Pre-save middleware to update updatedAt
inboundEmailSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('InboundEmail', inboundEmailSchema);

