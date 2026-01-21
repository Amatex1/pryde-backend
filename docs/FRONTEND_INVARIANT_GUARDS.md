# Frontend Invariant Guards Specification

**Date:** 2026-01-12  
**Objective:** Mirror backend invariants on the frontend to prevent UI state corruption  
**Scope:** DM deduplication, notification deduplication, socket event deduplication

---

## OVERVIEW

Frontend invariant guards ensure that the UI cannot violate backend invariants, even under race conditions, socket reconnects, or rapid user interactions.

### Key Principles
1. **Deduplicate at render** - Prevent duplicate messages/notifications in UI
2. **Validate before increment** - Prevent count overflow
3. **Guard against race conditions** - Handle concurrent updates safely
4. **Log violations in dev** - Make issues visible during development
5. **Fail gracefully in prod** - Never crash, always recover

---

## INVARIANT 1: DM MESSAGE DEDUPLICATION

### Problem
- Socket reconnects can cause duplicate message events
- Race conditions between optimistic updates and server responses
- Multiple tabs can receive the same message event

### Solution: Client-Side Message Fingerprinting

```javascript
// utils/messageDeduplication.js

class MessageDeduplicationGuard {
  constructor() {
    this.seenMessages = new Map(); // messageId -> timestamp
    this.maxCacheSize = 1000;
    this.cacheExpiryMs = 5 * 60 * 1000; // 5 minutes
  }
  
  /**
   * Check if message has been seen before
   * @param {string} messageId - Message ID from server
   * @returns {boolean} - True if duplicate, false if new
   */
  isDuplicate(messageId) {
    if (!messageId) {
      console.warn('[MessageDedup] No messageId provided');
      return false;
    }
    
    const now = Date.now();
    const lastSeen = this.seenMessages.get(messageId);
    
    if (lastSeen) {
      const age = now - lastSeen;
      if (age < this.cacheExpiryMs) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[MessageDedup] Duplicate message blocked: ${messageId}`);
        }
        return true;
      }
    }
    
    // Register message
    this.seenMessages.set(messageId, now);
    
    // Cleanup old entries
    if (this.seenMessages.size > this.maxCacheSize) {
      this.cleanup(now);
    }
    
    return false;
  }
  
  /**
   * Remove expired entries
   */
  cleanup(now) {
    const expiredIds = [];
    
    for (const [messageId, timestamp] of this.seenMessages.entries()) {
      if (now - timestamp > this.cacheExpiryMs) {
        expiredIds.push(messageId);
      }
    }
    
    expiredIds.forEach(id => this.seenMessages.delete(id));
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[MessageDedup] Cleaned up ${expiredIds.length} expired entries`);
    }
  }
  
  /**
   * Clear all cached messages
   */
  clear() {
    this.seenMessages.clear();
  }
}

// Singleton instance
export const messageDedup = new MessageDeduplicationGuard();
```

### Usage in React Component

```javascript
import { messageDedup } from '../utils/messageDeduplication';

// In socket event handler
socket.on('message:new', (message) => {
  // Guard against duplicates
  if (messageDedup.isDuplicate(message._id)) {
    return; // Silently ignore duplicate
  }
  
  // Add to state
  setMessages(prev => [...prev, message]);
});
```

---

## INVARIANT 2: NOTIFICATION DEDUPLICATION

### Problem
- Multiple socket events for the same notification
- Notification count increments multiple times
- UI shows duplicate notifications

### Solution: Notification ID Tracking

```javascript
// utils/notificationDeduplication.js

class NotificationDeduplicationGuard {
  constructor() {
    this.seenNotifications = new Set();
    this.maxCacheSize = 500;
  }
  
  /**
   * Check if notification has been seen
   * @param {string} notificationId - Notification ID
   * @returns {boolean} - True if duplicate, false if new
   */
  isDuplicate(notificationId) {
    if (!notificationId) {
      console.warn('[NotificationDedup] No notificationId provided');
      return false;
    }
    
    if (this.seenNotifications.has(notificationId)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[NotificationDedup] Duplicate notification blocked: ${notificationId}`);
      }
      return true;
    }
    
    // Register notification
    this.seenNotifications.add(notificationId);
    
    // Prevent unbounded growth
    if (this.seenNotifications.size > this.maxCacheSize) {
      this.cleanup();
    }
    
    return false;
  }
  
  /**
   * Remove oldest entries (FIFO)
   */
  cleanup() {
    const entries = Array.from(this.seenNotifications);
    const toRemove = entries.slice(0, 100); // Remove oldest 100
    toRemove.forEach(id => this.seenNotifications.delete(id));
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[NotificationDedup] Cleaned up ${toRemove.length} entries`);
    }
  }
  
  /**
   * Clear all cached notifications
   */
  clear() {
    this.seenNotifications.clear();
  }
}

// Singleton instance
export const notificationDedup = new NotificationDeduplicationGuard();
```

### Usage in React Component

```javascript
import { notificationDedup } from '../utils/notificationDeduplication';

// In socket event handler
socket.on('notification:new', (notification) => {
  // Guard against duplicates
  if (notificationDedup.isDuplicate(notification._id)) {
    return; // Silently ignore duplicate
  }
  
  // Increment count safely
  setUnreadCount(prev => Math.min(prev + 1, 99)); // Clamp to 99
  
  // Add to notifications list
  setNotifications(prev => [notification, ...prev]);
});
```

---

## INVARIANT 3: SOCKET EVENT DEDUPLICATION

### Problem
- Socket reconnects replay recent events
- Multiple tabs receive the same events
- Event handlers fire multiple times

### Solution: Event Fingerprinting

```javascript
// utils/socketEventDeduplication.js

class SocketEventDeduplicationGuard {
  constructor() {
    this.seenEvents = new Map(); // fingerprint -> timestamp
    this.windowMs = 5000; // 5 second dedup window
  }
  
  /**
   * Generate event fingerprint
   * @param {string} eventName - Socket event name
   * @param {object} data - Event data
   * @returns {string} - Fingerprint
   */
  generateFingerprint(eventName, data) {
    const key = `${eventName}:${JSON.stringify(data)}`;
    return key;
  }
  
  /**
   * Check if event has been seen recently
   * @param {string} eventName - Socket event name
   * @param {object} data - Event data
   * @returns {boolean} - True if duplicate, false if new
   */
  isDuplicate(eventName, data) {
    const fingerprint = this.generateFingerprint(eventName, data);
    const now = Date.now();
    const lastSeen = this.seenEvents.get(fingerprint);
    
    if (lastSeen && (now - lastSeen) < this.windowMs) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[SocketEventDedup] Duplicate event blocked: ${eventName}`);
      }
      return true;
    }
    
    // Register event
    this.seenEvents.set(fingerprint, now);
    
    // Cleanup old entries
    this.cleanup(now);
    
    return false;
  }
  
  /**
   * Remove expired entries
   */
  cleanup(now) {
    for (const [fingerprint, timestamp] of this.seenEvents.entries()) {
      if (now - timestamp > this.windowMs) {
        this.seenEvents.delete(fingerprint);
      }
    }
  }
}

