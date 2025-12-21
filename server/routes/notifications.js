import express from 'express';
const router = express.Router();
import Notification from '../models/Notification.js';
import authMiddleware from '../middleware/auth.js';
import requireActiveUser from '../middleware/requireActiveUser.js';

// Get user notifications
router.get('/', authMiddleware, requireActiveUser, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.userId })
      .populate('sender', 'username displayName profilePhoto')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notifications', error: error.message });
  }
});

// Mark notification as read
router.put('/:id/read', authMiddleware, requireActiveUser, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.userId },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: 'Error updating notification', error: error.message });
  }
});

// Mark all notifications as read
router.put('/read-all', authMiddleware, requireActiveUser, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.userId, read: false },
      { read: true }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating notifications', error: error.message });
  }
});

// Delete notification
router.delete('/:id', authMiddleware, requireActiveUser, async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.userId });
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting notification', error: error.message });
  }
});

export default router;
