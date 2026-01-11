# Realtime Edge Case Tests

**Version:** 1.0  
**Last Updated:** 2026-01-11  
**Purpose:** Repeatable sanity checks before releases

> These are manual test steps to verify realtime behavior under edge conditions.  
> Run through these before any major release involving realtime features.

---

## Test Categories

### 1. ✔ Offline → Online

**Steps:**
1. Open Pryde in browser
2. Disconnect network (airplane mode or dev tools → offline)
3. Have another user send you a message
4. Reconnect network
5. Verify: Message appears (may need refresh), unread count updates

**Expected:** Message received after reconnect, socket auto-reconnects

---

### 2. ✔ Network Drop → Reconnect

**Steps:**
1. Have an active chat open
2. Simulate network drop (disable Wi-Fi briefly)
3. Wait 5-10 seconds
4. Re-enable network
5. Send/receive a message

**Expected:** Socket reconnects automatically, no duplicate messages

---

### 3. ✔ Laptop Sleep → Wake

**Steps:**
1. Open Pryde, ensure socket connected
2. Close laptop lid or put to sleep
3. Wait 30+ seconds
4. Wake laptop
5. Check: Is socket reconnected? Send a message.

**Expected:** Socket reconnects within 5-10 seconds of wake, no errors

---

### 4. ✔ Multiple Tabs (Same User)

**Steps:**
1. Open Pryde in Tab 1
2. Open Pryde in Tab 2 (same account)
3. In Tab 1, send a message
4. In Tab 2, receive a message from another user
5. Mark messages as read in Tab 1
6. Check Tab 2 unread count

**Expected:** 
- Both tabs receive socket events
- Read state syncs across tabs (via BroadcastChannel)
- No duplicate notifications

---

### 5. ✔ Browser + PWA Simultaneously

**Steps:**
1. Install Pryde PWA (if available)
2. Open PWA
3. Open Pryde in regular browser tab
4. Send/receive messages on both

**Expected:**
- Both instances receive messages
- Unread counts stay consistent
- No race conditions on read status

---

### 6. ✔ Message Send While Reconnecting

**Steps:**
1. Open a chat
2. Trigger network drop
3. Immediately try to send a message
4. Reconnect network

**Expected:**
- Message shows optimistically (with temp ID)
- After reconnect, message either:
  - Succeeds (temp message replaced with real)
  - Fails (temp message removed, error shown)

---

### 7. ✔ Notification Arrives While App Closed

**Steps:**
1. Close all Pryde tabs/windows
2. Have another user send you a message
3. Open Pryde

**Expected:**
- Unread count reflects new message on initial fetch
- Message appears in conversation list

---

### 8. ✔ Read on One Device Clears Others

**Steps:**
1. Open Pryde on Device A (phone/laptop)
2. Open Pryde on Device B (different device, same account)
3. Receive new message (shows unread on both)
4. Mark as read on Device A
5. Check Device B

**Expected:**
- Device B unread count decrements (may require server sync)
- Cross-device sync via socket rooms works

---

## Status Tracking

| Test | Last Passed | Tester | Notes |
|------|-------------|--------|-------|
| Offline → Online | - | - | |
| Network Drop | - | - | |
| Sleep → Wake | - | - | |
| Multiple Tabs | - | - | |
| Browser + PWA | - | - | |
| Send While Reconnecting | - | - | |
| App Closed | - | - | |
| Cross-Device Read | - | - | |

---

## Known Limitations

1. **BroadcastChannel** - Not supported in some older browsers (Safari < 15.4)
2. **PWA offline** - Service worker may cache old socket URL
3. **Mobile browsers** - Background tab throttling may delay socket events

---

## Debugging Tips

1. Enable dev mode logs: `localStorage.setItem('debugMode', 'true')`
2. Watch for dev warnings in console (invalid events, duplicates)
3. Check Network tab for WebSocket frames
4. Use `socket.connected` in console to verify state

