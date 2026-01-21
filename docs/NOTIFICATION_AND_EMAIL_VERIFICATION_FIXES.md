# Notification & Email Verification Fixes

**Date:** 2026-01-12
**Issues Fixed:**
1. ❌ No notifications for comment replies
2. ❌ No notifications for new followers
3. ❌ No notifications for follow requests
4. ❌ No notifications for follow request acceptances
5. ❌ No notifications for new DMs
6. ❌ Email verification banner shows after clearing cache (even when verified)

---

## 🐛 **Issue 1: Missing Comment Reply Notifications**

### **Problem:**
When users comment on posts or reply to comments using the new comment system (`/api/posts/:postId/comments`), **NO notifications are created**.

The old system in `/server/routes/posts.js` had notification logic, but the new system in `/server/routes/comments.js` only handled @mention notifications.

### **Example:**
- User "Mat" comments on "kill's" post → ❌ No notification sent to "kill"
- User "kill" replies to "Mat's" comment → ❌ No notification sent to "Mat"

### **Root Cause:**
The new comment route (`POST /api/posts/:postId/comments`) was missing:
1. Notification creation for post comments
2. Notification creation for comment replies
3. Socket.IO real-time notification emission
4. Push notification sending

### **Fix Applied:**

**File:** `server/routes/comments.js`

**Added:**
1. Import `Notification` model
2. Import `emitNotificationCreated` utility
3. Import `sendPushNotification` utility
4. Added notification creation logic after comment is saved:
   - For **comments on posts**: Notify post author
   - For **replies to comments**: Notify parent comment author
   - Skip notification if user is commenting on their own content
   - Emit real-time Socket.IO event
   - Send push notification

**Code Added (lines 203-283):**
```javascript
// 🔔 Create notification for post author or parent comment author
try {
  if (parentCommentId) {
    // This is a reply to a comment
    const parentComment = await Comment.findById(parentCommentId).select('authorId');
    
    // Notify parent comment author (don't notify yourself)
    if (parentComment && parentComment.authorId.toString() !== userId.toString()) {
      const notification = new Notification({
        recipient: parentComment.authorId,
        sender: userId,
        type: 'comment',
        message: 'replied to your comment',
        postId,
        commentId: comment._id
      });
      await notification.save();
      await notification.populate('sender', 'username displayName profilePhoto');

      // ✅ Emit real-time notification
      emitNotificationCreated(req.io, parentComment.authorId.toString(), notification);

      // Send push notification
      // ... (push notification code)
    }
  } else {
    // This is a comment on a post
    const post = await Post.findById(postId).select('author');
    
    // Notify post author (don't notify yourself)
    if (post && post.author.toString() !== userId.toString()) {
      const notification = new Notification({
        recipient: post.author,
        sender: userId,
        type: 'comment',
        message: 'commented on your post',
        postId,
        commentId: comment._id
      });
      await notification.save();
      await notification.populate('sender', 'username displayName profilePhoto');

      // ✅ Emit real-time notification
      emitNotificationCreated(req.io, post.author.toString(), notification);

      // Send push notification
      // ... (push notification code)
    }
  }
} catch (notificationError) {
  // Don't fail the request if notification creation fails
  logger.error('Failed to create comment notification:', notificationError);
}
```

---

## 🐛 **Issue 2: Email Verification Banner After Cache Clear**

### **Problem:**
When users clear cache, unregister service worker, and re-login, the email verification banner appears **even if their email is already verified**.

### **Root Cause:**
The login endpoints (`POST /api/auth/login` and `POST /api/auth/verify-2fa-login`) were **NOT returning the `emailVerified` field** in the user object.

The frontend's `EmailVerificationBanner` component checks `user.emailVerified` to determine if the banner should be shown. Without this field, it defaults to showing the banner.

### **Fix Applied:**

**File:** `server/routes/auth.js`

**Changed:**
Added `emailVerified` field to the user object returned by both login endpoints:

**Line 1012 (regular login):**
```javascript
user: {
  id: user._id,
  _id: user._id,
  username: user.username,
  email: user.email,
  emailVerified: user.emailVerified || false,  // 🔔 CRITICAL: Include emailVerified status
  fullName: user.fullName,
  // ... rest of user fields
}
```

**Line 1288 (2FA login):**
```javascript
user: {
  id: user._id,
  _id: user._id,
  username: user.username,
  email: user.email,
  emailVerified: user.emailVerified || false,  // 🔔 CRITICAL: Include emailVerified status
  fullName: user.fullName,
  // ... rest of user fields
}
```

**Note:** The `/api/auth/me` endpoint already had this field (line 1356), so it was only missing from the login endpoints.

---

## 🐛 **Issue 3: Missing Follow Notifications**

### **Problem:**
When users follow each other or send/accept follow requests, **NO notifications are created**.

### **Root Cause:**
The follow routes (`/server/routes/follow.js`) were missing notification creation for:
1. New followers (public accounts)
2. Follow requests (private accounts)
3. Follow request acceptances

### **Fix Applied:**

