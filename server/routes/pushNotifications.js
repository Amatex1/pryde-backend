import express from 'express';
const router = express.Router();
import webpush from 'web-push';
import User from '../models/User.js';
import auth from '../middleware/auth.js';

// VAPID keys MUST be set in environment variables
// Generate keys with: npx web-push generate-vapid-keys
// SECURITY: No fallback keys - crash in production if missing
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY
};

// SECURITY: Require VAPID keys in production
if (process.env.NODE_ENV === 'production') {
  if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    throw new Error('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are required in production! Generate with: npx web-push generate-vapid-keys');
  }
}

// Only set VAPID details if keys are available
if (vapidKeys.publicKey && vapidKeys.privateKey) {
  webpush.setVapidDetails(
    'mailto:contact@prydesocial.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
} else {
  console.warn('⚠️ VAPID keys not configured. Push notifications will not work.');
}

// Get VAPID public key
router.get('/vapid-public-key', (req, res) => {
  if (!vapidKeys.publicKey) {
    return res.status(503).json({
      message: 'Push notifications not configured',
      publicKey: null
    });
  }
  res.json({ publicKey: vapidKeys.publicKey });
});

// Subscribe to push notifications
router.post('/subscribe', auth, async (req, res) => {
  try {
    const { subscription } = req.body;
    
    // Save subscription to user
    await User.findByIdAndUpdate(req.user.id, {
      pushSubscription: subscription
    });
    
    res.json({ success: true, message: 'Subscribed to push notifications' });
  } catch (error) {
    console.error('Push subscription error:', error);
    res.status(500).json({ message: 'Error subscribing to push notifications' });
  }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      pushSubscription: null
    });
    
    res.json({ success: true, message: 'Unsubscribed from push notifications' });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    res.status(500).json({ message: 'Error unsubscribing from push notifications' });
  }
});

// Send push notification to a user
async function sendPushNotification(userId, payload) {
  try {
    const user = await User.findById(userId);

    if (!user || !user.pushSubscription) {
      return { success: false, message: 'User not subscribed to push notifications' };
    }

    // Check notification type and user preferences
    const notificationType = payload.data?.type;

    // Check if user has disabled this type of notification
    if (notificationType === 'login_approval' && user.loginAlerts?.enabled === false) {
      return { success: false, message: 'User has disabled login alert notifications' };
    }

    // Check if user is in Quiet Mode and notification is not critical
    const criticalTypes = ['login_approval', 'security_alert', 'account_warning'];
    if (user.privacySettings?.quietModeEnabled && !criticalTypes.includes(notificationType)) {
      return { success: false, message: 'User is in Quiet Mode - non-critical notifications suppressed' };
    }

    const notificationPayload = JSON.stringify({
      title: payload.title || 'Pryde Social',
      body: payload.body || 'You have a new notification',
      icon: payload.icon || '/favicon.svg',
      badge: '/favicon.svg',
      data: payload.data || {}
    });

    await webpush.sendNotification(user.pushSubscription, notificationPayload);

    return { success: true, message: 'Push notification sent' };
  } catch (error) {
    console.error('Send push notification error:', error);

    // If subscription is invalid, remove it
    if (error.statusCode === 410) {
      await User.findByIdAndUpdate(userId, { pushSubscription: null });
    }

    return { success: false, message: error.message };
  }
}

// Test push notification
router.post('/test', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    // Check if user has push subscription
    if (!user.pushSubscription) {
      return res.status(400).json({
        success: false,
        message: 'No push subscription found. Please enable notifications first.',
        hasSubscription: false
      });
    }

    // Get custom message from request or use default
    const { title, body, testType } = req.body;

    let notificationConfig = {
      title: title || '🔔 Test Notification',
      body: body || 'This is a test push notification from Pryde Social! If you see this, notifications are working! ✅',
      data: {
        url: '/notifications',
        type: 'test',
        timestamp: new Date().toISOString()
      },
      tag: 'test-notification',
      requireInteraction: false
    };

    // Different test types
    if (testType === 'login_approval') {
      notificationConfig = {
        title: '🔐 Test Login Approval',
        body: 'New login from Chrome on Windows. Code: 42',
        data: {
          type: 'login_approval',
          verificationCode: '42',
          deviceInfo: 'Chrome on Windows',
          url: '/notifications'
        },
        tag: 'login-approval-test',
        requireInteraction: true
      };
    } else if (testType === 'message') {
      notificationConfig = {
        title: '💬 Test Message',
        body: 'You have a new message from Test User',
        data: {
          type: 'message',
          url: '/messages'
        },
        tag: 'message-test'
      };
    } else if (testType === 'friend_request') {
      notificationConfig = {
        title: '👋 Test Friend Request',
        body: 'Test User sent you a friend request',
        data: {
          type: 'friend_request',
          url: '/friends'
        },
        tag: 'friend-request-test'
      };
    }

    const result = await sendPushNotification(req.user.id, notificationConfig);

    if (result.success) {
      res.json({
        success: true,
        message: 'Test notification sent successfully! Check your device.',
        hasSubscription: true,
        subscriptionEndpoint: user.pushSubscription.endpoint.substring(0, 50) + '...',
        testType: testType || 'default'
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message || 'Failed to send test notification',
        hasSubscription: true
      });
    }
  } catch (error) {
    console.error('Test push error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending test push notification: ' + error.message
    });
  }
});

// Get push notification status
router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.json({
      enabled: !!user.pushSubscription,
      hasSubscription: !!user.pushSubscription,
      subscriptionEndpoint: user.pushSubscription ?
        user.pushSubscription.endpoint.substring(0, 50) + '...' : null,
      pushTwoFactorEnabled: user.pushTwoFactorEnabled || false,
      preferPushTwoFactor: user.preferPushTwoFactor || false
    });
  } catch (error) {
    console.error('Push status error:', error);
    res.status(500).json({ message: 'Error getting push notification status' });
  }
});

export default router;
export { sendPushNotification };
