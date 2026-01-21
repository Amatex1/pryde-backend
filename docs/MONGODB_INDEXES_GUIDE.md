# MongoDB Indexes Guide - Performance Optimization for Pryde Social

**Date:** 2026-01-11  
**Purpose:** Essential database indexes for optimal query performance

---

## 📊 Why Indexes Matter

Without proper indexes:
- ❌ Queries scan entire collections (slow)
- ❌ High CPU and memory usage
- ❌ Poor user experience (slow page loads)
- ❌ Higher costs (need bigger cluster)

With proper indexes:
- ✅ Queries find data instantly
- ✅ Low resource usage
- ✅ Fast user experience
- ✅ Lower costs (smaller cluster works)

---

## 🔍 Current Indexes Analysis

Let me check your existing models to recommend indexes...

### Users Collection

**Critical Indexes:**
```javascript
// 1. Email lookup (login, registration)
db.users.createIndex({ email: 1 }, { unique: true })

// 2. Username lookup (profile pages, mentions)
db.users.createIndex({ username: 1 }, { unique: true })

// 3. Active users query (exclude deleted/inactive)
db.users.createIndex({ isDeleted: 1, isActive: 1 })

// 4. Search users by name
db.users.createIndex({ firstName: "text", lastName: "text", username: "text" })

// 5. Last seen (for online status)
db.users.createIndex({ lastSeen: -1 })

// 6. Verification status
db.users.createIndex({ isVerified: 1 })
```

### Posts Collection

**Critical Indexes:**
```javascript
// 1. User's posts (profile page)
db.posts.createIndex({ userId: 1, createdAt: -1 })

// 2. Feed query (recent posts from followed users)
db.posts.createIndex({ userId: 1, createdAt: -1, visibility: 1 })

// 3. Post visibility and status
db.posts.createIndex({ visibility: 1, isDeleted: 1, createdAt: -1 })

// 4. Hashtag search
db.posts.createIndex({ hashtags: 1, createdAt: -1 })

// 5. Mentions
db.posts.createIndex({ mentions: 1, createdAt: -1 })

// 6. Popular posts (likes count)
db.posts.createIndex({ likesCount: -1, createdAt: -1 })

// 7. Text search
db.posts.createIndex({ content: "text", description: "text" })
```

### Comments Collection

**Critical Indexes:**
```javascript
// 1. Comments on a post
db.comments.createIndex({ postId: 1, createdAt: -1 })

// 2. User's comments
db.comments.createIndex({ userId: 1, createdAt: -1 })

// 3. Nested comments (replies)
db.comments.createIndex({ parentId: 1, createdAt: -1 })

// 4. Comment status
db.comments.createIndex({ isDeleted: 1, createdAt: -1 })
```

### Notifications Collection

**Critical Indexes:**
```javascript
// 1. User's notifications (most common query)
db.notifications.createIndex({ recipientId: 1, createdAt: -1 })

// 2. Unread notifications count
db.notifications.createIndex({ recipientId: 1, isRead: 1, createdAt: -1 })

// 3. Notification type filtering
db.notifications.createIndex({ recipientId: 1, type: 1, createdAt: -1 })

// 4. Cleanup old notifications (TTL index)
db.notifications.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7776000 }) // 90 days
```

### Messages Collection

**Critical Indexes:**
```javascript
// 1. Conversation messages
db.messages.createIndex({ conversationId: 1, createdAt: -1 })

// 2. User's messages
db.messages.createIndex({ senderId: 1, createdAt: -1 })

// 3. Unread messages
db.messages.createIndex({ recipientId: 1, isRead: 1, createdAt: -1 })

// 4. Message status
db.messages.createIndex({ isDeleted: 1, createdAt: -1 })
```

### Follows Collection

**Critical Indexes:**
```javascript
// 1. User's followers
db.follows.createIndex({ followingId: 1, createdAt: -1 })

// 2. User's following
db.follows.createIndex({ followerId: 1, createdAt: -1 })

// 3. Check if following (compound index)
db.follows.createIndex({ followerId: 1, followingId: 1 }, { unique: true })

// 4. Follow status
db.follows.createIndex({ status: 1, createdAt: -1 })
```

