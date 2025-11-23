import express from 'express';
const router = express.Router();
import webpush from 'web-push';
import User from '../models/User.js';
import auth from '../middleware/auth.js';

// VAPID keys should be generated and stored in environment variables
// Generate keys with: npx web-push generate-vapid-keys
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib27SkeRMzN0hFx1cBE5rZ3m8tD8FGNi2nD_X2sIbCQMnvYaRhbqQ9UqGR4',
  privateKey: process.env.VAPID_PRIVATE_KEY || 'UUxI4O8-FbRouAevSmBQ6o18BVGTLqBwZfKJXZF-eJE'
};

webpush.setVapidDetails(
  'mailto:contact@prydesocial.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Get VAPID public key
router.get('/vapid-public-key', (req, res) => {
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
    const result = await sendPushNotification(req.user.id, {
      title: 'Test Notification',
      body: 'This is a test push notification from Pryde Social!',
      data: { url: '/feed' }
    });
    
    res.json(result);
  } catch (error) {
    console.error('Test push error:', error);
    res.status(500).json({ message: 'Error sending test push notification' });
  }
});

export default router;
export { sendPushNotification };
