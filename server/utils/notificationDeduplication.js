/**
 * Notification Deduplication Utility
 * 
 * Prevents duplicate notifications from being created when:
 * - User rapidly likes/unlikes
 * - Socket reconnects
 * - Race conditions
 * 
 * Strategy: Use notification fingerprints and time-based deduplication
 */

import crypto from 'crypto';

/**
 * In-memory cache for recent notification fingerprints
 * Key: fingerprint hash
 * Value: { notificationId, timestamp }
 * 
 * TTL: 300 seconds (5 minutes)
 */
const notificationCache = new Map();

// Cleanup interval: every 60 seconds
setInterval(() => {
  const now = Date.now();
  const TTL = 300 * 1000; // 5 minutes
  
  for (const [fingerprint, data] of notificationCache.entries()) {
    if (now - data.timestamp > TTL) {
      notificationCache.delete(fingerprint);
    }
  }
}, 60 * 1000);

/**
 * Generate notification fingerprint
 * 
 * Fingerprint = hash(recipientId + senderId + type + targetId + timestamp_rounded)
 * 
 * @param {string} recipientId - Recipient user ID
 * @param {string} senderId - Sender user ID
 * @param {string} type - Notification type (like, comment, follow, etc.)
 * @param {string} targetId - Target ID (postId, commentId, etc.)
 * @param {number} timestamp - Notification timestamp (optional, defaults to now)
 * @returns {string} Fingerprint hash
 */
export const generateNotificationFingerprint = (recipientId, senderId, type, targetId = '', timestamp = Date.now()) => {
  // Round timestamp to nearest 60 seconds to batch rapid events
  const roundedTimestamp = Math.floor(timestamp / 60000) * 60000;
  
  // Create fingerprint string
  const fingerprintString = `${recipientId}:${senderId}:${type}:${targetId}:${roundedTimestamp}`;
  
  // Hash fingerprint
  return crypto.createHash('sha256').update(fingerprintString).digest('hex');
};

/**
 * Check if notification is duplicate
 * 
 * @param {string} fingerprint - Notification fingerprint
 * @returns {Object|null} Existing notification data if duplicate, null otherwise
 */
export const checkNotificationDuplicate = (fingerprint) => {
  const cached = notificationCache.get(fingerprint);
  
  if (cached) {
    console.log(`🔄 Duplicate notification detected (fingerprint: ${fingerprint.substring(0, 8)}...)`);
    return cached;
  }
  
  return null;
};

/**
 * Register notification fingerprint
 * 
 * @param {string} fingerprint - Notification fingerprint
 * @param {string} notificationId - Notification ID
 */
export const registerNotification = (fingerprint, notificationId) => {
  notificationCache.set(fingerprint, {
    notificationId,
    timestamp: Date.now()
  });
  
  console.log(`✅ Notification registered (fingerprint: ${fingerprint.substring(0, 8)}..., id: ${notificationId})`);
};

/**
 * Idempotent notification creation
 * 
 * @param {Object} notificationData - Notification data
 * @param {Function} createFn - Function to create notification (async)
 * @returns {Object} Notification object (existing or newly created)
 */
export const createNotificationIdempotent = async (notificationData, createFn) => {
  const { recipient, sender, type, metadata } = notificationData;
  
  // Extract target ID from metadata
  const targetId = metadata?.postId || metadata?.commentId || metadata?.userId || '';
  
  // Generate fingerprint
  const fingerprint = generateNotificationFingerprint(
    recipient.toString(),
    sender.toString(),
    type,
    targetId.toString()
  );
  
  // Check for duplicate
  const duplicate = checkNotificationDuplicate(fingerprint);
  if (duplicate) {
    console.log(`🔄 Returning existing notification: ${duplicate.notificationId}`);
    return { isDuplicate: true, notificationId: duplicate.notificationId };
  }
  
  // Create new notification
  const notification = await createFn(notificationData);
  
  // Register fingerprint
  registerNotification(fingerprint, notification._id.toString());
  
  return { isDuplicate: false, notification };
};

/**
 * Clear notification cache (for testing)
 */
export const clearNotificationCache = () => {
  notificationCache.clear();
  console.log('🧹 Notification cache cleared');
};

/**
 * Get cache stats (for monitoring)
 */
export const getNotificationCacheStats = () => {
  return {
    size: notificationCache.size,
    entries: Array.from(notificationCache.entries()).map(([fingerprint, data]) => ({
      fingerprint: fingerprint.substring(0, 8) + '...',
      notificationId: data.notificationId,
      age: Date.now() - data.timestamp
    }))
  };
};