### Likes Collection

**Critical Indexes:**
```javascript
// 1. Post likes
db.likes.createIndex({ postId: 1, createdAt: -1 })

// 2. User's likes
db.likes.createIndex({ userId: 1, createdAt: -1 })

// 3. Check if liked (compound index)
db.likes.createIndex({ userId: 1, postId: 1 }, { unique: true })

// 4. Like type (post vs comment)
db.likes.createIndex({ targetType: 1, targetId: 1 })
```

---

## 🚀 How to Create Indexes

### Method 1: MongoDB Atlas UI (Recommended for beginners)

1. Go to MongoDB Atlas → Clusters → Browse Collections
2. Select your database (e.g., `pryde-social`)
3. Select a collection (e.g., `users`)
4. Click "Indexes" tab
5. Click "Create Index"
6. Enter index definition (e.g., `{ email: 1 }`)
7. Configure options (unique, sparse, etc.)
8. Click "Review" → "Confirm"

### Method 2: MongoDB Shell

```bash
# Connect to your cluster
mongosh "mongodb+srv://cluster.mongodb.net/pryde-social" --username YOUR_USERNAME

# Create indexes
use pryde-social

# Users indexes
db.users.createIndex({ email: 1 }, { unique: true })
db.users.createIndex({ username: 1 }, { unique: true })
db.users.createIndex({ isDeleted: 1, isActive: 1 })

# Posts indexes
db.posts.createIndex({ userId: 1, createdAt: -1 })
db.posts.createIndex({ visibility: 1, isDeleted: 1, createdAt: -1 })

# ... (continue with other indexes)
```

### Method 3: Automated Script (Best for production)

I'll create a script for you in the next file.

---

## 📈 Index Performance Tips

### 1. Index Direction Matters
```javascript
// For sorting in descending order (newest first)
{ createdAt: -1 }  // ✅ Correct

// For sorting in ascending order (oldest first)
{ createdAt: 1 }   // ✅ Correct
```

### 2. Compound Indexes
```javascript
// Query: Find user's posts, sorted by date
db.posts.find({ userId: "123" }).sort({ createdAt: -1 })

// Index should match query + sort order
db.posts.createIndex({ userId: 1, createdAt: -1 })  // ✅ Perfect

// Wrong order - less efficient
db.posts.createIndex({ createdAt: -1, userId: 1 })  // ❌ Suboptimal
```

### 3. Covered Queries
```javascript
// Query only indexed fields = super fast
db.users.find(
  { email: "user@example.com" },
  { _id: 1, email: 1, username: 1 }  // Only return indexed fields
)

// Index covers the entire query
db.users.createIndex({ email: 1, username: 1 })  // ✅ Covered query
```

### 4. Avoid Over-Indexing
```javascript
// ❌ Too many indexes = slow writes
// Each index must be updated on every write operation

// ✅ Only index fields you actually query
// Review slow query logs to identify needed indexes
```

---

## 🔍 Monitor Index Usage

### Check Index Usage (MongoDB Shell):
```javascript
// See which indexes are being used
db.posts.aggregate([
  { $indexStats: {} }
])

// Find unused indexes
db.posts.aggregate([
  { $indexStats: {} },
  { $match: { "accesses.ops": { $lt: 10 } } }
])
```

### MongoDB Atlas Performance Advisor:
1. Go to MongoDB Atlas → Clusters
2. Click "Performance Advisor" tab
3. Review recommended indexes
4. Click "Create Index" for suggestions

---

## ⚠️ Important Notes

### Index Size Limits:
- Maximum index key size: 1024 bytes
- Maximum indexes per collection: 64
- Text indexes: Only 1 per collection

### Index Building:
- Building indexes on large collections takes time
- Indexes are built in the background (non-blocking)
- Monitor progress in Atlas UI

### Index Maintenance:
- Review index usage monthly
- Drop unused indexes
- Rebuild fragmented indexes

---

**Next:** See `scripts/create-indexes.js` for automated index creation

