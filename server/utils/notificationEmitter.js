/**
 * Notification Socket.IO Emitter
 * Centralized utility for emitting real-time notification events
 */

/**
 * Emit a new notification to a user via Socket.IO
 * @param {Object} io - Socket.IO instance
 * @param {String} recipientId - User ID to send notification to
 * @param {Object} notification - Notification object (must be populated)
 */
export function emitNotificationCreated(io, recipientId, notification) {
  if (!io || !recipientId || !notification) {
    console.warn('[NotificationEmitter] Missing required parameters');
    return;
  }

  // Sanitize notification for client
  const sanitized = {
    _id: notification._id,
    recipient: notification.recipient,
    sender: notification.sender ? {
      _id: notification.sender._id,
      username: notification.sender.username,
      displayName: notification.sender.displayName,
      profilePhoto: notification.sender.profilePhoto
    } : null,
    type: notification.type,
    message: notification.message,
    read: notification.read,
    link: notification.link,
    postId: notification.postId,
    commentId: notification.commentId,
    // PHASE 4B: Group notification fields
    groupId: notification.groupId,
    groupSlug: notification.groupSlug,
    groupName: notification.groupName,
    loginApprovalId: notification.loginApprovalId,
    loginApprovalData: notification.loginApprovalData,
    createdAt: notification.createdAt
  };

  io.to(`user_${recipientId}`).emit('notification:new', {
    notification: sanitized
  });

  console.log(`📡 [NotificationEmitter] Emitted notification:new to user_${recipientId}`);
}

/**
 * Emit notification read event
 * @param {Object} io - Socket.IO instance
 * @param {String} recipientId - User ID
 * @param {String} notificationId - Notification ID that was read
 */
export function emitNotificationRead(io, recipientId, notificationId) {
  if (!io || !recipientId || !notificationId) return;

  io.to(`user_${recipientId}`).emit('notification:read', {
    notificationId
  });

  console.log(`📡 [NotificationEmitter] Emitted notification:read to user_${recipientId}`);
}

/**
 * Emit notification deleted event
 * @param {Object} io - Socket.IO instance
 * @param {String} recipientId - User ID
 * @param {String} notificationId - Notification ID that was deleted
 */
export function emitNotificationDeleted(io, recipientId, notificationId) {
  if (!io || !recipientId || !notificationId) return;

  io.to(`user_${recipientId}`).emit('notification:deleted', {
    notificationId
  });

  console.log(`📡 [NotificationEmitter] Emitted notification:deleted to user_${recipientId}`);
}

/**
 * Emit all notifications read event
 * @param {Object} io - Socket.IO instance
 * @param {String} recipientId - User ID
 */
export function emitAllNotificationsRead(io, recipientId) {
  if (!io || !recipientId) return;

  io.to(`user_${recipientId}`).emit('notification:read_all');

  console.log(`📡 [NotificationEmitter] Emitted notification:read_all to user_${recipientId}`);
}

