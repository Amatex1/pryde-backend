# 🔍 Messaging System Audit - 2026-01-12

## 📊 CI Status

### Backend (ci-lockdown-comment-ux-release branch)
- **Status:** ❌ **FAILED**
- **Commit:** `9307d85` (badge fix)
- **Failed Check:** "All Checks Passed" job
- **Action Required:** Check GitHub Actions logs at https://github.com/Amatex1/pryde-backend/actions/runs/20923150982

**Passing Checks:**
- ✅ Lint Code
- ✅ Security Audit

**Failed/Cancelled Checks:**
- ❌ All Checks Passed (failure)
- ⚠️ Run Tests (18.x) - cancelled
- ⚠️ Run Tests (20.x) - cancelled
- ⏭️ Build Check - skipped

---

## 🗄️ Database Configuration

### MongoDB Connection
**Database:** `pryde-social` (MongoDB Atlas)
**Connection String:** `mongodb+srv://prydeAdmin:***@pryde-social.bvs3dyu.mongodb.net/pryde-social`
**Status:** ✅ Connected (based on .env configuration)

### Message Storage
**Model:** `server/models/Message.js`
**Collection:** `messages`
**Encryption:** ✅ Enabled (MESSAGE_ENCRYPTION_KEY configured)

**Schema Fields:**
- `sender` (ObjectId → User)
- `recipient` (ObjectId → User)
- `groupChat` (ObjectId → GroupChat, optional)
- `content` (String, encrypted at rest)
- `attachment` (String, optional)
- `read` (Boolean)
- `readBy` (Array of {user, readAt})
- `deliveredTo` (Array of {user, deliveredAt})
- `createdAt` (Date)

**Indexes:**
- `{ sender: 1, recipient: 1, createdAt: -1 }`
- `{ groupChat: 1, createdAt: -1 }`
- `{ sender: 1, createdAt: -1 }`
- `{ recipient: 1, createdAt: -1 }`

---

## 🔌 API Endpoints Analysis

### Backend Routes (`server/routes/messages.js`)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/messages/list` | GET | Get all conversations | ✅ |
| `/api/messages/:userId` | GET | Get messages with user | ✅ |
| `/api/messages` | GET | Get all conversations (legacy) | ✅ |
| `/api/messages` | POST | Send message | ✅ |
| `/api/messages/:id/read` | PUT | Mark as read | ✅ |
| `/api/messages/:id/delivered` | PUT | Mark as delivered | ✅ |
| `/api/messages/:id` | DELETE | Delete message | ✅ |
| `/api/messages/:id/react` | POST | Add reaction | ✅ |
| `/api/messages/group/:groupId` | GET | Get group messages | ✅ |

**Key Features:**
- ✅ Message encryption/decryption
- ✅ Socket.IO real-time events
- ✅ Read receipts
- ✅ Delivery status
- ✅ Group chat support
- ✅ Blocked user checks
- ✅ Privacy middleware

---

## 🎯 Frontend API Calls

### Messages Page (`src/pages/Messages.jsx`)

**Fetch Conversations:**
```javascript
// Line 246-248
const [messagesRes, groupsRes] = await Promise.all([
  api.get('/messages'),
  api.get('/groupChats')
]);
```

**Fetch Messages:**
```javascript
// Line 285-294
const endpoint = selectedChatType === 'group'
  ? `/messages/group/${selectedChat}`
  : `/messages/${selectedChat}`;
const response = await api.get(endpoint, {
  params: { limit: 50 }
});
```

**Send Message (Socket.IO):**
```javascript
// Line 573-579
socketSendMessage({
  recipientId: selectedChat,
  content: message,
  attachment: attachmentUrl,
  voiceNote: voiceNote,
  contentWarning: contentWarning
});
```

**Send Message (REST API - Group):**
```javascript
// Line 541-547
await api.post('/messages', {
  groupChatId: selectedChat,
  content: message,
  attachment: attachmentUrl,
  voiceNote: voiceNote,
  contentWarning: contentWarning
});
```

---

## 🔄 Real-Time Communication

### Socket.IO Events

**Client → Server:**
- `send_message` - Send new message

**Server → Client:**
- `message:new` - New message received
- `message:sent` - Message sent confirmation
- `message:deleted` - Message deleted
- `message:edited` - Message edited
- `message:read` - Message read
- `typing` - User typing indicator

**Socket Rooms:**
- `user_${userId}` - User-specific room for cross-device sync
- Individual socket IDs for direct delivery

---

## 🐛 Potential Issues

