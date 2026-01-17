/**
 * Test Notifications Route
 * API endpoint to send test notifications with Socket.IO support
 */

import express from 'express';
const router = express.Router();
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import auth from '../middleware/auth.js';
import { emitNotificationCreated } from '../utils/notificationEmitter.js';
import { sendPushNotification } from './pushNotifications.js';

/**
 * Send a test notification to yourself
 * POST /api/test-notifications/self
 */
router.post('/self', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { message, type } = req.body;

    // Create notification
    const notification = new Notification({
      recipient: userId,
      sender: userId,
      type: type || 'system',
      message: message || `🧪 Test notification - ${new Date().toLocaleString()}`,
      read: false,
      createdAt: new Date()
    });

    await notification.save();

    // Populate sender for Socket.IO
    await notification.populate('sender', 'username displayName profilePhoto');

    // Emit Socket.IO event
    if (req.io) {
      emitNotificationCreated(req.io, userId, notification);
    }

    // Send push notification
    try {
      await sendPushNotification(userId, {
        title: '🧪 Test Notification',
        body: notification.message,
        data: {
          type: 'test',
          url: '/notifications'
        }
      });
    } catch (pushError) {
      console.error('Push notification error:', pushError);
    }

    res.json({
      success: true,
      message: 'Test notification sent',
      notification
    });
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test notification',
      error: error.message
    });
  }
});

/**
 * Send test notifications to all users (admin only)
 * POST /api/test-notifications/all
 */
router.post('/all', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { message, type } = req.body;

    // Get all users
    const users = await User.find({}).select('_id username');
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No users found'
      });
    }

    // PERFORMANCE: Use insertMany for batch insert (N times faster than individual saves)
    const notificationDocs = users.map(user => ({
      recipient: user._id,
      sender: userId,
      type: type || 'system',
      message: message || `🧪 Test notification from admin - ${new Date().toLocaleString()}`,
      read: false,
      createdAt: new Date()
    }));

    // Batch insert all notifications in one operation
    const insertedNotifications = await Notification.insertMany(notificationDocs, { ordered: false });

    // Get sender info for socket emissions
    const sender = await User.findById(userId).select('username displayName profilePhoto').lean();

    // Emit socket events and push notifications in parallel
    const successCount = insertedNotifications.length;
    const failCount = users.length - successCount;

    // Fire socket events (non-blocking)
    if (req.io) {
      insertedNotifications.forEach(notification => {
        const sanitized = {
          ...notification.toObject(),
          sender
        };
        emitNotificationCreated(req.io, notification.recipient.toString(), sanitized);
      });
    }

    // Fire push notifications in parallel (non-blocking)
    Promise.all(insertedNotifications.map(notification =>
      sendPushNotification(notification.recipient, {
        title: '🧪 Test Notification',
        body: notification.message,
        data: {
          type: 'test',
          url: '/notifications'
        }
      }).catch(err => console.error('Push error:', err))
    ));

    const notifications = insertedNotifications;

    res.json({
      success: true,
      message: `Test notifications sent to ${successCount} users`,
      summary: {
        total: users.length,
        success: successCount,
        failed: failCount
      },
      notifications
    });
  } catch (error) {
    console.error('Test notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test notifications',
      error: error.message
    });
  }
});

export default router;

