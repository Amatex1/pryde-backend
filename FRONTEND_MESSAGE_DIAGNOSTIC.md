# 🔍 Frontend Message Diagnostic Guide

## 📋 Quick Diagnostic Checklist

Run these checks in your browser's DevTools Console when testing messages:

### 1. Check API Configuration
```javascript
// Open Console and run:
console.log('API Base URL:', import.meta.env.VITE_API_URL);
console.log('Socket URL:', import.meta.env.VITE_SOCKET_URL);
```

**Expected Output:**
```
API Base URL: http://localhost:9000/api
Socket URL: http://localhost:9000
```

---

### 2. Check Socket.IO Connection
```javascript
// Check if socket is connected
console.log('Socket connected:', window.socket?.connected);
console.log('Socket ID:', window.socket?.id);
```

**Expected Output:**
```
Socket connected: true
Socket ID: "abc123xyz..."
```

---

### 3. Monitor Message Sending

**Before sending a message, run:**
```javascript
// Enable detailed logging
localStorage.setItem('debug', 'pryde:*');

// Monitor socket events
window.socket?.on('message:sent', (msg) => {
  console.log('✅ Message sent confirmation:', msg);
});

window.socket?.on('message:new', (msg) => {
  console.log('📨 New message received:', msg);
});
```

**Then send a test message and check:**
1. Network tab shows `POST /api/messages` with status 201
2. Console shows "✅ Message sent confirmation"
3. Message appears in chat window

---

### 4. Monitor Message Fetching

**After page refresh, check:**
```javascript
// Check if messages are being fetched
console.log('Fetching messages from:', '/api/messages/:userId');

// Monitor the response
fetch('http://localhost:9000/api/messages/USER_ID_HERE', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
})
.then(r => r.json())
.then(data => console.log('Messages:', data))
.catch(err => console.error('Error:', err));
```

**Expected Output:**
```
Messages: [
  {
    _id: "...",
    sender: { _id: "...", username: "..." },
    recipient: { _id: "...", username: "..." },
    content: "Test message",
    createdAt: "2026-01-12T..."
  },
  ...
]
```

---

### 5. Check Local State

**In React DevTools:**
1. Find `Messages` component
2. Check state:
   - `messages` - should contain array of messages
   - `selectedChat` - should be the user ID
   - `loadingMessages` - should be false after load

---

## 🐛 Common Issues & Fixes

### Issue 1: Messages Not Appearing After Send

**Symptoms:**
- POST request succeeds (201)
- No error in console
- Message doesn't appear in UI

**Diagnosis:**
```javascript
// Check if socket event was received
window.socket?.on('message:sent', (msg) => {
  console.log('Received message:sent event:', msg);
  console.log('Current messages state:', /* check React state */);
});
```

**Possible Causes:**
- Socket event listener not attached
- State not updating after socket event
- Message not being added to messages array

**Fix:**
Check `src/pages/Messages.jsx` lines 570-600 for socket event handlers

---

### Issue 2: Messages Disappear After Refresh

**Symptoms:**
- Messages visible after sending
- After refresh, chat is empty
- No errors in console

**Diagnosis:**
```javascript
// Check if GET request is being made
// Open Network tab, filter by "messages"
// Look for: GET /api/messages/:userId
```

**Possible Causes:**
- GET endpoint not being called
- GET endpoint returning empty array
- Messages not being saved to database

**Fix:**
1. Check Network tab for GET request
2. Check response data
3. If empty, check backend logs for database query

---

### Issue 3: Socket.IO Not Connected

**Symptoms:**
- `window.socket.connected` is `false`
- Real-time messages not working
- Only REST API messages work

**Diagnosis:**
```javascript
console.log('Socket status:', {
  connected: window.socket?.connected,
  id: window.socket?.id,
  url: import.meta.env.VITE_SOCKET_URL
});
```

**Fix:**
1. Check `VITE_SOCKET_URL` in `.env`
2. Verify backend is running
3. Check browser console for connection errors

---

## 📊 Performance Monitoring

**Add this to track message operations:**
```javascript
// Track message send time
const sendStartTime = performance.now();
// ... send message ...
const sendDuration = performance.now() - sendStartTime;
console.log(`Message sent in ${sendDuration}ms`);

// Track message fetch time
const fetchStartTime = performance.now();
// ... fetch messages ...
const fetchDuration = performance.now() - fetchStartTime;
console.log(`Messages fetched in ${fetchDuration}ms`);
```

**Expected Performance:**
- Message send: < 500ms
- Message fetch: < 1000ms
- Socket event delivery: < 100ms

---

## 🔧 Debug Mode

**Enable full debug logging:**
```javascript
// In browser console
localStorage.setItem('debug', 'pryde:*');
location.reload();
```

**Disable debug logging:**
```javascript
localStorage.removeItem('debug');
location.reload();
```

