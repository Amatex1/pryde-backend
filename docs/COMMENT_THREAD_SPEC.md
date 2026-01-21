# PHASE 10: COMMENT SYSTEM UX & DATA MODEL SPEC
**Pryde Social - Comment Threading Specification**  
**Date:** 2026-01-12  
**Scope:** Define threading rules, depth limits, and UX requirements BEFORE redesign

---

## EXECUTIVE SUMMARY

**Current Implementation:** ✅ 1-level nesting (comments + replies)  
**Proposed Implementation:** ✅ 3-4 level nesting (configurable)  
**Data Model:** ⚠️ NEEDS ENHANCEMENT (add threadRootId, depth)  
**UX Strategy:** Calm-first, scannable, mobile-optimized

---

## CURRENT STATE AUDIT

### Data Model (Comment.js)
```javascript
{
  _id: ObjectId,
  postId: ObjectId (ref: Post),
  authorId: ObjectId (ref: User),
  content: String (max: 1000),
  gifUrl: String,
  parentCommentId: ObjectId (ref: Comment), // ✅ EXISTS
  reactions: Map<emoji, [userId]>,
  likeCount: Number,
  isEdited: Boolean,
  editedAt: Date,
  isDeleted: Boolean,
  isPinned: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Current Limitations
| Feature | Status | Notes |
|---------|--------|-------|
| `parentCommentId` | ✅ EXISTS | Supports 1-level nesting |
| `threadRootId` | ❌ MISSING | Needed for efficient thread queries |
| `depth` | ❌ MISSING | Needed for UI rendering and depth limits |
| Max depth enforcement | ✅ ENFORCED | Currently 1 level (replies cannot have replies) |
| Reply count virtual | ✅ EXISTS | Calculated on demand |

### Current Backend Logic (comments.js)
```javascript
// Enforce 1-level nesting: replies cannot have replies
if (parentComment.parentCommentId !== null) {
  return sendError(res, HttpStatus.BAD_REQUEST, 
    'Cannot reply to a reply. Only one level of nesting allowed.');
}
```

**Verdict:** ✅ CURRENT IMPLEMENTATION IS SAFE (1-level nesting enforced)

---

## PROPOSED DATA MODEL

### Enhanced Comment Schema
```javascript
{
  _id: ObjectId,
  postId: ObjectId (ref: Post),
  authorId: ObjectId (ref: User),
  content: String (max: 1000),
  gifUrl: String,
  
  // THREADING FIELDS
  parentCommentId: ObjectId (ref: Comment) | null,  // ✅ KEEP
  threadRootId: ObjectId (ref: Comment) | null,     // ➕ ADD
  depth: Number (default: 0),                       // ➕ ADD
  
  // METADATA
  reactions: Map<emoji, [userId]>,
  likeCount: Number,
  isEdited: Boolean,
  editedAt: Date,
  isDeleted: Boolean,
  isPinned: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Field Definitions

#### `parentCommentId`
- **Type:** ObjectId | null
- **Purpose:** Direct parent of this comment
- **Rules:**
  - `null` for top-level comments
  - Points to immediate parent for replies

#### `threadRootId` (NEW)
- **Type:** ObjectId | null
- **Purpose:** Root comment of the entire thread
- **Rules:**
  - `null` for top-level comments
  - Points to top-level comment for all replies (regardless of depth)
  - Enables efficient "load all replies in thread" queries

#### `depth` (NEW)
- **Type:** Number
- **Purpose:** Nesting level for UI rendering
- **Rules:**
  - `0` for top-level comments
  - `1` for direct replies to top-level
  - `2` for replies to replies
  - `3` for max depth (configurable)

---

## THREADING RULES

### Max Depth Configuration
```javascript
const MAX_COMMENT_DEPTH = 3; // Configurable (3-4 recommended)
```

### Depth Calculation Logic
```javascript
async function calculateDepth(parentCommentId) {
  if (!parentCommentId) return 0; // Top-level comment
  
  const parentComment = await Comment.findById(parentCommentId);
  if (!parentComment) throw new Error('Parent comment not found');
  
  return parentComment.depth + 1;
}
```

### Thread Root Calculation Logic
```javascript
async function calculateThreadRoot(parentCommentId) {
  if (!parentCommentId) return null; // Top-level comment
  
  const parentComment = await Comment.findById(parentCommentId);
  if (!parentComment) throw new Error('Parent comment not found');
  
  // If parent is top-level, it's the root
  if (parentComment.depth === 0) return parentComment._id;
  
  // Otherwise, use parent's threadRootId
  return parentComment.threadRootId;
}
```

### Max Depth Enforcement
```javascript
// In POST /api/posts/:postId/comments
if (parentCommentId) {
  const parentComment = await Comment.findById(parentCommentId);
  
  // Enforce max depth
  if (parentComment.depth >= MAX_COMMENT_DEPTH) {
    return sendError(res, HttpStatus.BAD_REQUEST, 
      `Maximum comment depth (${MAX_COMMENT_DEPTH}) reached. ` +
      `Reply to a higher-level comment instead.`);
  }
}
```

### Depth-Beyond-Max Behavior
**Option 1 (Recommended):** Reject with error message  
**Option 2:** Attach to last allowed parent (flatten)  
**Option 3:** Attach to thread root (flatten completely)

**Decision:** Use Option 1 (reject) for clarity and simplicity

---

## UI RENDERING RULES

### Indentation Strategy
```css
.comment {
  margin-left: 0; /* Depth 0 */
}

.comment[data-depth="1"] {
  margin-left: 32px; /* 2rem */
}

.comment[data-depth="2"] {
  margin-left: 64px; /* 4rem */
}

.comment[data-depth="3"] {
  margin-left: 96px; /* 6rem */
}

/* Mobile: Reduced indentation */
@media (max-width: 768px) {
  .comment[data-depth="1"] {
    margin-left: 16px; /* 1rem */
  }
  
  .comment[data-depth="2"] {
    margin-left: 32px; /* 2rem */
  }
  
  .comment[data-depth="3"] {
    margin-left: 48px; /* 3rem */
  }
}
```

### Visual Hierarchy
| Depth | Font Size | Avatar Size | Indentation (Desktop) | Indentation (Mobile) |
|-------|-----------|-------------|----------------------|---------------------|
| 0 | 15px | 40px | 0px | 0px |
| 1 | 14px | 36px | 32px | 16px |
| 2 | 13px | 32px | 64px | 32px |
| 3 | 13px | 32px | 96px | 48px |

### Collapse/Expand Controls
```jsx
// Show "View X replies" for comments with replies
{comment.replyCount > 0 && (
  <button
    className="view-replies-btn"
    onClick={() => toggleReplies(comment._id)}
  >
    {showReplies[comment._id]
      ? `Hide ${comment.replyCount} ${comment.replyCount === 1 ? 'reply' : 'replies'}`
      : `View ${comment.replyCount} ${comment.replyCount === 1 ? 'reply' : 'replies'}`
    }
  </button>
)}
```

### Reply Button Placement
```jsx
// Reply button anchored to parent comment
<div className="comment-actions">
  <button
    className="reply-btn"
    onClick={() => setReplyingTo(comment._id)}
  >
    Reply
  </button>
</div>
```

---

## UX GOALS

### 1. Visual Hierarchy Clarity
- ✅ Depth-based indentation (not connecting lines)
- ✅ Smaller avatars for deeper replies
- ✅ Subtle font size reduction for replies
- ✅ Clear visual separation between threads

### 2. Cognitive Load Reduction
- ✅ Collapsed replies by default (show count)
- ✅ "View X replies" button to expand
- ✅ Max depth limit prevents infinite nesting
- ✅ No visual noise (no lines, no excessive borders)

### 3. Thread Scannability
- ✅ Top-level comments easy to scan
- ✅ Replies visually subordinate but readable
- ✅ Clear "Reply" button on each comment
- ✅ Timestamp and author always visible

### 4. Mobile Readability
- ✅ Reduced indentation on mobile (16px/32px/48px)
- ✅ Vertical stacking (no horizontal scroll)
- ✅ Touch-friendly buttons (44px minimum)
- ✅ Readable font sizes (13px minimum)

### 5. Deep-Thread Safety
- ✅ Max depth enforced (3-4 levels)
- ✅ Clear error message when max depth reached
- ✅ No horizontal scroll on deep threads
- ✅ Graceful degradation on narrow screens

### 6. Calm-First Design
- ✅ No connecting lines (visual noise)
- ✅ Subtle indentation (not aggressive)
- ✅ Collapsed by default (reduce overwhelm)
- ✅ Soft colors (no harsh borders)

---

## EXPLICIT NON-GOALS

### ❌ Facebook Visual Cloning
- No connecting lines between comments
- No aggressive indentation
- No complex visual hierarchy

### ❌ Infinite Nesting
- Max depth: 3-4 levels
- No "load more" for deeper threads
- No pagination within threads

### ❌ Auto-Expansion
- Replies collapsed by default
- User must click "View X replies" to expand
- No auto-expand on page load

---

## IMPLEMENTATION PLAN

### Phase 1: Data Model Migration
1. Add `threadRootId` field to Comment schema
2. Add `depth` field to Comment schema
3. Create migration script to populate existing comments
4. Add indexes for efficient queries

### Phase 2: Backend Logic Update
1. Update comment creation logic to calculate depth
2. Update comment creation logic to calculate threadRootId
3. Enforce max depth limit (3-4 levels)
4. Update comment query logic to include depth

### Phase 3: Frontend UI Update
1. Add depth-based indentation CSS
2. Add collapse/expand controls
3. Add "View X replies" button
4. Update mobile styles for reduced indentation

### Phase 4: Testing
1. Test max depth enforcement
2. Test collapse/expand functionality
3. Test mobile responsiveness
4. Test deep thread rendering

---

## DATABASE MIGRATION SCRIPT

```javascript
// scripts/migrateCommentDepth.js
import mongoose from 'mongoose';
import Comment from '../models/Comment.js';

async function migrateCommentDepth() {
  console.log('🔄 Migrating comment depth and threadRootId...');

  // Get all top-level comments
  const topLevelComments = await Comment.find({
    parentCommentId: null
  });

  console.log(`Found ${topLevelComments.length} top-level comments`);

  for (const comment of topLevelComments) {
    // Set depth to 0 for top-level comments
    comment.depth = 0;
    comment.threadRootId = null;
    await comment.save();

    // Recursively update replies
    await updateReplies(comment._id, comment._id, 1);
  }

  console.log('✅ Migration complete');
}

async function updateReplies(parentId, threadRootId, depth) {
  const replies = await Comment.find({ parentCommentId: parentId });

  for (const reply of replies) {
    reply.depth = depth;
    reply.threadRootId = threadRootId;
    await reply.save();

    // Recursively update nested replies
    await updateReplies(reply._id, threadRootId, depth + 1);
  }
}

migrateCommentDepth()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
```

---

## QUERY OPTIMIZATION

### Efficient Thread Loading
```javascript
// Load all comments in a thread (single query)
const threadComments = await Comment.find({
  $or: [
    { _id: threadRootId },
    { threadRootId: threadRootId }
  ]
})
.populate('authorId', 'username displayName profilePhoto isVerified')
.sort({ createdAt: 1 });
```

### Index for Performance
```javascript
// In Comment.js schema
commentSchema.index({ threadRootId: 1, createdAt: 1 });
commentSchema.index({ postId: 1, depth: 1, createdAt: 1 });
```

---

## FINAL VERDICT

**Current Implementation:** ✅ SAFE (1-level nesting enforced)
**Proposed Implementation:** ✅ WELL-DEFINED (3-4 level nesting)
**Data Model:** ⚠️ NEEDS MIGRATION (add threadRootId, depth)
**UX Strategy:** ✅ CALM-FIRST, MOBILE-OPTIMIZED
**Implementation Complexity:** ⚠️ MEDIUM (requires migration + UI update)

**Recommendation:** Implement in phases, test thoroughly before deployment

---

## NEXT STEPS

1. Review and approve this spec
2. Create migration script
3. Test migration on staging database
4. Update backend comment creation logic
5. Update frontend UI components
6. Test on mobile and desktop
7. Deploy to production

