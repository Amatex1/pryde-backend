import admin from 'firebase-admin';
import { readFileSync } from 'fs';

let firebaseApp = null;
let messaging = null;

/**
 * Initialize Firebase Admin SDK for server-side push notifications.
 * Supports both JSON string (env var) and file path for service account credentials.
 */
const initializeFirebase = async () => {
  if (firebaseApp) return firebaseApp;

  try {
    const serviceAccountJSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (serviceAccountJSON) {
      // Parse JSON string from environment variable (recommended for cloud deployments)
      const serviceAccount = JSON.parse(serviceAccountJSON);
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('✅ Firebase Admin SDK initialized (from env JSON)');
    } else if (serviceAccountPath) {
      // Use file path (for local development)
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('✅ Firebase Admin SDK initialized (from file path)');
    } else {
      console.warn('⚠️ Firebase not configured — FCM push notifications will not work.');
      console.warn('   Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH env var.');
      return null;
    }

    messaging = admin.messaging();
    return firebaseApp;
  } catch (error) {
    console.error('❌ Firebase Admin SDK initialization failed:', error.message);
    return null;
  }
};

/**
 * Send a push notification via FCM to one or more device tokens.
 * @param {string[]} tokens - Array of FCM device tokens
 * @param {Object} payload - Notification payload { title, body, data, icon }
 * @returns {Object} { successCount, failureCount, invalidTokens }
 */
export const sendFCMNotification = async (tokens, payload) => {
  if (!messaging) {
    initializeFirebase();
    if (!messaging) {
      return { successCount: 0, failureCount: tokens.length, invalidTokens: [] };
    }
  }

  if (!tokens || tokens.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  const message = {
    notification: {
      title: payload.title || 'Pryde Social',
      body: payload.body || 'You have a new notification',
    },
    data: {
      ...(payload.data || {}),
      // Ensure all data values are strings (FCM requirement)
      url: String(payload.data?.url || '/'),
      type: String(payload.data?.type || 'general'),
      timestamp: new Date().toISOString(),
    },
    webpush: {
      notification: {
        icon: payload.icon || '/pryde-logo-small.webp',
        badge: '/pryde-logo-small.webp',
        click_action: payload.data?.url || '/',
      },
      fcmOptions: {
        link: payload.data?.url || '/',
      },
    },
    // APNs config for iOS
    apns: {
      payload: {
        aps: {
          alert: {
            title: payload.title || 'Pryde Social',
            body: payload.body || 'You have a new notification',
          },
          badge: 1,
          sound: 'default',
        },
      },
    },
    // Android config
    android: {
      priority: 'high',
      notification: {
        icon: 'ic_notification',
        color: '#0F1021',
        clickAction: payload.data?.url || '/',
      },
    },
  };

  const invalidTokens = [];
  let successCount = 0;
  let failureCount = 0;

  // Use sendEachForMulticast for multiple tokens
  try {
    const response = await messaging.sendEachForMulticast({
      tokens,
      ...message,
    });

    successCount = response.successCount;
    failureCount = response.failureCount;

    // Collect invalid/expired tokens for cleanup
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const errorCode = resp.error?.code;
        if (
          errorCode === 'messaging/invalid-registration-token' ||
          errorCode === 'messaging/registration-token-not-registered'
        ) {
          invalidTokens.push(tokens[idx]);
        }
      }
    });
  } catch (error) {
    console.error('FCM sendEachForMulticast error:', error.message);
    failureCount = tokens.length;
  }

  return { successCount, failureCount, invalidTokens };
};

/**
 * Check if Firebase is configured and ready
 */
export const isFirebaseConfigured = () => {
  return !!(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
};

// Initialize on import (fire and forget — errors are caught internally)
initializeFirebase();

export default { sendFCMNotification, isFirebaseConfigured };

