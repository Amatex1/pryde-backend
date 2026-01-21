# 🔌 Pryde Socket.IO & Messaging System Overview

> Last Updated: 2025-01-14

---

## 📊 TABLE OF CONTENTS

1. [System Architecture](#system-architecture)
2. [Database Models](#database-models)
3. [Socket.IO Connection Flow](#socketio-connection-flow)
4. [Socket Events Reference](#socket-events-reference)
5. [REST API Endpoints](#rest-api-endpoints)
6. [Message Flow](#message-flow)
7. [Notification System](#notification-system)
8. [Current Performance Metrics](#current-performance-metrics)
9. [Optimizations Implemented](#optimizations-implemented)
10. [Known Issues & Recent Fixes](#known-issues--recent-fixes)

---

## 🏗️ SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Vercel)                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │  Messages.jsx   │  │ NotificationBell│  │  Global Chat (Lounge)   │  │
│  │  - DM UI        │  │  - Bell icon    │  │  - Real-time chat       │  │
│  │  - Optimistic UI│  │  - Social notifs│  │  - @mentions            │  │
│  └────────┬────────┘  └────────┬────────┘  └────────────┬────────────┘  │
│           │                    │                         │               │
│  ┌────────▼────────────────────▼─────────────────────────▼────────────┐ │
│  │                     socket.js (Frontend Socket Manager)             │ │
│  │  - WebSocket ONLY (no polling fallback)                             │ │
│  │  - JWT auth via auth.token                                          │ │
│  │  - Auto-reconnect (10 attempts, 1-5s backoff)                       │ │
│  │  - bfcache compatible (pagehide/pageshow)                           │ │
│  └─────────────────────────────┬───────────────────────────────────────┘ │
└────────────────────────────────┼─────────────────────────────────────────┘
                                 │ WebSocket (wss://)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (Render)                               │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                     server.js (Socket.IO Server)                     ││
│  │  - JWT verification with 10s timeout                                 ││
│  │  - Connection state recovery enabled                                 ││
│  │  - User rooms: user_${userId}                                        ││
│  │  - Global chat room: global_chat                                     ││
│  │  - Online users tracking: Map<userId, socketId>                      ││
│  └───────────────────────────────┬─────────────────────────────────────┘│
│                                  │                                       │
│  ┌──────────────────┐  ┌─────────▼─────────┐  ┌────────────────────────┐│
│  │  routes/messages │  │   MongoDB Atlas   │  │ routes/notifications   ││
│  │  REST API        │◄─►  - Messages       │◄─►  REST API              ││
│  │                  │  │  - Notifications  │  │                        ││
│  └──────────────────┘  │  - Users          │  └────────────────────────┘│
│                        └───────────────────┘                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ DATABASE MODELS

### Message Model (`server/models/Message.js`)

```javascript
{
  sender: ObjectId (ref: 'User', required),
  recipient: ObjectId (ref: 'User'),           // For DMs
  groupChat: ObjectId (ref: 'GroupChat'),      // For group chats
  content: String (encrypted at rest),
  attachment: String (URL),
  read: Boolean (default: false),
  readBy: [{ user: ObjectId, readAt: Date }],  // For group messages
  deliveredTo: [{ user: ObjectId, deliveredAt: Date }],
  edited: Boolean,
  editedAt: Date,
  isDeletedForAll: Boolean,
  deletedForAll: { by: ObjectId, at: Date },
  deletedFor: [{ user: ObjectId, deletedAt: Date }],
  createdAt: Date
}

// Features:
// ✅ Automatic encryption on save (AES-256-GCM)
// ✅ Automatic decryption on toJSON()
// ✅ Soft delete support (deleteForAll vs deleteForSelf)
// ✅ Read receipts tracking
```

### Notification Model (`server/models/Notification.js`)

```javascript
{
  recipient: ObjectId (ref: 'User', required),
  sender: ObjectId (ref: 'User', required),
  type: String (enum: see notificationTypes.js),
  message: String (required),
  read: Boolean (default: false),
  link: String,
  postId: ObjectId (ref: 'Post'),
  commentId: ObjectId,
  groupId: ObjectId (ref: 'Group'),
  groupSlug: String,
  groupName: String,
  circleId: ObjectId (ref: 'Circle'),
  circleName: String,
  loginApprovalId: ObjectId (ref: 'LoginApproval'),
  loginApprovalData: { verificationCode, deviceInfo, browser, os, ipAddress, location },
  metadata: Mixed,
  createdAt: Date,
  updatedAt: Date
}
```

### Notification Types (`server/constants/notificationTypes.js`)

**SOCIAL Types (Bell Icon):**
- `like` - Reaction on post
- `comment` - Comment/reply on post
- `mention` - @mention in post/comment
- `group_mention` - @mention in group
- `group_post` - New post in joined group
- `system` - System notice
- `moderation` - Moderation result
- `resonance` - Resonance signal
- `circle_invite` - Circle invitation
- `circle_post` - New post in circle
- `login_approval` - Login approval request

**MESSAGE Types (Messages Badge):**
- `message` - Direct message

**FORBIDDEN Types (Never created):**
- `follow`, `profile_view`, `bookmark`, `group_join`
- `trending`, `suggested_content`, `activity_summary`
- `milestone`, `reminder`

---

## 🔌 SOCKET.IO CONNECTION FLOW

### Frontend Connection (`src/utils/socket.js`)

```javascript
// 1. Initialize socket with JWT auth
const socket = io(BACKEND_URL, {
  auth: { token: jwtToken },
  transports: ['websocket'],  // WebSocket ONLY - no polling
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  forceNew: true,
  autoConnect: true
});

// 2. On connect, server auto-joins user to room: user_${userId}
// 3. On reconnect, frontend re-emits 'join' event for state refresh
```

### Backend Authentication (`server/server.js`)

```javascript
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;

  // 10-second timeout for auth
  const authPromise = jwt.verify(token, JWT_SECRET);
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), 10000)
  );

  const decoded = await Promise.race([authPromise, timeoutPromise]);
  socket.userId = decoded.userId;
  next();
});

// On connection:
// 1. Add to onlineUsers Map: userId → socketId
// 2. Join user room: socket.join(`user_${userId}`)
// 3. Emit presence:update to all users
```

---

## 📡 SOCKET EVENTS REFERENCE

### Message Events (Phase R Unified)

| Event | Direction | Description |
|-------|-----------|-------------|
| `send_message` | Client → Server | Send a DM |
| `message:new` | Server → Client | New message received (to recipient) |
| `message:sent` | Server → Client | Message sent confirmation (to sender) |
| `message:deleted` | Server → Client | Message was deleted |
| `message:edited` | Server → Client | Message was edited |
| `message:read` | Server → Client | Message was read |
| `message:error` | Server → Client | Error sending message |

### Global Chat (Lounge) Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `global_chat:join` | Client → Server | Join global chat room |
| `global_chat:typing` | Client → Server | Typing indicator |
| `global_message:send` | Client → Server | Send global message |
| `global_message:new` | Server → Client | New global message |
| `global_chat:online_count` | Server → Client | Online user count |
| `global_chat:user_typing` | Server → Client | User typing status |
| `global_chat:online_users_list` | Server → Client | List of online users (admin only) |

### Notification Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `notification:new` | Server → Client | New notification created |
| `notification:read` | Server → Client | Notification marked read |
| `notification:read_all` | Server → Client | All notifications marked read |
| `notification:deleted` | Server → Client | Notification deleted |

### Presence Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `presence:update` | Server → Client | User online/offline status |
| `user_online` | Server → Client | Legacy: User came online |
| `user_offline` | Server → Client | Legacy: User went offline |
| `typing` | Bidirectional | DM typing indicator |

### Friend Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `friend_request_sent` | Client → Server | Friend request sent |
| `friend_request_received` | Server → Client | Friend request received |
| `friend_request_accepted` | Bidirectional | Friend request accepted |

---

## 🌐 REST API ENDPOINTS

### Messages API (`/api/messages`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/conversations` | Get all conversations |
| GET | `/:userId` | Get messages with specific user |
| POST | `/` | Send a message (REST fallback) |
| PUT | `/:messageId/read` | Mark message as read |
| DELETE | `/:messageId` | Delete message |
| PUT | `/:messageId` | Edit message |

### Notifications API (`/api/notifications`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get all notifications |
| GET | `/unread-count` | Get unread count |
| PUT | `/:id/read` | Mark notification as read |
| PUT | `/read-all` | Mark all as read |
| DELETE | `/:id` | Delete notification |

---

## 📨 MESSAGE FLOW

### Sending a Direct Message

```
1. User types message in Messages.jsx
2. Frontend creates optimistic message with _tempId
3. Frontend emits 'send_message' via socket.js
4. Backend receives in server.js socket handler:
   a. Validates sender/recipient
   b. Sanitizes content (DOMPurify)
   c. Creates Message document (encrypted)
   d. Saves with idempotency check (prevents duplicates)
   e. Populates sender/recipient info
   f. Emits 'message:new' to recipient's socket + user room
   g. Emits 'message:sent' to sender (includes _tempId for reconciliation)
   h. Creates notification (with deduplication)
   i. Sends push notification (fire-and-forget)
5. Frontend receives 'message:sent', reconciles with _tempId
6. Recipient receives 'message:new', adds to conversation
```

### Message Deduplication

```javascript
// server/utils/messageDeduplication.js
// Uses Redis-like in-memory cache with 5-minute TTL
// Key: hash(senderId + recipientId + content + timestamp_bucket)
// Prevents duplicate messages from network retries
```

---

## 🔔 NOTIFICATION SYSTEM

### Notification Flow

```
1. Action triggers notification (like, comment, message, etc.)
2. Backend creates Notification document
3. notificationEmitter.js emits 'notification:new' to user room
4. Frontend NotificationBell receives event
5. Updates badge count and notification list
```

### Notification Emitter (`server/utils/notificationEmitter.js`)

```javascript
// Centralized notification emission
emitNotificationCreated(io, recipientId, notification)
emitNotificationRead(io, recipientId, notificationId)
emitNotificationDeleted(io, recipientId, notificationId)
emitAllNotificationsRead(io, recipientId)
```

---

## ⚡ CURRENT PERFORMANCE METRICS

Based on server logs, typical message handling times:

| Operation | Typical Time |
|-----------|--------------|
| Message save | 50-150ms |
| Message populate | 20-50ms |
| Socket emit | 1-5ms |
| Notification creation | 30-80ms |
| **Total message handling** | **100-300ms** |

### Global Chat Performance

| Operation | Typical Time |
|-----------|--------------|
| User check | 10-30ms |
| Model import | 1-5ms |
| Instant broadcast | 1-3ms |
| Background save | 50-100ms |

---

## 🚀 OPTIMIZATIONS IMPLEMENTED

### Socket.IO Optimizations

1. **WebSocket-only transport** - No polling fallback for lower latency
2. **Connection state recovery** - Maintains state across reconnects
3. **User rooms** - Efficient targeting with `user_${userId}` rooms
4. **Validated emits** - `emitValidated()` wrapper for consistent event emission

### Message Optimizations

1. **Optimistic UI** - Messages appear instantly with `_tempId`
2. **Idempotent creation** - Prevents duplicate messages from retries
3. **Parallel operations** - Save and populate run concurrently
4. **Fire-and-forget notifications** - Don't block message confirmation

### Global Chat Optimizations

1. **Instant broadcast** - Emit BEFORE database save
2. **Background save** - Database write doesn't block response
3. **User cache** - 5-minute TTL cache for online users list
4. **Periodic cleanup** - Stale cache entries cleaned every 10 minutes

---

## 🐛 KNOWN ISSUES & RECENT FIXES

### Recent Fixes

1. **Phase R Event Unification** - Consolidated message events to `message:new` and `message:sent`
2. **Duplicate message prevention** - Added idempotency layer
3. **Duplicate notification prevention** - Added notification deduplication
4. **bfcache compatibility** - Using pagehide/pageshow instead of beforeunload
5. **Logout socket cleanup** - Proper disconnection on logout

### Current Considerations

1. **WebSocket-only** - May fail on restrictive networks (no polling fallback)
2. **10-second auth timeout** - May be too short for slow connections
3. **In-memory deduplication** - Lost on server restart (consider Redis)
4. **No message queue** - Failed saves are logged but not retried

---

## 📁 KEY FILES

### Backend
- `server/server.js` - Socket.IO server, all socket handlers
- `server/models/Message.js` - Message model with encryption
- `server/models/Notification.js` - Notification model
- `server/routes/messages.js` - REST API for messages
- `server/routes/notifications.js` - REST API for notifications
- `server/utils/notificationEmitter.js` - Centralized notification emission
- `server/utils/messageDeduplication.js` - Message deduplication
- `server/utils/notificationDeduplication.js` - Notification deduplication
- `server/constants/notificationTypes.js` - Notification type definitions

### Frontend
- `src/utils/socket.js` - Socket.IO client, all socket functions
- `src/constants/socketEvents.js` - Socket event constants
- `src/pages/Messages.jsx` - DM interface
- `src/components/NotificationBell.jsx` - Notification UI
- `src/pages/Lounge.jsx` - Global chat interface