### 1. Message Persistence
**Symptom:** Messages disappear on refresh
**Possible Causes:**
- ❌ Messages not being saved to database
- ❌ GET endpoint not returning saved messages
- ❌ Frontend not fetching messages on mount
- ❌ Encryption/decryption errors

### 2. Real-Time Delivery
**Symptom:** Messages not received in real-time
**Possible Causes:**
- ❌ Socket.IO not connected
- ❌ Socket events not being emitted
- ❌ Socket listeners not attached
- ❌ User not in correct socket room

### 3. API Endpoint Mismatch
**Potential Mismatches:**
- ✅ Frontend uses `/messages` - Backend has `/api/messages` ✅
- ✅ Frontend uses `/messages/:userId` - Backend has `/api/messages/:userId` ✅
- ✅ Frontend uses `/messages/group/:groupId` - Backend has `/api/messages/group/:groupId` ✅

**Verdict:** ✅ All endpoints match correctly

---

## 🔍 Diagnostic Steps

### Step 1: Fix CI Tests ⚠️ PRIORITY
**Action:** Check GitHub Actions logs
**URL:** https://github.com/Amatex1/pryde-backend/actions/runs/20923150982
**Expected:** Identify why "All Checks Passed" job failed

### Step 2: Test Message Sending (Browser Console)
**Open:** Chrome DevTools → Console
**Send a test message and check:**

1. **Network Tab:**
   ```
   POST /api/messages
   Status: 201 Created
   Response: { _id, sender, recipient, content, createdAt }
   ```

2. **Console Tab:**
   ```
   📤 Sending message: { recipientId, content, ... }
   🔌 Emitting send_message via socket
   ✅ Socket events emitted
   ```

3. **Socket Events:**
   ```
   → send_message (outgoing)
   ← message:sent (confirmation)
   ← message:new (if recipient online)
   ```

### Step 3: Test Message Fetching (After Refresh)
**Refresh page and check:**

1. **Network Tab:**
   ```
   GET /api/messages/:userId
   Status: 200 OK
   Response: [ { _id, sender, recipient, content, createdAt }, ... ]
   ```

2. **Console Tab:**
   ```
   📥 Fetching messages from: /api/messages/:userId
   ✅ Loaded X messages in Yms
   ```

3. **UI:**
   - Messages should appear in chat window
   - Timestamps should be correct
   - Sender/recipient info should be populated

### Step 4: Check Database Directly
**MongoDB Atlas → Browse Collections → messages**

**Verify:**
- Messages are being saved
- `sender` and `recipient` fields are populated
- `content` is encrypted (looks like gibberish)
- `createdAt` timestamp is recent

### Step 5: Check Server Logs (Render)
**Render Dashboard → Logs**

**Look for:**
```
📬 [GET /messages/:userId] Fetching messages between X and Y
📬 [GET /messages/:userId] Found N messages
🔒 Encrypting message content...
✅ Socket events emitted for REST API message
```

---

## 🚨 Common Issues & Fixes

### Issue 1: Messages Not Persisting
**Symptoms:** Messages disappear after refresh
**Diagnosis:**
- Check if POST /api/messages returns 201
- Check if message._id is returned
- Check MongoDB for saved message

**Fix:**
- Verify MESSAGE_ENCRYPTION_KEY is set
- Check database connection
- Verify auth token is valid

### Issue 2: Messages Not Received in Real-Time
**Symptoms:** Recipient doesn't see message until refresh
**Diagnosis:**
- Check Socket.IO connection status
- Check if socket events are being emitted
- Check if recipient is in correct socket room

**Fix:**
- Verify SOCKET_URL is correct
- Check socket connection in browser console
- Verify user is authenticated

### Issue 3: Messages Not Loading on Refresh
**Symptoms:** Chat is empty after page reload
**Diagnosis:**
- Check GET /api/messages/:userId response
- Check if messages array is empty
- Check browser console for errors

**Fix:**
- Verify userId parameter is correct
- Check if messages exist in database
- Verify decryption is working

---

## 📋 Quick Test Checklist

- [ ] CI tests passing
- [ ] Can send message via UI
- [ ] Message appears in sender's chat
- [ ] Message appears in recipient's chat (real-time)
- [ ] Message persists after sender refreshes
- [ ] Message persists after recipient refreshes
- [ ] Message is encrypted in database
- [ ] Message is decrypted in UI
- [ ] Read receipts work
- [ ] Typing indicators work
- [ ] Socket.IO connected
- [ ] No errors in browser console
- [ ] No errors in server logs

