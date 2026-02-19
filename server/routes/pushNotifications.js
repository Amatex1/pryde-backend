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

// Subscribe to push notifications — adds this device, keeps others
router.post('/subscribe', auth, async (req, res) => {
  try {
    const { subscription } = req.body;
    const endpoint = subscription?.endpoint;

    if (!endpoint) {
      return res.status(400).json({ message: 'Invalid subscription object' });
    }

    const user = await User.findById(req.user.id);

    // Build updated array: remove any existing entry for this endpoint, then add the new one
    const existing = (user.pushSubscriptions || []).filter(s => s.endpoint !== endpoint);
    existing.push(subscription);

    await User.findByIdAndUpdate(req.user.id, {
      pushSubscriptions: existing,
      pushSubscription: subscription  // keep legacy field in sync for 2FA / other references
    });

    res.json({ success: true, message: 'Subscribed to push notifications' });
  } catch (error) {
    console.error('Push subscription error:', error);
    res.status(500).json({ message: 'Error subscribing to push notifications' });
  }
});

// Unsubscribe from push notifications — removes only this device
router.post('/unsubscribe', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    // Try to identify which device is unsubscribing via its current subscription endpoint
    let endpoint = null;
    try {
      if ('serviceWorker' in (global || {})) {
        // server-side — skip
      }
    } catch {}

    // Client sends endpoint in body optionally; otherwise clear all
    const { endpoint: bodyEndpoint } = req.body || {};
    endpoint = bodyEndpoint;

    let updatedSubscriptions;
    let updatedLegacy = null;

    if (endpoint) {
      // Remove just this device
      updatedSubscriptions = (user.pushSubscriptions || []).filter(s => s.endpoint !== endpoint);
      updatedLegacy = updatedSubscriptions.length > 0 ? updatedSubscriptions[updatedSubscriptions.length - 1] : null;
    } else {
      // No endpoint provided — clear all
      updatedSubscriptions = [];
      updatedLegacy = null;
    }

    await User.findByIdAndUpdate(req.user.id, {
      pushSubscriptions: updatedSubscriptions,
      pushSubscription: updatedLegacy
    });

    res.json({ success: true, message: 'Unsubscribed from push notifications' });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    res.status(500).json({ message: 'Error unsubscribing from push notifications' });
  }
});

// Send push notification to ALL of a user's devices
async function sendPushNotification(userId, payload) {
  try {
    const user = await User.findById(userId);

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // Build list of subscriptions — prefer new array, fall back to legacy single field
    const subscriptions = (user.pushSubscriptions && user.pushSubscriptions.length > 0)
      ? user.pushSubscriptions
      : user.pushSubscription
        ? [user.pushSubscription]
        : [];

    if (subscriptions.length === 0) {
      return { success: false, message: 'User not subscribed to push notifications' };
    }

    // Check notification type and user preferences
    const notificationType = payload.data?.type;

    if (notificationType === 'login_approval' && user.loginAlerts?.enabled === false) {
      return { success: false, message: 'User has disabled login alert notifications' };
    }

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

    // Send to all devices, collecting which ones are expired
    const expiredEndpoints = [];
    let anySuccess = false;

    await Promise.all(subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, notificationPayload);
        anySuccess = true;
      } catch (err) {
        if (err.statusCode === 410) {
          expiredEndpoints.push(sub.endpoint);
        } else {
          console.error('Push send error for endpoint:', sub.endpoint?.substring(0, 40), err.message);
        }
      }
    }));

    // Clean up any expired subscriptions
    if (expiredEndpoints.length > 0) {
      const cleaned = subscriptions.filter(s => !expiredEndpoints.includes(s.endpoint));
      await User.findByIdAndUpdate(userId, {
        pushSubscriptions: cleaned,
        pushSubscription: cleaned.length > 0 ? cleaned[cleaned.length - 1] : null
      });
    }

    return anySuccess
      ? { success: true, message: 'Push notification sent' }
      : { success: false, message: 'All subscriptions failed or expired' };

  } catch (error) {
    console.error('Send push notification error:', error);
    return { success: false, message: error.message };
  }
}

// Test push notification
router.post('/test', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    const hasAny = (user.pushSubscriptions && user.pushSubscriptions.length > 0) || !!user.pushSubscription;
    if (!hasAny) {
      return res.status(400).json({
        success: false,
        message: 'No push subscription found. Please enable notifications first.',
        hasSubscription: false
      });
    }

    const { title, body, testType } = req.body;

    let notificationConfig = {
      title: title || '🔔 Test Notification',
      body: body || 'This is a test push notification from Pryde Social! If you see this, notifications are working! ✅',
      data: {
        url: '/notifications',
        type: 'test',
        timestamp: new Date().toISOString()
      }
    };

    if (testType === 'login_approval') {
      notificationConfig = {
        title: '🔐 Test Login Approval',
        body: 'New login from Chrome on Windows. Code: 42',
        data: { type: 'login_approval', verificationCode: '42', deviceInfo: 'Chrome on Windows', url: '/notifications' }
      };
    } else if (testType === 'message') {
      notificationConfig = {
        title: '💬 Test Message',
        body: 'You have a new message from Test User',
        data: { type: 'message', url: '/messages' }
      };
    } else if (testType === 'friend_request') {
      notificationConfig = {
        title: '👋 Test Friend Request',
        body: 'Test User sent you a friend request',
        data: { type: 'friend_request', url: '/friends' }
      };
    }

    const result = await sendPushNotification(req.user.id, notificationConfig);
    const deviceCount = (user.pushSubscriptions?.length || 0) || (user.pushSubscription ? 1 : 0);

    if (result.success) {
      res.json({
        success: true,
        message: `Test notification sent to ${deviceCount} device(s). Check your device(s).`,
        hasSubscription: true,
        deviceCount,
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
    res.status(500).json({ success: false, message: 'Error sending test push notification: ' + error.message });
  }
});

// Get push notification status
router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const deviceCount = user.pushSubscriptions?.length || (user.pushSubscription ? 1 : 0);

    res.json({
      enabled: deviceCount > 0,
      hasSubscription: deviceCount > 0,
      deviceCount,
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
