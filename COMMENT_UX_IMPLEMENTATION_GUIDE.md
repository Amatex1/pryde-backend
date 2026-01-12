# Comment UX Implementation Guide — CALM-FIRST

**Date:** 2026-01-12  
**Objective:** Ship calm, readable, mobile-safe comment threading UI  
**Scope:** Frontend-only UX improvements (no backend changes)  
**Status:** READY FOR IMPLEMENTATION

---

## OVERVIEW

This guide provides step-by-step instructions to implement calm-first comment threading in the Pryde Social frontend.

**Key Principles:**
- ✅ Depth-based spacing (not connecting lines)
- ✅ Collapsed replies by default
- ✅ Mobile-optimized indentation
- ✅ No layout shift on expand/collapse
- ✅ Touch-safe tap targets (44px minimum)

---

## STEP 1: UPDATE CommentThread.jsx

### Current Structure
The `CommentThread` component currently renders:
- Parent comment
- Replies (one level deep)
- Reply button
- Reaction buttons

### Required Changes

#### 1.1 Add Depth Tracking

<augment_code_snippet path="src/components/CommentThread.jsx" mode="EXCERPT">
````jsx
const CommentThread = ({
  comment,
  replies = [],
  currentUser,
  postId,
  depth = 0,  // ADD THIS
  maxDepth = 3,  // ADD THIS
  // ... other props
}) => {
  const canReply = depth < maxDepth;  // ADD THIS
  
  // ... rest of component
};
````
</augment_code_snippet>

#### 1.2 Add Collapse/Expand State

<augment_code_snippet path="src/components/CommentThread.jsx" mode="EXCERPT">
````jsx
const CommentThread = ({ comment, replies, ... }) => {
  const [showReplies, setShowReplies] = useState(false);  // ADD THIS
  const hasReplies = replies && replies.length > 0;  // ADD THIS
  
  // ... rest of component
};
````
</augment_code_snippet>

#### 1.3 Update Comment Container

<augment_code_snippet path="src/components/CommentThread.jsx" mode="EXCERPT">
````jsx
return (
  <div 
    className="comment-thread" 
    data-depth={depth}  // ADD THIS
  >
    <div className="comment">
      {/* Existing comment content */}
    </div>
    
    {/* ADD: Collapse/Expand Button */}
    {hasReplies && (
      <button
        className="view-replies-btn"
        onClick={() => setShowReplies(!showReplies)}
        aria-expanded={showReplies}
        aria-label={`${showReplies ? 'Hide' : 'View'} ${replies.length} replies`}
      >
        <span className="reply-icon">{showReplies ? '▼' : '▶'}</span>
        {showReplies 
          ? `Hide ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`
          : `View ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`
        }
      </button>
    )}
    
    {/* UPDATE: Conditional Replies Rendering */}
    {showReplies && hasReplies && (
      <div className="comment-replies">
        {replies.map(reply => (
          <CommentThread
            key={reply._id}
            comment={reply}
            replies={[]}  // Replies to replies (if depth allows)
            depth={depth + 1}  // INCREMENT DEPTH
            maxDepth={maxDepth}
            {...otherProps}
          />
        ))}
      </div>
    )}
  </div>
);
````
</augment_code_snippet>

#### 1.4 Add Max Depth Indicator

<augment_code_snippet path="src/components/CommentThread.jsx" mode="EXCERPT">
````jsx
{/* In comment actions section */}
<div className="comment-actions">
  {canReply ? (
    <button 
      className="comment-action-btn reply-btn"
      onClick={() => handleReplyToComment(postId, comment._id)}
    >
      💬 Reply
    </button>
  ) : (
    <p className="max-depth-notice">
      Maximum reply depth reached
    </p>
  )}
  {/* Other action buttons */}
</div>
````
</augment_code_snippet>

---

## STEP 2: ADD CSS STYLES

Create or update `src/styles/comments.css`:

### 2.1 Base Comment Styles

````css
/* Comment Thread Container */
.comment-thread {
  margin-bottom: 12px;
}

/* Depth-based indentation */
.comment-thread[data-depth="0"] {
  margin-left: 0;
}

.comment-thread[data-depth="1"] {
  margin-left: 32px;
}

.comment-thread[data-depth="2"] {
  margin-left: 64px;
}

