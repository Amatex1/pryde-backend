# Realtime Event Contract

**Version:** 1.0  
**Last Updated:** 2026-01-11  
**Status:** CANONICAL

> ⚠️ **All new realtime features MUST extend this document.**  
> Event names are FINAL. No aliases. No camelCase. No snake_case.

---

## Event Naming Rules

1. **Format:** `entity:action` (e.g., `message:new`)
2. **No aliases** - Each event has exactly ONE name
3. **No legacy support** - Deprecated events are removed, not maintained
4. **Lowercase only** - No camelCase, no UPPER_CASE
5. **Colons for namespacing** - `message:new` not `message_new`

---

## Direct Messages

### `message:new`

| Field | Value |
|-------|-------|
| **Purpose** | New direct message created |
| **Emitted by** | Backend (Socket.IO) |
| **Delivered to** | `user_${recipientId}` room |

**Payload:**
```json
{
  "_id": "string",
  "sender": { "_id": "string", "name": "string", "profileImage": "string" },
  "recipient": "string",
  "content": "string",
  "createdAt": "ISODate"
}
```

### `message:sent`

| Field | Value |
|-------|-------|
| **Purpose** | Confirmation that message was saved |
| **Emitted by** | Backend (Socket.IO) |
| **Delivered to** | Sender socket + `user_${senderId}` room |

**Payload:** Same as `message:new`

### `message:read`

| Field | Value |
|-------|-------|
| **Purpose** | Message(s) marked as read |
| **Emitted by** | Backend (Socket.IO) |
| **Delivered to** | `user_${senderId}` room |

**Payload:**
```json
{
  "messageIds": ["string"],
  "readBy": "string",
  "readAt": "ISODate"
}
```

### `message:deleted`

| Field | Value |
|-------|-------|
| **Purpose** | Message deleted |
| **Emitted by** | Backend (Socket.IO) |
| **Delivered to** | Conversation participants |

**Payload:**
```json
{
  "_id": "string",
  "deletedFor": "all" | "self",
  "deletedBy": "string"
}
```

---

## Notifications

### `notification:new`

| Field | Value |
|-------|-------|
| **Purpose** | New social notification created |
| **Emitted by** | Backend (Socket.IO) |
| **Delivered to** | `user_${userId}` room |

**Payload:**
```json
{
  "_id": "string",
  "type": "NotificationType",
  "sourceUser": { "_id": "string", "name": "string", "profileImage": "string" },
  "sourceEntity": "string",
  "message": "string",
  "createdAt": "ISODate"
}
```

### `notification:read`

| Field | Value |
|-------|-------|
| **Purpose** | Single notification marked as read |
| **Delivered to** | `user_${userId}` room |

**Payload:**
```json
{
  "_id": "string",
  "readAt": "ISODate"
}
```

### `notification:read_all`

| Field | Value |
|-------|-------|
| **Purpose** | All notifications marked as read |
| **Delivered to** | `user_${userId}` room |

**Payload:**
```json
{
  "userId": "string",
  "readAt": "ISODate"
}
```

### `notification:deleted`

| Field | Value |
|-------|-------|
| **Purpose** | Notification deleted |
| **Delivered to** | `user_${userId}` room |

**Payload:**
```json
{
  "_id": "string"
}
```

---

## Global Chat (Lounge)

### `global_message:new`

| Field | Value |
|-------|-------|
| **Purpose** | New message in global chat |
| **Delivered to** | `global_chat` room |

**Payload:**
```json
{
  "_id": "string",
  "text": "string",
  "user": { "_id": "string", "name": "string", "profileImage": "string" },
  "createdAt": "ISODate"
}
```

---

## Presence

### `presence:update`

| Field | Value |
|-------|-------|
| **Purpose** | User online/offline status changed |
| **Delivered to** | All connected clients |

**Payload:**
```json
{
  "userId": "string",
  "online": "boolean"
}
```

---

## Allowed Events (Canonical List)

```javascript
const ALLOWED_EVENTS = [
  // Messages
  'message:new',
  'message:sent',
  'message:read',
  'message:deleted',
  
  // Notifications
  'notification:new',
  'notification:read',
  'notification:read_all',
  'notification:deleted',
  
  // Global Chat
  'global_message:new',
  'global_chat:online_count',
  'global_chat:user_typing',
  
  // Presence
  'presence:update',
  
  // Typing
  'user_typing'
];
```

---

## Deprecated Events (DO NOT USE)

| Deprecated | Replacement |
|------------|-------------|
| `new_message` | `message:new` |
| `newMessage` | `message:new` |
| `message_sent` | `message:sent` |
| `message:received` | `message:new` |
| `user_online` | `presence:update` |
| `user_offline` | `presence:update` |
| `notification:created` | `notification:new` |

---

## Adding New Events

1. Add to this document FIRST
2. Add to `ALLOWED_EVENTS` in `emitValidated.js`
3. Add to frontend `socketEvents.js`
4. Implement backend emit
5. Implement frontend listener
6. Test across multiple devices/tabs

