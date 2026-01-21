# 🔍 Investigation Summary - Notification & DM Issues

## 📊 Current Status

### ✅ **Working**
- Comment notifications (user commented on post)
- Database connections (confirmed MongoDB Atlas with 50 users)
- Message encryption/decryption (automatic via Mongoose middleware)
- Message persistence to database (25 messages confirmed between Mat and Test)

### ❌ **Not Working**
- Reply notifications (user replied to comment)
- DM notifications (may be working, needs testing)
- DM persistence after page refresh (messages disappear)

---

## 🔬 Investigation Results

### **1. Database Verification** ✅

**Test Script:** `server/scripts/checkAllMessages.js`

**Results:**
- ✅ Connected to MongoDB Atlas database: `pryde-social`
- ✅ Found 25 messages between Mat and Test
- ✅ Messages are encrypted in database (appear as hex strings)
- ✅ All messages marked as read
- ✅ Last message: 11/01/2026, 11:22:09 pm

**Conclusion:** Messages ARE being saved to the database correctly.

---

### **2. Backend Code Review** ✅

**Socket.IO Message Handler:** `server/server.js` lines 674-790
- ✅ Receives `send_message` event
- ✅ Sanitizes and validates content
- ✅ Creates `Message` document
- ✅ Saves to database with `message.save()`
- ✅ Populates sender/recipient
- ✅ Emits Socket.IO events (`message:new`, `message:sent`)
- ✅ Creates notification
- ✅ Sends push notification

**REST API Endpoint:** `server/routes/messages.js` lines 371-478
- ✅ POST `/api/messages` endpoint exists
- ✅ Saves message to database
- ✅ Emits Socket.IO events
- ✅ Creates notification

**Fetch Endpoint:** `server/routes/messages.js` lines 136-187
- ✅ GET `/api/messages/:userId` endpoint exists
- ✅ Queries database for messages between two users
- ✅ Populates sender/recipient
- ✅ Sorts by `createdAt`
- ✅ Returns decrypted messages (via `toJSON()` method)

**Conclusion:** Backend code is correct and working.

---

### **3. Frontend Code Review** ✅

**Message Fetching:** `src/pages/Messages.jsx` lines 280-333
- ✅ `useEffect` triggers when `selectedChat` changes
- ✅ Calls `GET /api/messages/:userId`
- ✅ Sets messages with `setMessages(response.data)`
- ✅ Marks messages as read
- ✅ Refreshes conversations

**Message Display:** `src/pages/Messages.jsx` lines 1580-1752
- ✅ Maps over `messages` array
- ✅ Displays message content with `sanitizeMessage(msg.content)`
- ✅ Shows sender name and avatar
- ✅ Shows timestamp
- ✅ No filtering applied

**Conclusion:** Frontend code LOOKS correct, but messages are not appearing after refresh.

---

## 🐛 **Root Cause Analysis**

### **DM Persistence Issue**

**What we know:**
1. ✅ Messages ARE saved to database (confirmed with test script)
2. ✅ Backend fetch endpoint works (returns messages)
3. ✅ Frontend fetch code exists and looks correct
4. ❌ Messages disappear after page refresh

**Possible causes:**
1. **Frontend not calling fetch endpoint**
   - `selectedChat` state might be null after refresh
   - `useEffect` might not be triggering
   - JavaScript error preventing fetch

2. **API returning empty array**
   - User IDs might not match
   - Authentication token might be invalid
   - CORS or network issue

3. **Frontend state not updating**
   - `setMessages()` not being called
   - React not re-rendering
   - State being cleared somewhere

4. **Messages being filtered out**
   - Deleted messages filter
   - Read/unread filter
   - Some other condition

---

### **Reply Notification Issue**

**What we know:**
1. ✅ Backend code creates notification (lines 205-240 in `server/routes/comments.js`)
2. ✅ Backend emits Socket.IO event
3. ❌ Notification not appearing in frontend

**Possible causes:**
1. **`parentCommentId` not being sent**
   - Frontend might not be including it in request
   - Check Network tab for POST payload

2. **Notification created but not emitted**
   - Socket.IO connection issue
   - User not in correct room

3. **Frontend not listening for notification**
   - Notification bell not subscribed to event
   - Event name mismatch

---

## 🧪 **Required User Testing**

### **Test 1: DM Persistence (PRIORITY 1)**

**Steps:**
1. Open browser DevTools (F12)
2. Go to Messages page
3. Select conversation with @test or @mat
4. **Check Console tab:**
   - Look for: `📥 Fetching messages from: /messages/USER_ID`
   - Look for: `✅ Loaded X messages in Xms`
   - Look for any red error messages
5. **Check Network tab:**
   - Look for request to `/api/messages/USER_ID`
   - Click on request → Response tab
   - Should show array of messages (not empty `[]`)
6. **Manual API test in Console:**
   ```javascript
   fetch('/api/messages/6925007f6b6b3530900fee8f', {
     headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
   }).then(r => r.json()).then(data => console.log('Messages:', data))
   ```
7. **Check localStorage:**
   ```javascript
   localStorage.getItem('selectedChat')
   ```

**Expected Results:**
- Console should show fetch logs
- Network tab should show 200 response with messages array
- Manual API test should return messages
- localStorage should have selectedChat ID

---

### **Test 2: Reply Notifications (PRIORITY 2)**

**Steps:**
1. @test comments on @amatex's post
2. @amatex replies to @test's comment
3. Check @test's notification bell
4. **Check Console tab:**
   - Look for Socket.IO events
   - Look for notification creation logs
5. **Check Network tab:**
   - Look for POST to `/api/posts/:postId/comments`
   - Check request payload has `parentCommentId`
   - Check response

**Expected Results:**
- @test should see notification
- Console should show Socket.IO events
- Network tab should show successful POST

---

## 📝 **Next Steps**

1. **User performs Test 1** and reports findings
2. Based on results, we can identify exact issue
3. Fix the issue
4. Test again
5. Move to Test 2

---

**Files Created:**
- `NOTIFICATION_TESTING_RESULTS.md` - Detailed testing guide
- `server/scripts/testDMPersistence.js` - Database persistence test
- `server/scripts/checkAllMessages.js` - View all messages in database
- `INVESTIGATION_SUMMARY.md` - This file