**File:** `server/routes/follow.js`

**Added:**
1. Import `Notification` model
2. Import `emitNotificationCreated` utility
3. Import `sendPushNotification` utility
4. Added notification creation for:
   - **Public account follows**: Notify when someone follows you
   - **Follow requests**: Notify when someone sends a follow request
   - **Follow request accepted**: Notify requester when their request is accepted

---

## 🐛 **Issue 4: Missing DM Notifications**

### **Problem:**
When users receive direct messages, **NO notifications are created** (only Socket.IO events).

### **Root Cause:**
The messages route (`/server/routes/messages.js`) was missing notification creation for new DMs.

### **Fix Applied:**

**File:** `server/routes/messages.js`

**Added:**
1. Import `Notification` model
2. Import `emitNotificationCreated` utility
3. Import `sendPushNotification` utility
4. Added notification creation for new DMs:
   - Type: `'message'`
   - Shows sender name and message preview
   - Only for direct messages (not group chats)

---

## ✅ **Testing Checklist**

### **Comment Notifications:**
- [ ] Comment on someone's post → They receive notification
- [ ] Reply to someone's comment → They receive notification
- [ ] Comment on your own post → No notification (correct)
- [ ] Reply to your own comment → No notification (correct)
- [ ] Notification appears in real-time (Socket.IO)
- [ ] Notification appears in notification panel
- [ ] Push notification is sent (if enabled)

### **Follow Notifications:**
- [ ] Follow someone (public account) → They receive notification
- [ ] Send follow request (private account) → They receive notification
- [ ] Accept follow request → Requester receives notification
- [ ] Unfollow someone → No notification (correct)

### **DM Notifications:**
- [ ] Send DM to someone → They receive notification
- [ ] Send DM to yourself → No notification (correct)
- [ ] Group chat message → No notification (correct, handled separately)

### **Email Verification Fix:**
- [ ] Login with verified email → No banner shown
- [ ] Login with unverified email → Banner shown
- [ ] Clear cache + re-login with verified email → No banner shown ✅
- [ ] Verify email → Banner disappears immediately

---

## ✅ **Already Working (No Changes Needed)**

These notification types were already implemented correctly:
- ✅ **Post likes** - Notifications created in `/server/routes/posts.js`
- ✅ **Post reactions** - Notifications created in `/server/routes/posts.js`
- ✅ **Resonance signals** - Notifications created in `/server/routes/resonance.js` (rate-limited)
- ✅ **Circle invites** - Notifications created in `/server/routes/circles.js`
- ✅ **Group posts** - Notifications processed via `processGroupPostNotifications()`
- ✅ **Mentions** - Notifications created via `notifyMentionsInComment()` service

---

## 🚀 **Deployment Steps**

1. **Commit changes:**
   ```bash
   git add server/routes/comments.js server/routes/auth.js server/routes/follow.js server/routes/messages.js NOTIFICATION_AND_EMAIL_VERIFICATION_FIXES.md
   git commit -m "fix: add comprehensive notification system for all user interactions

   - Add notification creation for comments and replies in new comment system
   - Add notification creation for follows (public accounts)
   - Add notification creation for follow requests (private accounts)
   - Add notification creation for follow request acceptances
   - Add notification creation for new DMs
   - Include emailVerified field in login response to prevent false verification prompts
   - Add Socket.IO real-time notification emission for all events
   - Add push notification support for all events

   Fixes:
   - Users now receive notifications for comments, replies, follows, follow requests, and DMs
   - Email verification banner no longer shows after cache clear for verified users

   Files changed:
   - server/routes/comments.js (comment/reply notifications)
   - server/routes/auth.js (emailVerified field in login)
   - server/routes/follow.js (follow/follow request notifications)
   - server/routes/messages.js (DM notifications)"
   ```

2. **Push to repository:**
   ```bash
   git push origin main
   ```

3. **Deploy backend** (Render will auto-deploy)

4. **Test thoroughly** using the checklist above

---

## 📊 **Summary of Changes**

| Feature | File | Status |
|---------|------|--------|
| Comment notifications | `server/routes/comments.js` | ✅ Added |
| Reply notifications | `server/routes/comments.js` | ✅ Added |
| Follow notifications (public) | `server/routes/follow.js` | ✅ Added |
| Follow request notifications | `server/routes/follow.js` | ✅ Added |
| Follow request accepted | `server/routes/follow.js` | ✅ Added |
| DM notifications | `server/routes/messages.js` | ✅ Added |
| Email verification status | `server/routes/auth.js` | ✅ Added |
| Post likes | `server/routes/posts.js` | ✅ Already working |
| Post reactions | `server/routes/posts.js` | ✅ Already working |
| Resonance signals | `server/routes/resonance.js` | ✅ Already working |
| Circle invites | `server/routes/circles.js` | ✅ Already working |
| Group posts | `server/routes/groups.js` | ✅ Already working |
| Mentions | `mentionNotificationService.js` | ✅ Already working |

---

**Status:** ✅ Ready for deployment

