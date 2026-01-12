/**
 * Message Deduplication Utility
 * 
 * Prevents duplicate messages from being created when:
 * - Socket reconnects
 * - Client retries
 * - Race conditions between socket and REST API
 * 
 * Strategy: Use idempotency keys and message fingerprints
 */

import crypto from 'crypto';

/**
 * In-memory cache for recent message fingerprints
 * Key: fingerprint hash
 * Value: { messageId, timestamp }
 * 
 * TTL: 60 seconds (messages older than 60s are considered unique)
 */
const messageCache = new Map();

// Cleanup interval: every 30 seconds
setInterval(() => {
  const now = Date.now();
  const TTL = 60 * 1000; // 60 seconds
  
  for (const [fingerprint, data] of messageCache.entries()) {
    if (now - data.timestamp > TTL) {
      messageCache.delete(fingerprint);
    }
  }
}, 30 * 1000);

/**
 * Generate message fingerprint
 * 
 * Fingerprint = hash(senderId + recipientId + content + timestamp_rounded)
 * 
 * @param {string} senderId - Sender user ID
 * @param {string} recipientId - Recipient user ID
 * @param {string} content - Message content
 * @param {number} timestamp - Message timestamp (optional, defaults to now)
 * @returns {string} Fingerprint hash
 */
export const generateMessageFingerprint = (senderId, recipientId, content, timestamp = Date.now()) => {
  // Round timestamp to nearest 5 seconds to handle rapid retries
  const roundedTimestamp = Math.floor(timestamp / 5000) * 5000;
  
  // Create fingerprint string
  const fingerprintString = `${senderId}:${recipientId}:${content}:${roundedTimestamp}`;
  
  // Hash fingerprint
  return crypto.createHash('sha256').update(fingerprintString).digest('hex');
};

/**
 * Check if message is duplicate
 * 
 * @param {string} fingerprint - Message fingerprint
 * @returns {Object|null} Existing message data if duplicate, null otherwise
 */
export const checkDuplicate = (fingerprint) => {
  const cached = messageCache.get(fingerprint);
  
  if (cached) {
    console.log(`🔄 Duplicate message detected (fingerprint: ${fingerprint.substring(0, 8)}...)`);
    return cached;
  }
  
  return null;
};

/**
 * Register message fingerprint
 * 
 * @param {string} fingerprint - Message fingerprint
 * @param {string} messageId - Message ID
 */
export const registerMessage = (fingerprint, messageId) => {
  messageCache.set(fingerprint, {
    messageId,
    timestamp: Date.now()
  });
  
  console.log(`✅ Message registered (fingerprint: ${fingerprint.substring(0, 8)}..., id: ${messageId})`);
};

/**
 * Idempotent message creation
 * 
 * @param {Object} messageData - Message data
 * @param {Function} createFn - Function to create message (async)
 * @returns {Object} Message object (existing or newly created)
 */
export const createMessageIdempotent = async (messageData, createFn) => {
  const { sender, recipient, content } = messageData;
  
  // Generate fingerprint
  const fingerprint = generateMessageFingerprint(
    sender.toString(),
    recipient.toString(),
    content || ''
  );
  
  // Check for duplicate
  const duplicate = checkDuplicate(fingerprint);
  if (duplicate) {
    console.log(`🔄 Returning existing message: ${duplicate.messageId}`);
    return { isDuplicate: true, messageId: duplicate.messageId };
  }
  
  // Create new message
  const message = await createFn(messageData);
  
  // Register fingerprint
  registerMessage(fingerprint, message._id.toString());
  
  return { isDuplicate: false, message };
};

/**
 * Clear message cache (for testing)
 */
export const clearMessageCache = () => {
  messageCache.clear();
  console.log('🧹 Message cache cleared');
};

/**
 * Get cache stats (for monitoring)
 */
export const getCacheStats = () => {
  return {
    size: messageCache.size,
    entries: Array.from(messageCache.entries()).map(([fingerprint, data]) => ({
      fingerprint: fingerprint.substring(0, 8) + '...',
      messageId: data.messageId,
      age: Date.now() - data.timestamp
    }))
  };
};

