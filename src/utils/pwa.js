// PWA Registration and Management

/**
 * Register the service worker
 */
export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('[PWA] Service Worker registered successfully:', registration.scope);

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('[PWA] New Service Worker found, installing...');

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker available, prompt user to refresh
            console.log('[PWA] New version available! Please refresh.');
            showUpdateNotification();
          }
        });
      });

      // Check for updates every hour
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);

      return registration;
    } catch (error) {
      console.error('[PWA] Service Worker registration failed:', error);
    }
  } else {
    console.log('[PWA] Service Workers not supported in this browser');
  }
}

/**
 * Unregister the service worker
 */
export async function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
    }
    console.log('[PWA] Service Worker unregistered');
  }
}

/**
 * Show update notification to user
 */
function showUpdateNotification() {
  // You can integrate this with your toast notification system
  if (window.confirm('A new version of Pryde Social is available! Refresh to update?')) {
    window.location.reload();
  }
}

/**
 * Check if app is installed as PWA
 */
export function isPWA() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true ||
         document.referrer.includes('android-app://');
}

/**
 * Check if app can be installed
 */
export function canInstallPWA() {
  return 'BeforeInstallPromptEvent' in window;
}

/**
 * Prompt user to install PWA
 */
let deferredPrompt = null;

export function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    console.log('[PWA] Install prompt available');
    
    // Show install button/banner
    showInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed successfully');
    deferredPrompt = null;
    hideInstallButton();
  });
}

/**
 * Trigger install prompt
 */
export async function promptInstall() {
  if (!deferredPrompt) {
    console.log('[PWA] Install prompt not available');
    return false;
  }

  // Show the install prompt
  deferredPrompt.prompt();

  // Wait for the user to respond to the prompt
  const { outcome } = await deferredPrompt.userChoice;
  console.log(`[PWA] User response to install prompt: ${outcome}`);

  // Clear the deferredPrompt
  deferredPrompt = null;

  return outcome === 'accepted';
}

/**
 * Show install button (integrate with your UI)
 */
function showInstallButton() {
  // Dispatch custom event that your components can listen to
  window.dispatchEvent(new CustomEvent('pwa-install-available'));
}

/**
 * Hide install button
 */
function hideInstallButton() {
  window.dispatchEvent(new CustomEvent('pwa-install-completed'));
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('[PWA] Notifications not supported');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

/**
 * Request persistent storage (modern API)
 */
export async function requestPersistentStorage() {
  if (!('storage' in navigator) || !('persist' in navigator.storage)) {
    console.log('[PWA] Persistent storage not supported');
    return false;
  }

  try {
    // Check if already granted
    const isPersisted = await navigator.storage.persisted();
    if (isPersisted) {
      console.log('[PWA] Persistent storage already granted');
      return true;
    }

    // Request persistent storage
    const granted = await navigator.storage.persist();
    if (granted) {
      console.log('[PWA] Persistent storage granted');
    } else {
      console.log('[PWA] Persistent storage denied');
    }
    return granted;
  } catch (error) {
    console.error('[PWA] Persistent storage request failed:', error);
    return false;
  }
}

/**
 * Get storage estimate
 */
export async function getStorageEstimate() {
  if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
    console.log('[PWA] Storage estimate not supported');
    return null;
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const percentUsed = quota > 0 ? (usage / quota * 100).toFixed(2) : 0;

    console.log('[PWA] Storage:', {
      usage: `${(usage / 1024 / 1024).toFixed(2)} MB`,
      quota: `${(quota / 1024 / 1024).toFixed(2)} MB`,
      percentUsed: `${percentUsed}%`
    });

    return { usage, quota, percentUsed };
  } catch (error) {
    console.error('[PWA] Storage estimate failed:', error);
    return null;
  }
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('[PWA] Push notifications not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        // Replace with your VAPID public key
        'YOUR_VAPID_PUBLIC_KEY'
      )
    });

    console.log('[PWA] Push subscription successful');
    return subscription;
  } catch (error) {
    console.error('[PWA] Push subscription failed:', error);
    return null;
  }
}

/**
 * Helper function to convert VAPID key
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

