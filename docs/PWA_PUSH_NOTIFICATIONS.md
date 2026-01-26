# PWA Push Notification Setup — PRYDE Social

## Overview

PRYDE uses the **Web Push API** with **VAPID (Voluntary Application Server Identification)** for secure push notifications. The implementation is minimal and focused — the service worker only handles push notifications (no caching, no fetch interception).

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │     │   Push Service  │     │   Backend       │
│   (Browser)     │     │   (FCM/Mozilla) │     │   (Express)     │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │ 1. Request permission │                       │
         │ ──────────────────────>                       │
         │                       │                       │
         │ 2. Get VAPID key      │                       │
         │ ─────────────────────────────────────────────>│
         │                       │                       │
         │ 3. Subscribe to push  │                       │
         │ ──────────────────────>                       │
         │                       │                       │
         │ 4. Send subscription  │                       │
         │ ─────────────────────────────────────────────>│
         │                       │                       │
         │                       │ 5. Send notification  │
         │                       │ <─────────────────────│
         │                       │                       │
         │ 6. Receive push       │                       │
         │ <─────────────────────│                       │
         │                       │                       │
         │ 7. Show notification  │                       │
         │ ──────────────────────>                       │
```

## Environment Variables

### Backend (`server/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VAPID_PUBLIC_KEY` | ✅ Production | Public key for push subscription |
| `VAPID_PRIVATE_KEY` | ✅ Production | Private key for signing push messages |

### Frontend (`pryde-frontend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_VAPID_PUBLIC_KEY` | ✅ | Public key (same as backend) |

## Generating VAPID Keys

Run this command once to generate a key pair:

```bash
npx web-push generate-vapid-keys
```

**Important:**
- The **public key** goes in both frontend and backend
- The **private key** goes in backend only (never expose it!)
- Generate keys **once** and reuse them — changing keys invalidates all existing subscriptions

## File Structure

### Backend

| File | Purpose |
|------|---------|
| `server/routes/pushNotifications.js` | API endpoints for push |
| `server/models/User.js` | Stores `pushSubscription` per user |

### Frontend

| File | Purpose |
|------|---------|
| `public/sw.js` | Service worker (push-only, no caching) |
| `src/utils/pushNotifications.js` | Subscribe/unsubscribe utilities |
| `src/utils/pwa.js` | PWA utilities including push subscription |
| `src/main.jsx` | Service worker registration |

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/push/vapid-public-key` | ❌ | Get VAPID public key |
| `POST` | `/api/push/subscribe` | ✅ | Save push subscription |
| `POST` | `/api/push/unsubscribe` | ✅ | Remove push subscription |
| `GET` | `/api/push/status` | ✅ | Check subscription status |
| `POST` | `/api/push/test` | ✅ | Send test notification |

## Service Worker (`public/sw.js`)

The service worker is **minimal by design**:

```javascript
// ✅ Handles push events
self.addEventListener('push', (event) => { ... });

// ✅ Handles notification clicks
self.addEventListener('notificationclick', (event) => { ... });

// ❌ NO fetch handler — prevents stale content issues
// ❌ NO caching — browser handles all caching
// ❌ NO precache — no ERR_FAILED errors
```

## Sending Push Notifications (Backend)

```javascript
import { sendPushNotification } from './routes/pushNotifications.js';

await sendPushNotification(userId, {
  title: '💬 New Message',
  body: 'You have a new message from John',
  data: {
    type: 'message',
    url: '/messages'
  }
});
```

**Notification Types:** `message`, `friend_request`, `login_approval`, `security_alert`, `test`

## User Preferences

The backend respects user preferences:

1. **Quiet Mode** — Non-critical notifications are suppressed
2. **Login Alerts** — Can be disabled per-user
3. **Critical Types** — Always delivered: `login_approval`, `security_alert`, `account_warning`

## Testing

```bash
curl -X POST https://pryde-social.onrender.com/api/push/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"testType": "message"}'
```

Test types: `default`, `message`, `friend_request`, `login_approval`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Push notifications not configured" | Set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in backend `.env` |
| Notifications not appearing | Check browser notification permissions |
| Subscription fails | Ensure service worker is registered |
| 410 error on send | Subscription expired — user needs to re-subscribe |
| No notification on mobile | Ensure PWA is installed or browser is open |

## Production Checklist

- [ ] Generate VAPID keys with `npx web-push generate-vapid-keys`
- [ ] Set `VAPID_PUBLIC_KEY` in backend `.env`
- [ ] Set `VAPID_PRIVATE_KEY` in backend `.env`
- [ ] Set `VITE_VAPID_PUBLIC_KEY` in frontend `.env`
- [ ] Deploy backend (Render)
- [ ] Deploy frontend (Vercel)
- [ ] Test with `/api/push/test` endpoint

