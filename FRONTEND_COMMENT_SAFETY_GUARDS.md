# Frontend Comment Safety Guards

**Date:** 2026-01-12  
**Objective:** Prevent UI from violating backend invariants  
**Scope:** Comment flow safety guards and invariant checks  
**Status:** READY FOR IMPLEMENTATION

---

## OVERVIEW

This specification ensures the frontend comment UI mirrors backend guarantees:
- ✅ No duplicate comment renders
- ✅ Deleted parents hide orphaned replies
- ✅ Depth clamped to backend rules
- ✅ Invariant violations logged (dev only)

---

## GUARD 1: DUPLICATE COMMENT PREVENTION

### Problem
Socket reconnects or race conditions can cause duplicate comments to render.

### Solution

Create `src/utils/commentDeduplication.js`:

````javascript
/**
 * Comment Deduplication Guard
 * Prevents duplicate comments from rendering
 */

class CommentDeduplicationGuard {
  constructor() {
    this.seenComments = new Set();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.cache = new Map(); // commentId -> timestamp
  }

  /**
   * Check if comment has been seen recently
   * @param {string} commentId - Comment ID
   * @returns {boolean} - True if duplicate, false if new
   */
  isDuplicate(commentId) {
    const now = Date.now();
    
    // Clean old entries
    for (const [id, timestamp] of this.cache.entries()) {
      if (now - timestamp > this.cacheTimeout) {
        this.cache.delete(id);
        this.seenComments.delete(id);
      }
    }
    
    // Check if seen
    if (this.seenComments.has(commentId)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[CommentDedup] Duplicate comment blocked:', commentId);
      }
      return true;
    }
    
    // Mark as seen
    this.seenComments.add(commentId);
    this.cache.set(commentId, now);
    return false;
  }

  /**
   * Filter duplicate comments from array
   * @param {Array} comments - Array of comment objects
   * @returns {Array} - Deduplicated comments
   */
  filterDuplicates(comments) {
    return comments.filter(comment => !this.isDuplicate(comment._id));
  }

  /**
   * Clear cache (for testing)
   */
  clear() {
    this.seenComments.clear();
    this.cache.clear();
  }
}

// Singleton instance
export const commentDedupGuard = new CommentDeduplicationGuard();
````

### Usage in Feed.jsx

````javascript
import { commentDedupGuard } from '../utils/commentDeduplication';

// In useEffect or socket handler
useEffect(() => {
  socket.on('comment:new', (newComment) => {
    // Deduplicate before adding to state
    if (!commentDedupGuard.isDuplicate(newComment._id)) {
      setPostComments(prev => ({
        ...prev,
        [newComment.postId]: [...(prev[newComment.postId] || []), newComment]
      }));
    }
  });
}, []);
````

---

## GUARD 2: DELETED PARENT HANDLING

### Problem
If a parent comment is deleted, orphaned replies should be hidden.

### Solution

Create `src/utils/commentFiltering.js`:

````javascript
/**
 * Comment Filtering Utilities
 * Handles deleted comments and orphaned replies
 */

/**
 * Filter out orphaned replies (replies whose parent is deleted)
 * @param {Array} comments - All comments
 * @param {Array} replies - All replies
 * @returns {Object} - { validComments, validReplies }
 */
export function filterOrphanedReplies(comments, replies) {
  // Get IDs of non-deleted parent comments
  const validParentIds = new Set(
    comments
      .filter(c => !c.isDeleted)
      .map(c => c._id)
  );
  
  // Filter replies to only include those with valid parents
  const validReplies = replies.filter(reply => {
    const hasValidParent = validParentIds.has(reply.parentCommentId);
    
    if (!hasValidParent && process.env.NODE_ENV === 'development') {
      console.warn('[CommentFilter] Orphaned reply hidden:', reply._id);
    }
    
    return hasValidParent;
  });
  
  return {
    validComments: comments,
    validReplies
  };
}

/**
 * Check if comment should be rendered
 * @param {Object} comment - Comment object
 * @returns {boolean} - True if should render
 */
export function shouldRenderComment(comment) {
  // Deleted comments show placeholder
  if (comment.isDeleted) {
    return true; // Render placeholder
  }
  
  // Check if author exists
  if (!comment.authorId) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[CommentFilter] Comment missing author:', comment._id);
    }
    return false;
  }
  
  return true;
}
````

### Usage in Feed.jsx

````javascript
import { filterOrphanedReplies, shouldRenderComment } from '../utils/commentFiltering';

// When rendering comments
const renderComments = () => {
  const allComments = postComments[post._id] || [];
  const allReplies = commentReplies[comment._id] || [];
  
  // Filter orphaned replies
  const { validComments, validReplies } = filterOrphanedReplies(allComments, allReplies);
  
  return validComments
    .filter(shouldRenderComment)
    .map(comment => (
      <CommentThread
        key={comment._id}
        comment={comment}
        replies={validReplies}
        // ... other props
      />
    ));
};
````