// Singleton instance
export const socketEventDedup = new SocketEventDeduplicationGuard();
```

### Usage in Socket Setup

```javascript
import { socketEventDedup } from '../utils/socketEventDedup';

// Wrap all socket event handlers
socket.on('message:new', (data) => {
  if (socketEventDedup.isDuplicate('message:new', data)) {
    return;
  }
  handleNewMessage(data);
});

socket.on('notification:new', (data) => {
  if (socketEventDedup.isDuplicate('notification:new', data)) {
    return;
  }
  handleNewNotification(data);
});
```

---

## INVARIANT 4: UNREAD COUNT CLAMPING

### Problem
- Counts can overflow due to race conditions
- Negative counts from concurrent decrements
- UI shows incorrect badge numbers

### Solution: Safe Count Updates

```javascript
// utils/safeCounters.js

/**
 * Safely increment a count with upper bound
 * @param {number} current - Current count
 * @param {number} increment - Amount to add
 * @param {number} max - Maximum allowed value
 * @returns {number} - New count (clamped)
 */
export function safeIncrement(current, increment = 1, max = 99) {
  const newValue = current + increment;
  return Math.min(Math.max(newValue, 0), max);
}

/**
 * Safely decrement a count with lower bound
 * @param {number} current - Current count
 * @param {number} decrement - Amount to subtract
 * @param {number} min - Minimum allowed value
 * @returns {number} - New count (clamped)
 */
export function safeDecrement(current, decrement = 1, min = 0) {
  const newValue = current - decrement;
  return Math.max(newValue, min);
}
```

### Usage in State Updates

```javascript
import { safeIncrement, safeDecrement } from '../utils/safeCounters';

// Increment unread count
setUnreadCount(prev => safeIncrement(prev, 1, 99));

// Decrement unread count
setUnreadCount(prev => safeDecrement(prev, 1, 0));
```

---

## DEVELOPMENT LOGGING

### Invariant Violation Logger

```javascript
// utils/invariantLogger.js

class InvariantLogger {
  constructor() {
    this.violations = [];
    this.enabled = process.env.NODE_ENV === 'development';
  }
  
  log(type, message, data = {}) {
    if (!this.enabled) return;
    
    const violation = {
      type,
      message,
      data,
      timestamp: new Date().toISOString(),
      stack: new Error().stack
    };
    
    this.violations.push(violation);
    
    console.warn(`[Invariant Violation] ${type}: ${message}`, data);
  }
  
  getViolations() {
    return this.violations;
  }
  
  clear() {
    this.violations = [];
  }
}

export const invariantLogger = new InvariantLogger();
```

---

## ACCEPTANCE CRITERIA

✅ **Message Deduplication**
- Duplicate messages blocked at render
- Cache expires after 5 minutes
- No memory leaks

✅ **Notification Deduplication**
- Duplicate notifications blocked
- Count increments only once per notification
- Cache size bounded

✅ **Socket Event Deduplication**
- Duplicate events blocked within 5-second window
- Works across reconnects
- No performance impact

✅ **Count Safety**
- Counts never negative
- Counts never exceed max (99)
- Race conditions handled

✅ **Development Visibility**
- Violations logged in dev mode
- Silent in production
- No PII in logs

---

**Status:** Ready for implementation  
**Next Step:** Create utility files in frontend codebase

