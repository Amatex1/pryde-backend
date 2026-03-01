import express from 'express';
const router = express.Router();
import webpush from 'web-push';
import User from '../models/User.js';
import auth from '../middleware/auth.js';
import { sendFCMNotification, isFirebaseConfigured } from '../utils/firebaseAdmin.js';

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

// ============================================
// FCM TOKEN MANAGEMENT ROUTES
// ============================================

// Register FCM device token
router.post('/fcm-register', auth, async (req, res) => {
  try {
    const { token, device } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'FCM token is required' });
    }

    const user = await User.findById(req.user.id);
    const existingTokens = user.fcmTokens || [];

    // Remove any existing entry for this token (to update device info / timestamp)
    const filtered = existingTokens.filter(t => t.token !== token);
    filtered.push({ token, device: device || 'web', createdAt: new Date() });

    await User.findByIdAndUpdate(req.user.id, { fcmTokens: filtered });

    res.json({ success: true, message: 'FCM token registered' });
  } catch (error) {
    console.error('FCM token register error:', error);
    res.status(500).json({ message: 'Error registering FCM token' });
  }
});

// Unregister FCM device token
router.post('/fcm-unregister', auth, async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'FCM token is required' });
    }

    const user = await User.findById(req.user.id);
    const updatedTokens = (user.fcmTokens || []).filter(t => t.token !== token);

    await User.findByIdAndUpdate(req.user.id, { fcmTokens: updatedTokens });

    res.json({ success: true, message: 'FCM token unregistered' });
  } catch (error) {
    console.error('FCM token unregister error:', error);
    res.status(500).json({ message: 'Error unregistering FCM token' });
  }
});

// Get FCM status
router.get('/fcm-status', (req, res) => {
  res.json({ configured: isFirebaseConfigured() });
});

// ============================================
// SEND PUSH NOTIFICATION (Web Push + FCM)
// ============================================

// Send push notification to ALL of a user's devices via both Web Push and FCM
// Pass options.targetEndpoint to send only to a specific device subscription
async function sendPushNotification(userId, payload, options = {}) {
  try {
    const user = await User.findById(userId);

    if (!user) {
      return { success: false, message: 'User not found' };
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

    let anySuccess = false;

    // ---- CHANNEL 1: Web Push (VAPID) ----
    let subscriptions = (user.pushSubscriptions && user.pushSubscriptions.length > 0)
      ? user.pushSubscriptions
      : user.pushSubscription
        ? [user.pushSubscription]
        : [];

    // If targeting a specific device, filter to just that subscription
    if (options.targetEndpoint) {
      subscriptions = subscriptions.filter(s => s.endpoint === options.targetEndpoint);
    }

    if (subscriptions.length > 0) {
      const notificationPayload = JSON.stringify({
        title: payload.title || 'Pryde Social',
        body: payload.body || 'You have a new notification',
        icon: payload.icon || '/pryde-logo-small.webp',
        badge: '/pryde-logo-small.webp',
        tag: payload.tag,
        data: payload.data || {}
      });

      const expiredEndpoints = [];

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

      // Clean up expired web push subscriptions
      if (expiredEndpoints.length > 0) {
        const cleaned = subscriptions.filter(s => !expiredEndpoints.includes(s.endpoint));
        await User.findByIdAndUpdate(userId, {
          pushSubscriptions: cleaned,
          pushSubscription: cleaned.length > 0 ? cleaned[cleaned.length - 1] : null
        });
      }
    }

    // ---- CHANNEL 2: Firebase Cloud Messaging (FCM) ----
    const fcmTokens = (user.fcmTokens || []).map(t => t.token);

    if (fcmTokens.length > 0 && isFirebaseConfigured()) {
      const fcmResult = await sendFCMNotification(fcmTokens, payload);

      if (fcmResult.successCount > 0) {
        anySuccess = true;
      }

      // Clean up invalid FCM tokens
      if (fcmResult.invalidTokens.length > 0) {
        const cleanedFcmTokens = (user.fcmTokens || []).filter(
          t => !fcmResult.invalidTokens.includes(t.token)
        );
        await User.findByIdAndUpdate(userId, { fcmTokens: cleanedFcmTokens });
      }
    }

    // Check if user has any push channels at all
    if (subscriptions.length === 0 && fcmTokens.length === 0) {
      return { success: false, message: 'User not subscribed to push notifications' };
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

    const { title, body, testType, endpoint } = req.body;

    // All subscriptions for this user
    const allSubs = (user.pushSubscriptions && user.pushSubscriptions.length > 0)
      ? user.pushSubscriptions
      : user.pushSubscription
        ? [user.pushSubscription]
        : [];

    const hasAny = allSubs.length > 0;
    if (!hasAny) {
      return res.status(400).json({
        success: false,
        message: 'No push subscription found. Please enable notifications first.',
        hasSubscription: false
      });
    }

    // If a specific device endpoint was provided, verify it is subscribed
    if (endpoint) {
      const deviceSub = allSubs.find(s => s.endpoint === endpoint);
      if (!deviceSub) {
        return res.status(400).json({
          success: false,
          message: 'This device is not subscribed to notifications. Enable notifications on this device first.',
          hasSubscription: false
        });
      }
    }

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

    const result = await sendPushNotification(req.user.id, notificationConfig, { targetEndpoint: endpoint || null });
    const deviceCount = endpoint ? 1 : ((user.pushSubscriptions?.length || 0) || (user.pushSubscription ? 1 : 0));

    if (result.success) {
      res.json({
        success: true,
        message: `Test notification sent to ${deviceCount} device(s). Check your device(s).`,
        hasSubscription: true,
        deviceCount,
        testType: testType || 'default'
      });
    } else {
      res.status(422).json({
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
// Optional query param ?endpoint=<url> to check if a specific device is subscribed
router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const webPushCount = user.pushSubscriptions?.length || (user.pushSubscription ? 1 : 0);
    const fcmCount = user.fcmTokens?.length || 0;
    const totalDevices = webPushCount + fcmCount;

    // Per-device check: is the requesting device specifically subscribed?
    let thisDeviceEnabled = null;
    const { endpoint } = req.query;
    if (endpoint) {
      const allSubs = user.pushSubscriptions?.length > 0
        ? user.pushSubscriptions
        : user.pushSubscription ? [user.pushSubscription] : [];
      thisDeviceEnabled = allSubs.some(s => s.endpoint === endpoint);
    }

    res.json({
      enabled: totalDevices > 0,
      hasSubscription: totalDevices > 0,
      thisDeviceEnabled,
      deviceCount: totalDevices,
      webPushDevices: webPushCount,
      fcmDevices: fcmCount,
      fcmConfigured: isFirebaseConfigured(),
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