---

## GUARD 3: DEPTH CLAMPING

### Problem
Backend enforces max depth of 3, but frontend might try to render deeper.

### Solution

Create `src/utils/commentDepth.js`:

````javascript
/**
 * Comment Depth Utilities
 * Ensures depth never exceeds backend limits
 */

const MAX_DEPTH = 3;

/**
 * Clamp depth to maximum allowed
 * @param {number} depth - Current depth
 * @returns {number} - Clamped depth
 */
export function clampDepth(depth) {
  const clamped = Math.min(Math.max(0, depth), MAX_DEPTH);
  
  if (clamped !== depth && process.env.NODE_ENV === 'development') {
    console.warn('[DepthGuard] Depth clamped:', { original: depth, clamped });
  }
  
  return clamped;
}

/**
 * Check if can reply at current depth
 * @param {number} depth - Current depth
 * @returns {boolean} - True if can reply
 */
export function canReplyAtDepth(depth) {
  return depth < MAX_DEPTH;
}

/**
 * Get indentation for depth (desktop)
 * @param {number} depth - Current depth
 * @returns {number} - Indentation in pixels
 */
export function getIndentation(depth, isMobile = false) {
  const clampedDepth = clampDepth(depth);
  const baseIndent = isMobile ? 16 : 32;
  return clampedDepth * baseIndent;
}
````

### Usage in CommentThread.jsx

````javascript
import { clampDepth, canReplyAtDepth } from '../utils/commentDepth';

const CommentThread = ({ comment, depth = 0, maxDepth = 3 }) => {
  // Clamp depth to prevent violations
  const safeDepth = clampDepth(depth);
  const canReply = canReplyAtDepth(safeDepth);
  
  return (
    <div className="comment-thread" data-depth={safeDepth}>
      {/* Comment content */}
      
      {canReply && (
        <button onClick={() => handleReply()}>Reply</button>
      )}
      
      {!canReply && (
        <p className="max-depth-notice">Maximum reply depth reached</p>
      )}
    </div>
  );
};
````

---

## GUARD 4: INVARIANT VIOLATION LOGGING

### Problem
Need to detect when frontend state violates backend invariants.

### Solution

Create `src/utils/commentInvariantLogger.js`:

````javascript
/**
 * Comment Invariant Logger
 * Logs violations in development mode
 */

const isDev = process.env.NODE_ENV === 'development';

/**
 * Log invariant violation
 * @param {string} violation - Violation type
 * @param {Object} data - Violation data
 */
function logViolation(violation, data) {
  if (!isDev) return;
  
  console.group(`[Invariant Violation] ${violation}`);
  console.error('Violation:', violation);
  console.error('Data:', data);
  console.trace();
  console.groupEnd();
}

/**
 * Check comment invariants
 * @param {Object} comment - Comment object
 */
export function checkCommentInvariants(comment) {
  if (!isDev) return;
  
  // Check: Comment must have ID
  if (!comment._id) {
    logViolation('MISSING_ID', { comment });
  }
  
  // Check: Comment must have author
  if (!comment.authorId) {
    logViolation('MISSING_AUTHOR', { comment });
  }
  
  // Check: Comment must have content or be deleted
  if (!comment.content && !comment.isDeleted) {
    logViolation('MISSING_CONTENT', { comment });
  }
  
  // Check: Reply must have parent
  if (comment.parentCommentId && !comment.postId) {
    logViolation('ORPHANED_REPLY', { comment });
  }
}

/**
 * Check depth invariants
 * @param {number} depth - Current depth
 * @param {number} maxDepth - Maximum allowed depth
 */
export function checkDepthInvariants(depth, maxDepth = 3) {
  if (!isDev) return;
  
  if (depth > maxDepth) {
    logViolation('DEPTH_EXCEEDED', { depth, maxDepth });
  }
  
  if (depth < 0) {
    logViolation('NEGATIVE_DEPTH', { depth });
  }
}
````

### Usage

````javascript
import { checkCommentInvariants, checkDepthInvariants } from '../utils/commentInvariantLogger';

// In CommentThread component
useEffect(() => {
  checkCommentInvariants(comment);
  checkDepthInvariants(depth, maxDepth);
}, [comment, depth, maxDepth]);
````

---

## ACCEPTANCE CRITERIA

✅ **Duplicate Prevention**
- Duplicate comments blocked
- 5-minute cache window
- Dev logging enabled

✅ **Deleted Parent Handling**
- Orphaned replies hidden
- Deleted comments show placeholder
- Missing authors handled

✅ **Depth Clamping**
- Depth never exceeds 3
- Reply button hidden at max depth
- Indentation clamped

✅ **Invariant Logging**
- Violations logged in dev
- No production overhead
- Stack traces included

---

**Status:** ✅ READY FOR IMPLEMENTATION  
**Estimated Time:** 1-2 hours  
**Risk Level:** LOW (safety guards only)

