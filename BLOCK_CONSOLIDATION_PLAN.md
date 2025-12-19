# 🔒 BLOCK SYSTEM CONSOLIDATION PLAN

**Date:** 2025-12-19  
**Priority:** HIGH - Data Consistency Fix  
**Status:** PLANNING

---

## 📊 CURRENT STATE ANALYSIS

### **DUPLICATE SYSTEMS IDENTIFIED:**

#### **System 1: Block Model** (`server/models/Block.js`)
- **Routes:** `/api/blocks`
- **Storage:** Separate `blocks` collection
- **Fields:** `blocker`, `blocked`, `reason`, `createdAt`
- **Indexes:** Compound index on `(blocker, blocked)`
- **Used by:**
  - `server/routes/blocks.js` - Block/unblock/list endpoints
  - `src/pages/Messages.jsx` - Frontend blocking UI
  - `server/routes/admin.js` - Admin panel block viewing

#### **System 2: User.blockedUsers Array** (`server/models/User.js` line 645)
- **Routes:** `/api/privacy/block/:userId`, `/api/privacy/unblock/:userId`
- **Storage:** Array field in `users` collection
- **Fields:** Array of user IDs
- **Used by:**
  - `server/middleware/privacy.js` - Block checking middleware
  - `server/routes/privacy.js` - Privacy settings endpoints

---

## 🚨 CRITICAL ISSUES FOUND

### **1. Inconsistent Data**
- Blocks created via `/api/blocks` are NOT in `User.blockedUsers`
- Blocks created via `/api/privacy/block` are NOT in `Block` collection
- **Result:** Users can be "partially blocked" depending on which system was used

### **2. Missing Block Filtering**
- ❌ **Feed** (`server/routes/feed.js`) - NO block filtering
- ❌ **Search** (`server/routes/search.js`) - NO block filtering  
- ❌ **Notifications** - NO block prevention
- ✅ **Messages** - Block checking via middleware
- ✅ **Profiles** - Block checking via middleware

### **3. Frontend Inconsistency**
- `src/pages/Messages.jsx` uses `/api/blocks` endpoint
- Other components may use `/api/privacy/block` endpoint
- No single source of truth

---

## 🎯 CONSOLIDATION STRATEGY

### **DECISION: Use Block Model as Single Source of Truth**

**Rationale:**
1. ✅ Better data structure (separate collection)
2. ✅ Supports `reason` field for moderation
3. ✅ Indexed for performance
4. ✅ Admin panel already uses it
5. ✅ Easier to query bidirectional blocks
6. ✅ Audit trail with `createdAt`

---

## 📋 MIGRATION STEPS

### **Phase 1: Data Migration**
1. Create migration script to copy `User.blockedUsers` to `Block` collection
2. Verify no data loss
3. Keep `User.blockedUsers` temporarily for rollback

### **Phase 2: Update Middleware**
1. Update `server/middleware/privacy.js` to use `Block` model
2. Create helper function `isBlocked(userId1, userId2)`
3. Update all block checks to use new helper

### **Phase 3: Update Routes**
1. Deprecate `/api/privacy/block` and `/api/privacy/unblock` routes
2. Redirect to `/api/blocks` endpoints
3. Update response format for compatibility

### **Phase 4: Update Feed & Search**
1. Add block filtering to feed queries
2. Add block filtering to search results
3. Add block prevention to notification creation

### **Phase 5: Cleanup**
1. Remove `User.blockedUsers` field from schema
2. Remove deprecated routes
3. Update documentation

---

## 🔧 IMPLEMENTATION DETAILS

### **New Helper Function:**
```javascript
// server/utils/blockHelper.js
export const isBlocked = async (userId1, userId2) => {
  const block = await Block.findOne({
    $or: [
      { blocker: userId1, blocked: userId2 },
      { blocker: userId2, blocked: userId1 }
    ]
  });
  return !!block;
};

export const getBlockedUserIds = async (userId) => {
  const blocks = await Block.find({
    $or: [
      { blocker: userId },
      { blocked: userId }
    ]
  });
  
  const blockedIds = new Set();
  blocks.forEach(block => {
    if (block.blocker.toString() === userId.toString()) {
      blockedIds.add(block.blocked.toString());
    } else {
      blockedIds.add(block.blocker.toString());
    }
  });
  
  return Array.from(blockedIds);
};
```

### **Updated Middleware:**
```javascript
// server/middleware/privacy.js
import { isBlocked } from '../utils/blockHelper.js';

export const checkBlocked = async (req, res, next) => {
  const currentUserId = req.userId;
  const targetUserId = req.params.userId || req.params.id || req.body.recipient;
  
  if (!targetUserId || currentUserId === targetUserId) {
    return next();
  }
  
  const blocked = await isBlocked(currentUserId, targetUserId);
  
  if (blocked) {
    return res.status(403).json({ message: 'You cannot interact with this user' });
  }
  
  next();
};
```

### **Feed Filtering:**
```javascript
// server/routes/feed.js
import { getBlockedUserIds } from '../utils/blockHelper.js';

router.get('/global', authenticateToken, async (req, res) => {
  const currentUserId = req.user.id;
  const blockedUserIds = await getBlockedUserIds(currentUserId);
  
  const query = {
    visibility: 'public',
    author: { $nin: blockedUserIds } // Exclude blocked users
  };
  
  // ... rest of query
});
```

---

## ✅ EXPECTED RESULTS

### **After Consolidation:**
- ✅ Single source of truth (Block model)
- ✅ Blocked users NEVER see each other in feed
- ✅ Blocked users NEVER appear in search
- ✅ Blocked users CANNOT send notifications
- ✅ Blocked users CANNOT message each other
- ✅ Blocked users CANNOT view profiles
- ✅ Privacy rules enforced consistently
- ✅ No duplicate logic
- ✅ Admin visibility into all blocks

---

## 🧪 TESTING CHECKLIST

- [ ] Migrate existing `User.blockedUsers` data
- [ ] Verify block checking in messages
- [ ] Verify block checking in profiles
- [ ] Verify block filtering in feed
- [ ] Verify block filtering in search
- [ ] Verify block prevention in notifications
- [ ] Test bidirectional blocking
- [ ] Test unblocking
- [ ] Verify admin panel shows all blocks
- [ ] Performance test with large block lists

---

## 📝 FILES TO MODIFY

### **Create:**
1. `server/utils/blockHelper.js` - Helper functions
2. `server/scripts/migrateBlocks.js` - Migration script

### **Modify:**
1. `server/middleware/privacy.js` - Use Block model
2. `server/routes/feed.js` - Add block filtering
3. `server/routes/search.js` - Add block filtering
4. `server/routes/notifications.js` - Add block prevention
5. `server/routes/privacy.js` - Deprecate old endpoints
6. `server/models/User.js` - Remove blockedUsers field (later)

---

## ⚠️ ROLLBACK PLAN

If issues arise:
1. Keep `User.blockedUsers` field during migration
2. Can revert middleware to use array
3. Block model data preserved
4. No data loss


