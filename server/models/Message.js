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
  readBy: {
    type: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      readAt: {
        type: Date,
        default: Date.now
      }
    }],
    validate: {
      validator: v => v.length <= 500,
      message: 'readBy cannot exceed 500 entries'
    },
    default: []
  },
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
  // Message reactions (emoji responses to individual messages)
  reactions: {
    type: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      emoji: {
        type: String,
        required: true,
        maxlength: 10
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    validate: {
      validator: v => v.length <= 100,
      message: 'A message cannot have more than 100 reactions'
    },
    default: []
  },
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

// PERFORMANCE: Critical indexes for unread message queries (high-traffic)
messageSchema.index({ recipient: 1, read: 1, createdAt: -1 }); // Unread message counts
messageSchema.index({ sender: 1, recipient: 1, read: 1 }); // Conversation unread status
messageSchema.index({ groupChat: 1, isDeletedForAll: 1, createdAt: -1 }); // Group message filtering

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that message has either content or attachment,
 * and is addressed to either a recipient (DM) or groupChat (group message).
 */
messageSchema.pre('validate', function(next) {
  if (!this.content && !this.attachment) {
    return next(new Error('Message must have either content or attachment'));
  }
  if (!this.recipient && !this.groupChat) {
    return next(new Error('Message must have either a recipient or a groupChat'));
  }
  next();
});

// ============================================================================
// ENCRYPTION MIDDLEWARE
// ============================================================================

/**
 * Encrypt message content before saving to database
 * This ensures all messages are encrypted at rest
 *
 * ⚡ PERFORMANCE: Can be disabled via ENABLE_MESSAGE_ENCRYPTION=false
 * Disabling saves ~50-100ms per message
 */
messageSchema.pre('save', async function(next) {
  try {
    // Encrypt content if modified and not already encrypted — no env toggle, always on
    if (this.isModified('content') && this.content && !isEncrypted(this.content)) {
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
 *
 * 🔥 CRITICAL: Always decrypt encrypted messages, even if encryption is disabled
 * This handles old encrypted messages when encryption is turned off
 * Also handles backward compatibility for messages stored as JSON strings or raw hex strings
 */
messageSchema.methods.toJSON = function() {
  const message = this.toObject();

  try {
    if (!message.content) return message;

    if (typeof message.content === 'string') {
      if (isEncrypted(message.content)) {
        message.content = decryptMessage(message.content);
      }
    } else if (typeof message.content === 'object' && message.content !== null) {
      if (isEncrypted(message.content)) {
        message.content = decryptMessage(message.content);
      }
    }
  } catch (error) {
    console.error('Error decrypting message:', error.message);
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
