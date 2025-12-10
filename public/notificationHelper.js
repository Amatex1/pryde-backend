/**
 * Notification Helper for Pryde Social
 * Handles push notification subscription using Service Worker
 * Fixes "Illegal constructor" error on mobile
 */

const API_URL = 'https://pryde-social.onrender.com';

/**
 * Request notification permission and subscribe to push notifications
 * Uses Service Worker registration (required for mobile)
 * @returns {Promise<Object>} Subscription result
 */
export async function requestNotificationPermission() {
  try {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      throw new Error('This browser does not support notifications');
    }

    // Check if service worker is supported
    if (!('serviceWorker' in navigator)) {
      throw new Error('This browser does not support service workers');
    }

    // Check if push notifications are supported
    if (!('PushManager' in window)) {
      throw new Error('This browser does not support push notifications');
    }

    console.log('[Notifications] Requesting permission...');

    // Request permission
    const permission = await Notification.requestPermission();
    
    if (permission !== 'granted') {
      throw new Error('Notification permission denied');
    }

    console.log('[Notifications] Permission granted, registering service worker...');

    // Register service worker if not already registered
    let registration = await navigator.serviceWorker.getRegistration();
    
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js');
      console.log('[Notifications] Service worker registered');
    }

    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;

    console.log('[Notifications] Getting VAPID public key...');

    // Get VAPID public key from server
    const vapidResponse = await fetch(`${API_URL}/api/push/vapid-public-key`);
    const { publicKey } = await vapidResponse.json();

    console.log('[Notifications] Subscribing to push notifications...');

    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    console.log('[Notifications] Push subscription created:', subscription);

    // Send subscription to server
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Not authenticated. Please log in first.');
    }

    const response = await fetch(`${API_URL}/api/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ subscription })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Failed to subscribe to push notifications');
    }

    console.log('[Notifications] Successfully subscribed:', result);

    return {
      success: true,
      message: 'Notifications enabled successfully!',
      subscription
    };

  } catch (error) {
    console.error('[Notifications] Error:', error);
    return {
      success: false,
      message: error.message || 'Failed to enable notifications',
      error
    };
  }
}

/**
 * Send a test notification
 * @param {string} testType - Type of test notification (default, login_approval, message, friend_request)
 * @returns {Promise<Object>} Test result
 */
export async function sendTestNotification(testType = 'default') {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Not authenticated. Please log in first.');
    }

    const response = await fetch(`${API_URL}/api/push/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ testType })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Failed to send test notification');
    }

    return result;

  } catch (error) {
    console.error('[Notifications] Test error:', error);
    return {
      success: false,
      message: error.message || 'Failed to send test notification',
      error
    };
  }
}

/**
 * Convert VAPID public key from base64 to Uint8Array
 * @param {string} base64String - Base64 encoded VAPID key
 * @returns {Uint8Array} Converted key
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

