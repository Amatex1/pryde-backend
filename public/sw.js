// Pryde Social Service Worker
const CACHE_NAME = 'pryde-social-v6';
const RUNTIME_CACHE = 'pryde-runtime-v6';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/pryde-logo.png',
  '/manifest.json'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Precaching assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip prefetch requests - let browser handle them
  if (request.headers.get('Purpose') === 'prefetch' ||
      request.headers.get('Sec-Purpose') === 'prefetch') {
    return; // Don't intercept prefetch requests
  }

  // Skip cross-origin requests (let browser handle them normally)
  if (url.origin !== location.origin) {
    return; // Don't intercept cross-origin requests
  }

  // API requests - network only (don't cache)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // For navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful responses (200-299 status codes)
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            }).catch((err) => {
              console.warn('[SW] Failed to cache navigation response:', err);
            });
          } else {
            console.warn('[SW] Navigation request failed:', response.status, request.url);
          }
          return response;
        })
        .catch((error) => {
          console.error('[SW] Navigation fetch failed:', error.message, request.url);
          // Fallback to cache if offline
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              console.log('[SW] Serving cached navigation:', request.url);
              return cachedResponse;
            }
            console.log('[SW] Serving fallback index.html');
            return caches.match('/index.html');
          });
        })
    );
    return;
  }

  // For other requests (CSS, JS, images)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version and update in background
        fetch(request).then((response) => {
          // Only cache successful responses
          if (response.ok) {
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, response);
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }

      // Not in cache, fetch from network
      return fetch(request).then((response) => {
        // Only cache successful responses (200-299 status codes)
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      }).catch((error) => {
        // Network error - return a basic error response instead of caching it
        console.error('[Service Worker] Fetch failed:', error);
        throw error;
      });
    })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync for offline posts (future feature)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-posts') {
    event.waitUntil(syncPosts());
  }
});

async function syncPosts() {
  // Placeholder for syncing offline posts when back online
  console.log('[Service Worker] Syncing offline posts...');
}

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received');

  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    console.error('[Service Worker] Error parsing push data:', error);
    data = {
      title: 'Pryde Social',
      body: 'You have a new notification'
    };
  }

  const title = data.title || 'Pryde Social';
  const options = {
    body: data.body || 'You have a new notification',
    icon: data.icon || '/pryde-logo.png',
    badge: data.badge || '/pryde-logo.png',
    vibrate: data.vibrate || [200, 100, 200],
    data: data.data || { url: '/' },
    tag: data.tag || 'notification',
    requireInteraction: data.requireInteraction || false,
    actions: []
  };

  // Add actions based on notification type
  if (data.data && data.data.type === 'login_approval') {
    options.actions = [
      { action: 'approve', title: '✅ Approve', icon: '/icons/check.png' },
      { action: 'deny', title: '❌ Deny', icon: '/icons/close.png' }
    ];
    options.requireInteraction = true;
  } else if (data.data && data.data.type === 'message') {
    options.actions = [
      { action: 'open', title: '💬 Open', icon: '/icons/message.png' },
      { action: 'close', title: 'Close', icon: '/icons/close.png' }
    ];
  } else {
    options.actions = [
      { action: 'open', title: 'Open' },
      { action: 'close', title: 'Close' }
    ];
  }

  console.log('[Service Worker] Showing notification:', title, options);

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => {
        console.log('[Service Worker] Notification shown successfully');
      })
      .catch((error) => {
        console.error('[Service Worker] Error showing notification:', error);
      })
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event.action);
  event.notification.close();

  const notificationData = event.notification.data || {};
  const url = notificationData.url || '/';

  // Handle login approval actions
  if (event.action === 'approve' && notificationData.type === 'login_approval') {
    event.waitUntil(
      fetch('/api/login-approval/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${notificationData.token || ''}`
        },
        body: JSON.stringify({
          approvalId: notificationData.approvalId
        })
      })
      .then(response => response.json())
      .then(data => {
        console.log('[Service Worker] Login approved:', data);
        // Show success notification
        return self.registration.showNotification('✅ Login Approved', {
          body: 'The login request has been approved',
          icon: '/pryde-logo.png',
          tag: 'login-approved'
        });
      })
      .catch(error => {
        console.error('[Service Worker] Error approving login:', error);
      })
    );
    return;
  }

  if (event.action === 'deny' && notificationData.type === 'login_approval') {
    event.waitUntil(
      fetch('/api/login-approval/deny', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${notificationData.token || ''}`
        },
        body: JSON.stringify({
          approvalId: notificationData.approvalId
        })
      })
      .then(response => response.json())
      .then(data => {
        console.log('[Service Worker] Login denied:', data);
        // Show success notification
        return self.registration.showNotification('❌ Login Denied', {
          body: 'The login request has been denied',
          icon: '/pryde-logo.png',
          tag: 'login-denied'
        });
      })
      .catch(error => {
        console.error('[Service Worker] Error denying login:', error);
      })
    );
    return;
  }

  // Default action - open URL
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Check if there's already a window open
          for (let client of clientList) {
            if (client.url === url && 'focus' in client) {
              return client.focus();
            }
          }
          // Open new window if none found
          if (clients.openWindow) {
            return clients.openWindow(url);
          }
        })
        .catch(error => {
          console.error('[Service Worker] Error opening window:', error);
        })
    );
  }
});

