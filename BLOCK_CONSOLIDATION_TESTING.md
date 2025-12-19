# 🧪 BLOCK SYSTEM CONSOLIDATION - TESTING GUIDE

**Date:** 2025-12-19  
**Purpose:** Verify block system consolidation works correctly

---

## 📋 PRE-MIGRATION TESTING

### **Step 1: Check Current State**
```bash
# Connect to MongoDB
mongosh

# Check existing User.blockedUsers data
use pryde_social
db.users.find({ blockedUsers: { $exists: true, $ne: [] } }).count()
db.users.find({ blockedUsers: { $exists: true, $ne: [] } }).forEach(u => {
  print(`User ${u.username} has ${u.blockedUsers.length} blocked users`)
})

# Check existing Block collection
db.blocks.countDocuments()
```

---

## 🔄 MIGRATION EXECUTION

### **Step 2: Run Migration Script**
```bash
# Run migration
node server/scripts/migrateBlocks.js
```

**Expected Output:**
```
🔄 Starting block system migration...

✅ Connected to MongoDB

📊 Found X users with blocked users

Processing user: alice (507f1f77bcf86cd799439011)
  - Has 2 blocked users
  ✅ Migrated block: 507f1f77bcf86cd799439011 -> 507f1f77bcf86cd799439012
  ✅ Migrated block: 507f1f77bcf86cd799439011 -> 507f1f77bcf86cd799439013

============================================================
📊 MIGRATION SUMMARY
============================================================
✅ Migrated: X blocks
⏭️  Skipped (already exist): Y blocks
❌ Errors: 0 blocks
📦 Total users processed: Z
============================================================

🔍 Verifying migration...

📊 Total blocks in Block collection: X

📋 Sample blocks:
  1. alice blocked bob
  2. charlie blocked dave
  ...

✅ Migration completed successfully!

⚠️  IMPORTANT: User.blockedUsers arrays are still intact for rollback.
   After verifying the migration, you can remove the blockedUsers field from the User schema.

🔌 Database connection closed
```

---

## ✅ POST-MIGRATION VERIFICATION

### **Step 3: Verify Data Migration**
```bash
# Connect to MongoDB
mongosh

use pryde_social

# Count blocks in Block collection
db.blocks.countDocuments()

# Verify blocks match User.blockedUsers
db.users.aggregate([
  { $match: { blockedUsers: { $exists: true, $ne: [] } } },
  { $project: { username: 1, blockCount: { $size: "$blockedUsers" } } }
])

# Check sample blocks
db.blocks.find().limit(5).pretty()
```

---

## 🧪 FUNCTIONAL TESTING

### **Test 1: Block a User**
```bash
# Using curl or Postman
POST /api/blocks
Headers: Authorization: Bearer <token>
Body: {
  "blockedUserId": "507f1f77bcf86cd799439012"
}

# Expected: 201 Created
# Response: { message: "User blocked successfully", block: {...} }
```

**Verify:**
- ✅ Block created in Block collection
- ✅ User appears in blocked list
- ✅ User doesn't appear in feed
- ✅ User doesn't appear in search

---

### **Test 2: Verify Feed Filtering**
```bash
# Get feed
GET /api/feed/global
Headers: Authorization: Bearer <token>

# Expected: No posts from blocked users
```

**Verify:**
- ✅ Blocked users' posts NOT in feed
- ✅ Other users' posts visible
- ✅ Own posts visible

---

### **Test 3: Verify Search Filtering**
```bash
# Search for blocked user
GET /api/search?q=<blocked_username>&type=users
Headers: Authorization: Bearer <token>

# Expected: Blocked user NOT in results
```

**Verify:**
- ✅ Blocked user NOT in user search
- ✅ Blocked user's posts NOT in post search
- ✅ Other users visible

---

### **Test 4: Verify Profile Blocking**
```bash
# Try to view blocked user's profile
GET /api/users/<blocked_user_id>
Headers: Authorization: Bearer <token>

# Expected: 403 Forbidden
# Response: { message: "Profile not accessible" }
```

