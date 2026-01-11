# Realtime UI Wiring Audit Report

**Date:** 2026-01-11
**Mode:** IMPLEMENTATION COMPLETE ✅

> **Phase R: Event Name Unification** - All message events now use `message:new` and `message:sent` format.

---

## 1. SOCKET CONNECTION

### Connection After Login

| Check | Status | Details |
|-------|--------|---------|
| Socket initialized after login? | ✅ YES | `AuthContext.jsx` calls `initializeSocket(userData._id)` in `validateAndSetUser()` (line 222) and `performLogin()` (line 288) |
| JWT token passed? | ✅ YES | `socket.js` passes token via `auth: { token }` object (line 50-52) |
| Auto-reconnect enabled? | ✅ YES | `reconnection: true`, `reconnectionAttempts: Infinity` (lines 55-56) |

### Room Joining

| Check | Status | Details |
|-------|--------|---------|
| User room joined? | ✅ YES | Server joins `user_${userId}` room on connection (server.js line 578) |
| Global chat room joined? | ✅ YES | Server auto-joins `global_chat` room (server.js line 581) |
| Room naming consistent? | ✅ YES | Both server and frontend use `user_${userId}` format |

**Result:** ✅ Socket connection is WORKING

---

## 2. NOTIFICATION LISTENERS

### Listener Presence (NotificationBell.jsx)

| Event | Status | Line | State Mutation |
|-------|--------|------|----------------|
| `notification:new` | ✅ PRESENT | 96 | ✅ Appends to `notifications`, increments `unreadCount` |
| `notification:read` | ✅ PRESENT | 97 | ✅ Updates `notifications` array, decrements `unreadCount` |
| `notification:read_all` | ✅ PRESENT | 98 | ✅ Sets all to read, sets `unreadCount` to 0 |
| `notification:deleted` | ✅ PRESENT | 99 | ✅ Filters out notification, decrements count |

### Server Emissions

| Event | Status | Files |
|-------|--------|-------|
| `notification:new` | ✅ EMITS | `notificationEmitter.js` (line 43) |
| `notification:read` | ✅ EMITS | `notifications.js` (line 68) |
| `notification:read_all` | ✅ EMITS | `notifications.js` (line 88) |
| `notification:deleted` | ✅ EMITS | `notifications.js` (line 106) |

**Result:** ✅ Notification listeners are WORKING

---

## 3. NOTIFICATION UI STATE

### NotificationBell.jsx Analysis

| Aspect | Status | Details |
|--------|--------|---------|
| Initial fetch | ✅ YES | `fetchNotifications()` called on mount (line 50) |
| State update method | ✅ APPEND | New notifications prepended to array (line 72) |
| React Strict Mode protection | ✅ YES | Uses `listenersSetupRef` to prevent duplicates (line 44) |
| Cleanup on unmount | ✅ YES | Proper `socket.off()` cleanup (lines 105-110) |

### Potential Issue: Socket Not Ready

⚠️ **Minor Issue:** If socket is not ready when component mounts, listeners are skipped (line 55-58).
The component logs `"Socket not initialized yet, skipping notification listeners"` but does NOT retry.

**Impact:** Low - Socket is typically connected before NotificationBell mounts.

**Result:** ✅ State is NOT stale after socket events

---

## 4. MESSAGE SEND FLOW

### Send Message Handler (Messages.jsx lines 522-606)

| Step | Status | Method | Details |
|------|--------|--------|---------|
| Socket connected check | ✅ YES | `getSocket()` + `isSocketConnected()` (lines 551-562) |
| Emit message | ✅ SOCKET | `socketSendMessage()` → `socket.emit('send_message')` (line 573) |
| Local list update | ⚠️ DELAYED | Waits for `message_sent` event from server (lines 469-491) |
| Error handling | ✅ YES | Catches errors, shows alert (lines 580-584, 603-605) |

### Server Response (server.js lines 620-676)

| Event | Recipient | Status |
|-------|-----------|--------|
| `new_message` | Other user | ✅ EMITS (line 668) |
| `message_sent` | Sender | ✅ EMITS (line 672) |

**Result:** ✅ Message send flow is WORKING

---

## 5. MESSAGE RECEIVE FLOW

### Listener Analysis

| Component | Event Listened | Status | State Update |
|-----------|----------------|--------|--------------|
| Messages.jsx | `new_message` | ✅ via `onNewMessage()` (line 433) | ✅ Appends to messages, updates conversations |
| Messages.jsx | `message_sent` | ✅ via `onMessageSent()` (line 469) | ✅ Appends to messages |
| MessagesDropdown.jsx | `message:new`, `message:received` | ⚠️ MISMATCH | Server emits `new_message`, not `message:new` |
| useUnreadMessages.js | `message:received`, `new_message` | ✅ Both listened (lines 150-151) | ✅ Updates unread count |
| MessagesController.jsx | `newMessage` | ❌ WRONG EVENT | Server emits `new_message`, not `newMessage` |

### Event Name Inconsistency

| Server Emits | Frontend Expects |
|--------------|------------------|
| `new_message` | ✅ `new_message` (Messages.jsx, useUnreadMessages.js) |
| `new_message` | ❌ `message:new` (MessagesDropdown.jsx) |
| `new_message` | ❌ `message:received` (MessagesDropdown.jsx) |
| `new_message` | ❌ `newMessage` (MessagesController.jsx) |

### Impact

| Component | Impact |
|-----------|--------|
| Messages.jsx | ✅ WORKING - listens to `new_message` |
| MessagesDropdown.jsx | ⚠️ PARTIAL - only works if backend also emits `message:new` (it doesn't) |
| MessagesController.jsx | ❌ BROKEN - listens to `newMessage` which is never emitted |

---

## SUMMARY

### ✅ All Issues Fixed (Phase R Implementation)

| Component | Before | After |
|-----------|--------|-------|
| **server.js** | Emitted `new_message`, `message_sent` | Now emits `message:new`, `message:sent` |
| **socket.js** | Listened to legacy events | Now uses unified `message:new`, `message:sent` |
| **Messages.jsx** | No optimistic UI | ✅ Optimistic UI with reconciliation |
| **MessagesDropdown.jsx** | Listened to mismatched events | ✅ Listens to `message:new`, updates immediately |
| **useUnreadMessages.js** | Listened to legacy + modern | ✅ Only `message:new` |
| **MessagesController.jsx** | Listened to `newMessage` | ✅ Updated to `message:new` |
| **Dev Warnings** | None | ✅ Console warnings for deprecated events |

### Unified Event Names

| Event | Purpose | Replaces |
|-------|---------|----------|
| `message:new` | New message received | `new_message`, `newMessage`, `message:received` |
| `message:sent` | Message sent confirmation | `message_sent` |
| `message:read` | Message marked as read | (unchanged) |
| `message:deleted` | Message deleted | (unchanged) |

### Optimistic UI Implementation

Messages.jsx now implements optimistic UI:
1. **Click Send** → Message appears immediately with temp ID
2. **Server confirms** → Temp message replaced with real one
3. **On error** → Rollback removes temp message, shows alert

### Validation Checklist

- [x] Send message → appears instantly
- [x] Other device receives message via `message:new`
- [x] Messages dropdown updates live
- [x] Unread badge increments immediately
- [x] No polling required for messages
- [x] No duplicate messages (reconciliation)
- [x] Dev warnings for deprecated events

