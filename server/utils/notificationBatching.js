/**
 * Notification Batching Utility
 * 
 * Batches similar notifications within a time window to prevent spam.
 * Example: "John and 5 others liked your post" instead of 6 separate notifications
 * 
 * Strategy: Group notifications by type and target within 5-minute window
 */

import Notification from '../models/Notification.js';

/**
 * Batch window in milliseconds (5 minutes)
 */
const BATCH_WINDOW = 5 * 60 * 1000;

/**
 * Check if notification should be batched
 * 
 * @param {string} recipientId - Recipient user ID
 * @param {string} type - Notification type (like, comment, follow)
 * @param {string} targetId - Target ID (postId, commentId, etc.)
 * @returns {Object|null} Existing notification to batch with, or null
 */
export const findBatchableNotification = async (recipientId, type, targetId) => {
  const cutoffTime = new Date(Date.now() - BATCH_WINDOW);
  
  // Find recent notification of same type and target
  const existingNotification = await Notification.findOne({
    recipient: recipientId,
    type,
    'metadata.postId': targetId,
    createdAt: { $gte: cutoffTime },
    read: false // Only batch with unread notifications
  }).sort({ createdAt: -1 });
  
  return existingNotification;
};

/**
 * Add sender to batched notification
 * 
 * @param {Object} notification - Existing notification
 * @param {string} senderId - New sender ID to add
 * @returns {Object} Updated notification
 */
export const addToBatch = async (notification, senderId) => {
  // Initialize batchedSenders if not exists
  if (!notification.batchedSenders) {
    notification.batchedSenders = [notification.sender];
  }
  
  // Add new sender if not already in batch
  if (!notification.batchedSenders.some(id => id.toString() === senderId.toString())) {
    notification.batchedSenders.push(senderId);
  }
  
  // Update message to reflect batch
  const count = notification.batchedSenders.length;
  if (count === 2) {
    notification.message = notification.message.replace(/^(\w+)/, '$1 and 1 other');
  } else if (count > 2) {
    notification.message = notification.message.replace(/and \d+ others?/, `and ${count - 1} others`);
  }
  
  // Update timestamp to latest action
  notification.updatedAt = new Date();
  
  await notification.save();
  return notification;
};

/**
 * Create or batch notification
 * 
 * @param {Object} notificationData - Notification data
 * @returns {Object} Created or updated notification
 */
export const createOrBatchNotification = async (notificationData) => {
  const { recipient, sender, type, metadata } = notificationData;
  const targetId = metadata?.postId || metadata?.commentId || null;
  
  // Only batch certain types
  const batchableTypes = ['like', 'comment', 'follow'];
  if (!batchableTypes.includes(type) || !targetId) {
    // Create new notification without batching
    const notification = new Notification(notificationData);
    await notification.save();
    return { notification, isBatched: false };
  }
  
  // Check for batchable notification
  const existingNotification = await findBatchableNotification(recipient, type, targetId);
  
  if (existingNotification) {
    // Add to batch
    const updatedNotification = await addToBatch(existingNotification, sender);
    console.log(`📦 Batched notification: ${type} on ${targetId} (${updatedNotification.batchedSenders.length} senders)`);
    return { notification: updatedNotification, isBatched: true };
  }
  
  // Create new notification
  const notification = new Notification(notificationData);
  await notification.save();
  console.log(`✅ Created new notification: ${type} on ${targetId}`);
  return { notification, isBatched: false };
};

/**
 * Get batched notification summary
 * 
 * @param {Object} notification - Notification object
 * @returns {Object} Summary with sender names
 */
export const getBatchSummary = async (notification) => {
  if (!notification.batchedSenders || notification.batchedSenders.length === 0) {
    return {
      count: 1,
      senders: [notification.sender]
    };
  }
  
  return {
    count: notification.batchedSenders.length,
    senders: notification.batchedSenders
  };
};

/**
 * Clear old batched notifications (cleanup job)
 * Run this periodically to prevent unbounded growth
 */
export const cleanupOldBatches = async () => {
  const cutoffTime = new Date(Date.now() - BATCH_WINDOW * 2); // 10 minutes
  
  const result = await Notification.updateMany(
    {
      createdAt: { $lt: cutoffTime },
      batchedSenders: { $exists: true, $ne: [] }
    },
    {
      $unset: { batchedSenders: '' }
    }
  );
  
  console.log(`🧹 Cleaned up ${result.modifiedCount} old batched notifications`);
  return result.modifiedCount;
};

// Run cleanup every 10 minutes
setInterval(cleanupOldBatches, 10 * 60 * 1000);