**Verify:**
- ✅ Cannot view blocked user's profile
- ✅ Can view other users' profiles

---

### **Test 5: Verify Messaging Blocking**
```bash
# Try to send message to blocked user
POST /api/messages
Headers: Authorization: Bearer <token>
Body: {
  "recipient": "<blocked_user_id>",
  "content": "Test message"
}

# Expected: 403 Forbidden
# Response: { message: "Cannot send message to this user" }
```

**Verify:**
- ✅ Cannot send message to blocked user
- ✅ Can send messages to other users

---

### **Test 6: Verify Bidirectional Blocking**
```bash
# User A blocks User B
# Then User B tries to view User A's profile

GET /api/users/<user_a_id>
Headers: Authorization: Bearer <user_b_token>

# Expected: 403 Forbidden
# Response: { message: "Profile not accessible" }
```

**Verify:**
- ✅ User B cannot view User A's profile
- ✅ User B cannot send messages to User A
- ✅ User A's posts don't appear in User B's feed

---

### **Test 7: Unblock a User**
```bash
# Unblock user
DELETE /api/blocks/<blocked_user_id>
Headers: Authorization: Bearer <token>

# Expected: 200 OK
# Response: { message: "User unblocked successfully" }
```

**Verify:**
- ✅ Block removed from Block collection
- ✅ User no longer in blocked list
- ✅ User appears in feed again
- ✅ User appears in search again
- ✅ Can view user's profile
- ✅ Can send messages to user

---

### **Test 8: Privacy Routes Compatibility**
```bash
# Test old privacy routes still work
POST /api/privacy/block/<user_id>
Headers: Authorization: Bearer <token>

# Expected: 200 OK
# Verify: Block created in Block collection (not User.blockedUsers)

GET /api/privacy/blocked
Headers: Authorization: Bearer <token>

# Expected: 200 OK
# Response: { blockedUsers: [...] }
# Verify: Data comes from Block collection
```

---

## 🔍 DATABASE VERIFICATION

### **Step 4: Verify Block Collection**
```javascript
// MongoDB shell
use pryde_social

// Check block structure
db.blocks.findOne()
// Expected:
// {
//   _id: ObjectId("..."),
//   blocker: ObjectId("..."),
//   blocked: ObjectId("..."),
//   reason: "...",
//   createdAt: ISODate("...")
// }

// Verify indexes
db.blocks.getIndexes()
// Expected:
// [
//   { key: { _id: 1 } },
//   { key: { blocker: 1 } },
//   { key: { blocked: 1 } },
//   { key: { blocker: 1, blocked: 1 }, unique: true }
// ]

// Check for duplicate blocks
db.blocks.aggregate([
  { $group: { _id: { blocker: "$blocker", blocked: "$blocked" }, count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
])
// Expected: No results (no duplicates)
```

---

## ✅ SUCCESS CRITERIA

All tests must pass:
- [x] Migration script runs without errors
- [ ] All User.blockedUsers data migrated to Block collection
- [ ] Block/unblock functionality works
- [ ] Feed filtering works (no blocked users)
- [ ] Search filtering works (no blocked users)
- [ ] Profile blocking works (403 error)
- [ ] Messaging blocking works (403 error)
- [ ] Bidirectional blocking works
- [ ] Privacy routes still work (backward compatible)
- [ ] No duplicate blocks in database

---

## 🚨 ROLLBACK PROCEDURE

If issues are found:

1. **Revert middleware changes:**
   ```bash
   git checkout server/middleware/privacy.js
   git checkout server/routes/feed.js
   git checkout server/routes/search.js
   git checkout server/routes/posts.js
   git checkout server/routes/privacy.js
   ```

2. **User.blockedUsers data is still intact** - No data loss

3. **Block collection can be cleared:**
   ```javascript
   db.blocks.deleteMany({ reason: "Migrated from User.blockedUsers array" })
   ```

---

## 📝 NOTES

- User.blockedUsers arrays are preserved during migration
- Safe to run migration multiple times (checks for duplicates)
- No breaking changes for frontend
- All existing block functionality preserved
- Performance improved with indexed queries


