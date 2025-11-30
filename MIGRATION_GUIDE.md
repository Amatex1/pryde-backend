# 🔄 Friends → Followers Migration Guide

## Overview
This guide explains the migration from a mutual friendship system to an Instagram-style follow system for Pryde Social.

---

## ✅ What Has Been Changed

### **Phase 1: UI Updates**
- ✅ Updated Privacy Settings labels from "Friends" to "Followers"
- ✅ Replaced "Who can send me friend requests?" with "Private Account" toggle
- ✅ Updated all privacy dropdown options to use "Followers Only" instead of "Friends Only"

### **Phase 2: Database Schema**
- ✅ Added `followers` array to User model
- ✅ Added `following` array to User model
- ✅ Added `isPrivateAccount` boolean to privacy settings
- ✅ Updated privacy settings enums to support both 'friends' and 'followers' (backward compatible)
- ✅ Created migration script: `server/migrations/convertFriendsToFollowers.js`

### **Phase 3: Backend Logic**
- ✅ Updated privacy middleware to check both `followers` and `friends` arrays
- ✅ Created new follow routes: `server/routes/follow.js`
- ✅ Created FollowRequest model: `server/models/FollowRequest.js`
- ✅ Registered follow routes in `server/server.js`

### **Phase 4: Additional Changes**
- ✅ Limited media uploads from 10 to 3 per post
- ✅ Hidden group chat UI (backend kept for future use)

---

## 🚀 How to Run the Migration

### **Step 1: Backup Your Database**
```bash
# Create a backup before running migration
mongodump --uri="your_mongodb_uri" --out=./backup
```

### **Step 2: Run the Migration Script**
```bash
cd server
node migrations/convertFriendsToFollowers.js
```

### **What the Migration Does:**
1. Copies all existing `friends` to both `followers` and `following` arrays (mutual follows)
2. Converts privacy settings from 'friends' to 'followers'
3. Converts `whoCanSendFriendRequests: 'no-one'` to `isPrivateAccount: true`
4. Keeps original `friends` array for backward compatibility

### **Step 3: Restart Your Server**
```bash
npm run dev
```

---

## 📊 New API Endpoints

### **Follow System**
- `POST /api/follow/:userId` - Follow a user (instant for public, request for private)
- `DELETE /api/follow/:userId` - Unfollow a user
- `GET /api/follow/followers/:userId` - Get user's followers
- `GET /api/follow/following/:userId` - Get users that this user is following
- `GET /api/follow/requests` - Get pending follow requests
- `POST /api/follow/requests/:requestId/accept` - Accept follow request
- `POST /api/follow/requests/:requestId/reject` - Reject follow request
- `DELETE /api/follow/requests/:requestId` - Cancel follow request

### **Legacy Endpoints (Still Work)**
- All `/api/friends/*` endpoints remain functional
- Backward compatible with existing friend system

---

## 🔐 Privacy Settings Changes

### **Old System:**
```javascript
whoCanSendFriendRequests: 'everyone' | 'friends-of-friends' | 'no-one'
profileVisibility: 'public' | 'friends' | 'private'
whoCanMessage: 'everyone' | 'friends' | 'no-one'
```

### **New System:**
```javascript
isPrivateAccount: true | false  // Replaces whoCanSendFriendRequests
profileVisibility: 'public' | 'followers' | 'private'
whoCanMessage: 'everyone' | 'followers' | 'no-one'
```

---

## 🎯 Key Differences: Friends vs Followers

| Feature | Friends System | Followers System |
|---------|---------------|------------------|
| **Relationship** | Mutual (both must accept) | One-way (follow anyone) |
| **Privacy** | Friend requests to everyone | Private accounts require approval |
| **Terminology** | Friends, Friend Requests | Followers, Following, Follow Requests |
| **Arrays** | `friends[]` | `followers[]` + `following[]` |

---

## 🔄 Backward Compatibility

The system maintains backward compatibility:
- ✅ Old `friends` array is preserved
- ✅ Privacy middleware checks both `friends` and `followers`
- ✅ Old privacy settings ('friends') still work
- ✅ Existing friend relationships converted to mutual follows

---

## 📝 Media Upload Changes

- **Before:** 10 media files per post
- **After:** 3 media files per post
- **Files Changed:**
  - `server/routes/upload.js` - Line 169
  - `src/pages/Feed.jsx` - Lines 297-301, 658

---

## 👥 Group Chat Changes

- **Status:** UI hidden, backend preserved
- **Files Changed:**
  - `src/pages/Messages.jsx` - Lines 800, 834, 1373
- **Backend:** All group chat routes and models remain functional
- **Future:** Can be re-enabled by removing `false &&` conditions

---

## ✅ Testing Checklist

After migration, test these features:

- [ ] User can follow/unfollow other users
- [ ] Private accounts require follow approval
- [ ] Public accounts allow instant follows
- [ ] Privacy settings work correctly
- [ ] Followers/following lists display properly
- [ ] Messages respect "Followers Only" privacy
- [ ] Profile visibility respects "Followers Only" setting
- [ ] Media upload limited to 3 files
- [ ] Group chat UI is hidden
- [ ] Existing friendships still work

---

## 🆘 Rollback Instructions

If you need to rollback:

1. **Restore database backup:**
   ```bash
   mongorestore --uri="your_mongodb_uri" ./backup
   ```

2. **Revert code changes:**
   ```bash
   git revert HEAD
   ```

---

## 📞 Support

If you encounter issues during migration:
1. Check server logs for errors
2. Verify MongoDB connection
3. Ensure all dependencies are installed
4. Review the migration script output

---

**Migration Created:** 2025
**Version:** 1.0.0
**Status:** ✅ Ready for Production

