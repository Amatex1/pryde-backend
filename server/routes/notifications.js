/**
 * Notification Routes
 * PHASE 2 SAFETY: All routes use guard clauses and optional chaining
 */

import express from 'express';
const router = express.Router();
import Notification from '../models/Notification.js';
import authMiddleware from '../middleware/auth.js';
import requireActiveUser from '../middleware/requireActiveUser.js';
import { asyncHandler, requireAuth, requireValidId, sendError, HttpStatus } from '../utils/errorHandler.js';

// Get user notifications
router.get('/', authMiddleware, requireActiveUser, asyncHandler(async (req, res) => {
  // SAFETY: Guard clause for auth
  const userId = requireAuth(req, res);
  if (!userId) return;

  const notifications = await Notification.find({ recipient: userId })
    .populate('sender', 'username displayName profilePhoto')
    .sort({ createdAt: -1 })
    .limit(50);

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
  req.io?.to(`user:${userId}`).emit('notification:read', {
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
  req.io?.to(`user:${userId}`).emit('notification:read_all');

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
  req.io?.to(`user:${userId}`).emit('notification:deleted', {
    notificationId: req.params.id
  });

  res.json({ message: 'Notification deleted' });
}));

export default router;
