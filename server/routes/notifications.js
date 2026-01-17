/**
 * Notification Routes
 *
 * CANONICAL NOTIFICATION SYSTEM
 * - Bell icon: SOCIAL notifications only
 * - Messages badge: MESSAGE notifications only (handled by messages routes)
 * - No batching, no grouping, chronological order only
 *
 * PHASE 2 SAFETY: All routes use guard clauses and optional chaining
 */

import express from 'express';
const router = express.Router();
import Notification from '../models/Notification.js';
import authMiddleware from '../middleware/auth.js';
import requireActiveUser from '../middleware/requireActiveUser.js';
import { asyncHandler, requireAuth, requireValidId, sendError, HttpStatus } from '../utils/errorHandler.js';
import { isSocialNotificationType, isMessageNotificationType, getNotificationCategory } from '../constants/notificationTypes.js';
import logger from '../utils/logger.js';

// Get user notifications
// Supports ?category=social|message filter for proper Bell/Messages separation
router.get('/', authMiddleware, requireActiveUser, asyncHandler(async (req, res) => {
  // SAFETY: Guard clause for auth
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { category } = req.query;

  logger.info(`📬 [Notifications] Fetching for user: ${userId}, category: ${category || 'all'}`);

  // PERFORMANCE: Add .lean() for read-only queries (30% faster, less memory)
  let notifications = await Notification.find({ recipient: userId })
    .populate('sender', 'username displayName profilePhoto')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  logger.info(`📬 [Notifications] Found ${notifications.length} notifications for user ${userId}`);

  // Filter by category if specified
  if (category === 'social') {
    const before = notifications.length;
    notifications = notifications.filter(n => isSocialNotificationType(n.type));
    logger.info(`📬 [Notifications] After social filter: ${notifications.length} (was ${before})`);
  } else if (category === 'message') {
    // Validation warning: MESSAGE notifications should use /messages/unread endpoint
    logger.warn('[Notification] MESSAGE category requested via /notifications - use /messages/unread instead');
    notifications = notifications.filter(n => isMessageNotificationType(n.type));
  }

  // Log first few notification types for debugging
  if (notifications.length > 0) {
    const types = notifications.slice(0, 5).map(n => n.type);
    logger.info(`📬 [Notifications] First 5 types: ${types.join(', ')}`);
  }

  res.json(notifications);
}));

// Mark notification as read
router.put('/:id/read', authMiddleware, requireActiveUser, asyncHandler(async (req, res) => {
  // SAFETY: Guard clause for auth
  const userId = requireAuth(req, res);
  if (!userId) return;

  // SAFETY: Validate ObjectId
  if (!requireValidId(req.params.id, 'notification ID', res)) return;

  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: userId },
    { read: true },
    { new: true }
  );

  if (!notification) {
    return sendError(res, HttpStatus.NOT_FOUND, 'Notification not found');
  }

  // SAFETY: Optional chaining for io
  // NOTE: Socket room uses underscore format: user_${userId}
  req.io?.to(`user_${userId}`).emit('notification:read', {
    notificationId: req.params.id
  });

  res.json(notification);
}));

// Mark all notifications as read
router.put('/read-all', authMiddleware, requireActiveUser, asyncHandler(async (req, res) => {
  // SAFETY: Guard clause for auth
  const userId = requireAuth(req, res);
  if (!userId) return;

  await Notification.updateMany(
    { recipient: userId, read: false },
    { read: true }
  );

  // SAFETY: Optional chaining for io
  // NOTE: Socket room uses underscore format: user_${userId}
  req.io?.to(`user_${userId}`).emit('notification:read_all');

  res.json({ message: 'All notifications marked as read' });
}));

// Delete notification
router.delete('/:id', authMiddleware, requireActiveUser, asyncHandler(async (req, res) => {
  // SAFETY: Guard clause for auth
  const userId = requireAuth(req, res);
  if (!userId) return;

  // SAFETY: Validate ObjectId
  if (!requireValidId(req.params.id, 'notification ID', res)) return;

  await Notification.findOneAndDelete({ _id: req.params.id, recipient: userId });

  // SAFETY: Optional chaining for io
  // NOTE: Socket room uses underscore format: user_${userId}
  req.io?.to(`user_${userId}`).emit('notification:deleted', {
    notificationId: req.params.id
  });

  res.json({ message: 'Notification deleted' });
}));

export default router;
