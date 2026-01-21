# Frontend Comment UI Implementation Spec

**Date:** 2026-01-12  
**Objective:** Implement calm-first, readable comment threading UI  
**Based on:** COMMENT_THREAD_SPEC.md

---

## VISUAL DESIGN PRINCIPLES

### 1. Calm-First Design
- ✅ Depth-based spacing (no connecting lines)
- ✅ Subtle visual hierarchy
- ✅ Collapsed replies by default
- ✅ No layout shift on expand

### 2. Mobile-First Responsive
- ✅ Reduced indentation on mobile
- ✅ Touch-safe tap targets (44px minimum)
- ✅ No horizontal scroll at any depth
- ✅ Readable font sizes (13px minimum)

### 3. Accessibility
- ✅ Semantic HTML (button, article, nav)
- ✅ ARIA labels for screen readers
- ✅ Keyboard navigation support
- ✅ Focus indicators visible

---

## CSS IMPLEMENTATION

### Base Comment Styles

```css
/* Base comment container */
.comment {
  position: relative;
  padding: 12px 0;
  transition: background-color 0.2s ease;
}

.comment:hover {
  background-color: rgba(0, 0, 0, 0.02);
}

/* Comment content wrapper */
.comment-content {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

/* Avatar sizing by depth */
.comment[data-depth="0"] .comment-avatar {
  width: 40px;
  height: 40px;
}

.comment[data-depth="1"] .comment-avatar,
.comment[data-depth="2"] .comment-avatar,
.comment[data-depth="3"] .comment-avatar {
  width: 32px;
  height: 32px;
}

/* Text sizing by depth */
.comment[data-depth="0"] .comment-text {
  font-size: 15px;
  line-height: 1.5;
}

.comment[data-depth="1"] .comment-text,
.comment[data-depth="2"] .comment-text,
.comment[data-depth="3"] .comment-text {
  font-size: 14px;
  line-height: 1.4;
}

/* Depth-based indentation - Desktop */
@media (min-width: 768px) {
  .comment[data-depth="1"] {
    margin-left: 32px;
  }
  
  .comment[data-depth="2"] {
    margin-left: 64px;
  }
  
  .comment[data-depth="3"] {
    margin-left: 96px;
  }
}

/* Depth-based indentation - Mobile */
@media (max-width: 767px) {
  .comment[data-depth="1"] {
    margin-left: 16px;
  }
  
  .comment[data-depth="2"] {
    margin-left: 32px;
  }
  
  .comment[data-depth="3"] {
    margin-left: 48px;
  }
}

/* Comment actions */
.comment-actions {
  display: flex;
  gap: 16px;
  margin-top: 8px;
  align-items: center;
}

.comment-action-btn {
  background: none;
  border: none;
  color: #65676b;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
  min-height: 44px; /* Touch-safe */
  min-width: 44px; /* Touch-safe */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease;
}

.comment-action-btn:hover {
  color: #050505;
  text-decoration: underline;
}

.comment-action-btn:focus-visible {
  outline: 2px solid #1877f2;
  outline-offset: 2px;
  border-radius: 4px;
}

/* View replies button */
.view-replies-btn {
  background: none;
  border: none;
  color: #65676b;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 8px 12px;
  min-height: 44px; /* Touch-safe */
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  transition: all 0.2s ease;
}

.view-replies-btn:hover {
  color: #050505;
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
}

.view-replies-btn:focus-visible {
  outline: 2px solid #1877f2;
  outline-offset: 2px;
  border-radius: 4px;
}

/* Replies container */
.comment-replies {
  margin-top: 8px;
}

/* Max depth indicator */
.max-depth-notice {
  font-size: 13px;
  color: #65676b;
  font-style: italic;
  margin-top: 8px;
  padding: 8px 12px;
  background-color: rgba(0, 0, 0, 0.03);
  border-radius: 4px;
}
```

---

## COMPONENT STRUCTURE

### React Component Example

```jsx
const Comment = ({ comment, depth = 0, maxDepth = 3 }) => {
  const [showReplies, setShowReplies] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  
  const canReply = depth < maxDepth;
  const hasReplies = comment.replyCount > 0;
  
  return (
    <article 
      className="comment" 
      data-depth={depth}
      aria-label={`Comment by ${comment.author.username}`}
    >
      <div className="comment-content">
        <img 
          src={comment.author.avatar} 
          alt={comment.author.username}
          className="comment-avatar"
        />
        
        <div className="comment-body">
          <div className="comment-header">
            <span className="comment-author">{comment.author.username}</span>
            <span className="comment-timestamp">{formatTime(comment.createdAt)}</span>
          </div>
          
          <p className="comment-text">{comment.content}</p>
          
          <div className="comment-actions">
            {canReply && (
              <button 
                className="comment-action-btn"
                onClick={() => setIsReplying(!isReplying)}
                aria-label="Reply to comment"
              >
                Reply
              </button>
            )}
            
            <button 
              className="comment-action-btn"
              aria-label="Like comment"
            >
              Like
            </button>
          </div>
          
          {!canReply && (
            <p className="max-depth-notice">
              Maximum reply depth reached
            </p>
          )}
          
          {isReplying && (
            <CommentForm 
              parentId={comment._id}
              onCancel={() => setIsReplying(false)}
              onSubmit={() => setIsReplying(false)}
            />
          )}
        </div>
      </div>
      
      {hasReplies && (
        <>
          <button
            className="view-replies-btn"
            onClick={() => setShowReplies(!showReplies)}
            aria-expanded={showReplies}
            aria-label={`${showReplies ? 'Hide' : 'View'} ${comment.replyCount} replies`}
          >
            {showReplies ? '▼' : '▶'} 
            {showReplies 
              ? `Hide ${comment.replyCount} ${comment.replyCount === 1 ? 'reply' : 'replies'}`
              : `View ${comment.replyCount} ${comment.replyCount === 1 ? 'reply' : 'replies'}`
            }
          </button>
          
          {showReplies && (
            <div className="comment-replies">
              {comment.replies.map(reply => (
                <Comment 
                  key={reply._id}
                  comment={reply}
                  depth={depth + 1}
                  maxDepth={maxDepth}
                />
              ))}
            </div>
          )}
        </>
      )}
    </article>
  );
};
```

---

## ACCEPTANCE CRITERIA

✅ **Visual Hierarchy**
- Depth-based spacing (not lines)
- Smaller avatars for replies (40px → 32px)
- Slightly reduced font size (15px → 14px)

✅ **Interaction**
- Reply button anchored to parent
- Collapse/expand with "View X replies"
- Max depth enforced visually

✅ **Mobile**
- Reduced indentation (16px/32px/48px)
- No horizontal scroll
- Touch-safe buttons (44px minimum)

✅ **Accessibility**
- Semantic HTML
- ARIA labels
- Keyboard navigation
- Focus indicators

✅ **Performance**
- No layout shift on expand
- Smooth transitions
- Efficient re-renders

---

## TESTING CHECKLIST

- [ ] Test at all depths (0, 1, 2, 3)
- [ ] Test with long text content
- [ ] Test with emoji-only content
- [ ] Test on mobile (320px - 480px)
- [ ] Test on tablet (600px - 900px)
- [ ] Test on desktop (1024px+)
- [ ] Test portrait ↔ landscape
- [ ] Test keyboard navigation
- [ ] Test screen reader
- [ ] Test expand/collapse
- [ ] Test max depth message

---

**Status:** Ready for implementation  
**Next Step:** Apply CSS and component structure to frontend

