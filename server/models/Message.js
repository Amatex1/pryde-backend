import mongoose from 'mongoose';
import { encryptMessage, decryptMessage, isEncrypted } from '../utils/encryption.js';

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  groupChat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GroupChat',
    default: null
  },
  content: {
    type: String,
    required: false, // Allow empty content if attachment is present
    default: ''
  },
  attachment: {
    type: String,
    default: null
  },
  // REMOVED 2025-12-26: voiceNote deleted (Phase 5)
  read: {
    type: Boolean,
    default: false
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  deliveredTo: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deliveredAt: {
      type: Date,
      default: Date.now
    }
  }],
  edited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  // REMOVED 2025-12-26: reactions deleted (Phase 5)
  // Soft delete support - tracks who deleted message for themselves
  isDeletedForAll: {
    type: Boolean,
    default: false
  },
  deletedForAll: {
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    at: {
      type: Date
    }
  },
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
    default: Date.now
  }
});

// Indexes for efficient queries
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
messageSchema.index({ groupChat: 1, createdAt: -1 }); // For group chat messages
messageSchema.index({ sender: 1, createdAt: -1 }); // For user's sent messages
messageSchema.index({ recipient: 1, createdAt: -1 }); // For user's received messages
messageSchema.index({ 'deletedFor.user': 1 }); // For filtering out deleted messages
messageSchema.index({ isDeletedForAll: 1 }); // For filtering deleted-for-all messages

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that message has either content or attachment
 */
messageSchema.pre('validate', function(next) {
  if (!this.content && !this.attachment) {
    next(new Error('Message must have either content or attachment'));
  } else {
    next();
  }
});

// ============================================================================
// ENCRYPTION MIDDLEWARE
// ============================================================================

/**
 * Encrypt message content before saving to database
 * This ensures all messages are encrypted at rest
 */
messageSchema.pre('save', async function(next) {
  try {
    // Only encrypt if content is modified and not already encrypted
    if (this.isModified('content') && this.content && !isEncrypted(this.content)) {
      console.log('🔒 Encrypting message content...');
      this.content = encryptMessage(this.content);
    }
    next();
  } catch (error) {
    console.error('❌ Error encrypting message:', error);
    next(error);
  }
});

/**
 * Decrypt message content when converting to JSON
 * This ensures messages are decrypted when sent to clients
 */
messageSchema.methods.toJSON = function() {
  const message = this.toObject();

  try {
    // Decrypt content if it's encrypted
    if (message.content && isEncrypted(message.content)) {
      message.content = decryptMessage(message.content);
    }
  } catch (error) {
    console.error('❌ Error decrypting message:', error);
    // Return encrypted content if decryption fails (better than crashing)
    message.content = '[Encrypted message - decryption failed]';
  }

  return message;
};

/**
 * Virtual property to get decrypted content
 * Use this when you need the decrypted content in queries
 */
messageSchema.virtual('decryptedContent').get(function() {
  try {
    if (this.content && isEncrypted(this.content)) {
      return decryptMessage(this.content);
    }
    return this.content;
  } catch (error) {
    console.error('❌ Error decrypting message:', error);
    return '[Encrypted message - decryption failed]';
  }
});

// ============================================================================

export default mongoose.model('Message', messageSchema);