.comment-thread[data-depth="3"] {
  margin-left: 96px;
}

/* Mobile: Reduced indentation */
@media (max-width: 767px) {
  .comment-thread[data-depth="1"] {
    margin-left: 16px;
  }
  
  .comment-thread[data-depth="2"] {
    margin-left: 32px;
  }
  
  .comment-thread[data-depth="3"] {
    margin-left: 48px;
  }
}
````

### 2.2 Comment Content Styles

````css
/* Comment Container */
.comment {
  display: flex;
  gap: 12px;
  padding: 12px;
  background-color: #f0f2f5;
  border-radius: 8px;
}

/* Avatar Sizing by Depth */
.comment-thread[data-depth="0"] .comment-avatar {
  width: 40px;
  height: 40px;
}

.comment-thread[data-depth="1"] .comment-avatar,
.comment-thread[data-depth="2"] .comment-avatar,
.comment-thread[data-depth="3"] .comment-avatar {
  width: 32px;
  height: 32px;
}

/* Font Sizing by Depth */
.comment-thread[data-depth="0"] .comment-text {
  font-size: 15px;
  line-height: 1.5;
}

.comment-thread[data-depth="1"] .comment-text,
.comment-thread[data-depth="2"] .comment-text,
.comment-thread[data-depth="3"] .comment-text {
  font-size: 14px;
  line-height: 1.4;
}
````

### 2.3 View Replies Button

````css
/* View Replies Button */
.view-replies-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin: 8px 0 8px 52px;  /* Align with comment text */
  background: none;
  border: none;
  color: #65676b;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;
  min-height: 44px;  /* Touch-safe */
}

.view-replies-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.view-replies-btn:focus {
  outline: 2px solid #1877f2;
  outline-offset: 2px;
}

.reply-icon {
  font-size: 12px;
  transition: transform 0.2s;
}

/* Mobile: Full width button */
@media (max-width: 767px) {
  .view-replies-btn {
    width: 100%;
    justify-content: center;
    margin-left: 0;
  }
}
````

### 2.4 Max Depth Notice

````css
/* Max Depth Notice */
.max-depth-notice {
  font-size: 13px;
  color: #65676b;
  font-style: italic;
  margin: 8px 0;
  padding: 8px 12px;
  background-color: rgba(0, 0, 0, 0.03);
  border-radius: 4px;
}
````

### 2.5 Comment Replies Container

````css
/* Replies Container */
.comment-replies {
  margin-top: 8px;
}

/* Prevent layout shift on expand */
.comment-replies {
  animation: fadeIn 0.2s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
````

---

## STEP 3: UPDATE Feed.jsx AND Profile.jsx

Pass depth props to CommentThread:

````jsx
{postComments[post._id]
  .filter(comment => comment.parentCommentId === null || comment.parentCommentId === undefined)
  .slice(-3)
  .map((comment) => (
    <CommentThread
      key={comment._id}
      comment={comment}
      replies={commentReplies[comment._id] || []}
      depth={0}  // ADD THIS
      maxDepth={3}  // ADD THIS
      currentUser={currentUser}
      postId={post._id}
      // ... other props
    />
  ))}
````

---

## STEP 4: TESTING CHECKLIST

### Visual Testing
- [ ] Comments at depth 0 have 40px avatars
- [ ] Comments at depth 1-3 have 32px avatars
- [ ] Indentation increases correctly
- [ ] "View X replies" button visible
- [ ] Replies collapsed by default
- [ ] No layout shift on expand/collapse
- [ ] Max depth notice at depth 3

### Responsive Testing
- [ ] Mobile (320px - 480px)
- [ ] Tablet (600px - 900px)
- [ ] Desktop (1024px+)
- [ ] No horizontal scroll
- [ ] Tap targets 44px minimum

### Accessibility Testing
- [ ] ARIA labels present
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] Screen reader compatible

---

## ACCEPTANCE CRITERIA

✅ Depth-based spacing implemented
✅ Collapse/expand functionality working
✅ Mobile-optimized indentation
✅ Touch-safe tap targets (44px)
✅ Max depth enforced (3 levels)
✅ No layout shift on expand
✅ Accessibility compliant

---

**Status:** ✅ READY FOR IMPLEMENTATION
**Estimated Time:** 2-3 hours
**Risk Level:** LOW (frontend-only)

