# 🔍 Message Debugging Guide

## Quick Diagnostic Steps

### Step 1: Check Socket Connection (Both Users)

**Open browser console on BOTH users' browsers and run:**

```javascript
// Check if socket is connected
const socket = window.socket || (await import('./src/utils/socket.js')).getSocket();
console.log('🔌 Socket Status:', {
  exists: !!socket,
  connected: socket?.connected,
  id: socket?.id,
  transport: socket?.io?.engine?.transport?.name
});
```

**Expected Output:**
```
✅ Socket Status: { exists: true, connected: true, id: "abc123", transport: "websocket" }
```

---

### Step 2: Check User Rooms (Backend Logs)

**Look for these lines in your Render logs when users connect:**

```
User connected: <userId>
📡 User <userId> joined global chat
```

**If you DON'T see these, the socket isn't connecting properly.**

---

### Step 3: Enable Debug Logging (Frontend)

**In BOTH users' browser consoles:**

```javascript
// Enable all debug logs
localStorage.setItem('debug', 'pryde:*');

// Reload page
location.reload();
```

---

### Step 4: Monitor Message Events (Sender)

**In SENDER's browser console, BEFORE sending a message:**

```javascript
const socket = window.socket || (await import('./src/utils/socket.js')).getSocket();

// Listen for confirmation
socket.on('message:sent', (msg) => {
  console.log('✅ SENDER: Received message:sent confirmation:', msg);
});

// Monitor the emit
const originalEmit = socket.emit.bind(socket);
socket.emit = function(event, data) {
  if (event === 'send_message') {
    console.log('📤 SENDER: Emitting send_message:', data);
  }
  return originalEmit(event, data);
};
```

**Now send a message and check:**
- ✅ You should see: `📤 SENDER: Emitting send_message`
- ✅ You should see: `✅ SENDER: Received message:sent confirmation`

---

### Step 5: Monitor Message Events (Recipient)

**In RECIPIENT's browser console, BEFORE sender sends:**

```javascript
const socket = window.socket || (await import('./src/utils/socket.js')).getSocket();

// Listen for new message
socket.on('message:new', (msg) => {
  console.log('📨 RECIPIENT: Received message:new:', msg);
});

console.log('🎧 RECIPIENT: Listening for message:new events');
```

**Now have the sender send a message and check:**
- ✅ You should see: `📨 RECIPIENT: Received message:new`

---

## 🐛 Common Issues & Solutions

### Issue 1: Socket Not Connected

**Symptoms:**
```
Socket Status: { exists: true, connected: false, ... }
```

**Solution:**
1. Check browser console for CORS errors
2. Check if `https://prydeapp.com` is in backend CORS allowlist
3. Verify `FRONTEND_URL` environment variable is `https://prydeapp.com`

---

### Issue 2: Message Sent But Not Received

**Symptoms:**
- Sender sees: `✅ SENDER: Received message:sent confirmation`
- Recipient sees: NOTHING

**Diagnosis:**
```javascript
// On RECIPIENT's browser
const socket = window.socket || (await import('./src/utils/socket.js')).getSocket();
console.log('🆔 My User ID:', socket.auth?.userId || 'UNKNOWN');
console.log('🔌 Socket ID:', socket.id);
```

**Then check backend logs for:**
```
Send to recipient if online
recipientSocketId: <should match recipient's socket.id>
```

**If recipientSocketId is `undefined`, the backend doesn't know the recipient is online.**

---

### Issue 3: Events Not Firing in React

**Symptoms:**
- Socket receives event (you see it in console)
- React component doesn't update

**Solution:**
Check if event listeners are set up in `Messages.jsx`:

```javascript
// In browser console
const socket = window.socket || (await import('./src/utils/socket.js')).getSocket();
console.log('🎧 Listeners for message:new:', socket.listeners('message:new').length);
console.log('🎧 Listeners for message:sent:', socket.listeners('message:sent').length);
```

**Expected:** At least 1 listener for each event

---

## 🔥 Nuclear Option: Full Reset

If nothing works, try this:

```javascript
// 1. Clear all storage
localStorage.clear();
sessionStorage.clear();

// 2. Clear cookies
document.cookie.split(";").forEach(c => {
  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
});

// 3. Reload
location.reload();

// 4. Login again
```

---

## 📊 Backend Diagnostic Endpoint

**Check if backend can see both users online:**

**IMPORTANT:** This endpoint only works in development mode. For production, check Render logs.

```bash
# In your terminal or Postman (DEV ONLY)
curl http://localhost:9000/api/dev/online-users \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "onlineUsers": [
    {
      "userId": "123abc",
      "socketId": "xyz789",
      "username": "user1",
      "displayName": "User One",
      "role": "user"
    },
    {
      "userId": "456def",
      "socketId": "abc123",
      "username": "user2",
      "displayName": "User Two",
      "role": "user"
    }
  ],
  "count": 2,
  "timestamp": "2026-01-13T..."
}
```

**For Production (Render):**
Check the logs for these lines when users connect:
```
User connected: <userId>
```

Count how many unique userIds you see - that's how many users are online.

---

## 🎯 Next Steps

1. Run Steps 1-5 above
2. Report back which step fails
3. Share the console output from both sender and recipient
4. Share any backend logs from Render

This will help us pinpoint exactly where the message flow is breaking!

