# Orientation & Stress Testing Specification

**Date:** 2026-01-12  
**Objective:** Test rotation, extreme aspect ratios, and edge cases  
**Scope:** Ensure UI remains readable and calm under all conditions

---

## ORIENTATION TESTING

### Portrait ↔ Landscape Transitions

#### Test Scenarios

1. **Rotate while viewing feed**
   - ✅ Content reflows smoothly
   - ✅ No layout shift
   - ✅ Scroll position maintained
   - ✅ No clipped UI elements

2. **Rotate while modal is open**
   - ✅ Modal remains centered
   - ✅ Modal fits new viewport
   - ✅ Content scrollable if needed
   - ✅ Close button accessible

3. **Rotate while typing**
   - ✅ Input focus maintained
   - ✅ Keyboard remains visible
   - ✅ Text not lost
   - ✅ Cursor position preserved

4. **Rotate during image upload**
   - ✅ Upload continues
   - ✅ Progress indicator visible
   - ✅ Cancel button accessible
   - ✅ No data loss

### CSS for Orientation

```css
/* Portrait-specific styles */
@media (orientation: portrait) {
  .gallery {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Landscape-specific styles */
@media (orientation: landscape) {
  .gallery {
    grid-template-columns: repeat(3, 1fr);
  }
  
  /* Reduce header height in landscape */
  .header {
    height: 56px;
  }
}

/* Prevent layout shift on rotation */
.container {
  transition: none; /* No animation on orientation change */
}
```

---

## EXTREME ASPECT RATIOS

### Ultra-Narrow (320×568 - iPhone SE)

**Challenges:**
- Very limited horizontal space
- Long vertical scrolling
- Buttons may wrap

**Solutions:**
```css
@media (max-width: 375px) {
  /* Stack buttons vertically */
  .button-group {
    flex-direction: column;
    width: 100%;
  }
  
  .button-group button {
    width: 100%;
  }
  
  /* Reduce padding */
  .container {
    padding: 12px;
  }
  
  /* Smaller font sizes */
  h1 {
    font-size: 20px;
  }
}
```

### Ultra-Wide (2560×1440 - Desktop)

**Challenges:**
- Content too spread out
- Reading line length too long
- Wasted space

**Solutions:**
```css
@media (min-width: 2560px) {
  /* Constrain content width */
  .container {
    max-width: 1600px;
    margin: 0 auto;
  }
  
  /* Limit text line length */
  p {
    max-width: 70ch; /* 70 characters */
  }
  
  /* Use extra space for sidebars */
  .layout {
    display: grid;
    grid-template-columns: 300px 1fr 300px;
    gap: 32px;
  }
}
```

### Extreme Landscape (812×375 - iPhone X landscape)

**Challenges:**
- Very short vertical space
- Header/footer take up significant space
- Content area cramped

**Solutions:**
```css
@media (max-height: 400px) and (orientation: landscape) {
  /* Reduce header height */
  .header {
    height: 48px;
  }
  
  /* Hide non-essential elements */
  .sidebar {
    display: none;
  }
  
  /* Compact spacing */
  .post {
    padding: 8px;
    margin-bottom: 8px;
  }
}
```

---

## STRESS TESTING SCENARIOS

### 1. Long Text Content

**Test Cases:**
- ✅ Very long username (50+ characters)
- ✅ Very long post content (5000+ characters)
- ✅ Very long URL (500+ characters)
- ✅ Very long word (100+ characters)

**CSS Solutions:**
```css
/* Prevent text overflow */
.username,
.post-content,
.url {
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
  max-width: 100%;
}

/* Truncate with ellipsis if needed */
.username-truncate {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Show full text on hover */
.username-truncate:hover {
  white-space: normal;
  overflow: visible;
}
```

### 2. Emoji-Only Content

**Test Cases:**
- ✅ Username: "🎉🎊🎈🎁🎀"
- ✅ Post: "😀😃😄😁😆😅😂🤣"
- ✅ Comment: "👍👍👍👍👍👍👍"

**CSS Solutions:**
```css
/* Ensure emoji render correctly */
.emoji-content {
  font-family: "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif;
  line-height: 1.5;
  word-break: break-word;
}

/* Prevent emoji from breaking layout */
.emoji-content {
  max-width: 100%;
  overflow-wrap: break-word;
}
```

### 3. RTL (Right-to-Left) Text

**Test Cases:**
- ✅ Arabic text: "مرحبا بك في برايد"
- ✅ Hebrew text: "ברוכים הבאים לפרייד"
- ✅ Mixed RTL/LTR: "Hello مرحبا World"

**CSS Solutions:**
```css
/* Auto-detect text direction */
.post-content,
.comment-text {
  direction: auto;
  text-align: start;
}

/* RTL-specific styles */
[dir="rtl"] .post-actions {
  flex-direction: row-reverse;
}

[dir="rtl"] .comment {
  margin-right: 32px;
  margin-left: 0;
}
```

### 4. Maximum Comment Depth

**Test Cases:**
- ✅ 3 levels deep (max allowed)
- ✅ Long text at max depth
- ✅ Multiple replies at max depth

**CSS Solutions:**
```css
/* Prevent excessive indentation */
.comment[data-depth="3"] {
  margin-left: 96px; /* Desktop */
}

@media (max-width: 767px) {
  .comment[data-depth="3"] {
    margin-left: 48px; /* Mobile: reduced */
  }
}

/* Max depth indicator */
.comment[data-depth="3"] .reply-btn {
  display: none; /* Can't reply at max depth */
}

.comment[data-depth="3"]::after {
  content: "Maximum reply depth reached";
  display: block;
  font-size: 12px;
  color: #65676b;
  font-style: italic;
  margin-top: 8px;
}
```

### 5. Long Feed (1000+ Posts)

**Test Cases:**
- ✅ Scroll performance
- ✅ Memory usage
- ✅ Render performance

**Solutions:**
```javascript
// Virtual scrolling / pagination
import { useVirtualizer } from '@tanstack/react-virtual';

const Feed = ({ posts }) => {
  const parentRef = useRef();
  
  const virtualizer = useVirtualizer({
    count: posts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // Estimated post height
    overscan: 5 // Render 5 extra items
  });
  
  return (
    <div ref={parentRef} style={{ height: '100vh', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(virtualItem => (
          <Post
            key={posts[virtualItem.index]._id}
            post={posts[virtualItem.index]}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`
            }}
          />
        ))}
      </div>
    </div>
  );
};
```

---

## TESTING CHECKLIST

### Orientation Tests

- [ ] Portrait → Landscape (phone)
- [ ] Landscape → Portrait (phone)
- [ ] Portrait → Landscape (tablet)
- [ ] Landscape → Portrait (tablet)
- [ ] Rotate while modal open
- [ ] Rotate while typing
- [ ] Rotate during upload

### Aspect Ratio Tests

- [ ] 320×568 (iPhone SE portrait)
- [ ] 375×667 (iPhone 8 portrait)
- [ ] 414×896 (iPhone 11 portrait)
- [ ] 768×1024 (iPad portrait)
- [ ] 1024×768 (iPad landscape)
- [ ] 1920×1080 (Desktop)
- [ ] 2560×1440 (Ultra-wide)
- [ ] 812×375 (iPhone X landscape)

### Content Stress Tests

- [ ] Username: 50 characters
- [ ] Post: 5000 characters
- [ ] URL: 500 characters
- [ ] Word: 100 characters (no spaces)
- [ ] Emoji-only username
- [ ] Emoji-only post
- [ ] Arabic text
- [ ] Hebrew text
- [ ] Mixed RTL/LTR
- [ ] Comment depth: 3 levels
- [ ] Feed: 1000+ posts

### Edge Cases

- [ ] Empty feed
- [ ] Empty profile
- [ ] No avatar image
- [ ] Broken image URLs
- [ ] Network offline
- [ ] Slow 3G connection
- [ ] Multiple tabs open
- [ ] Browser zoom 200%
- [ ] Browser zoom 50%

---

## AUTOMATED TESTING

### Playwright Test Example

```javascript
// tests/orientation.spec.js

import { test, expect } from '@playwright/test';

test.describe('Orientation Tests', () => {
  test('should handle portrait to landscape rotation', async ({ page }) => {
    // Set portrait
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/feed');
    
    // Verify portrait layout
    const feedPortrait = await page.locator('.feed');
    await expect(feedPortrait).toBeVisible();
    
    // Rotate to landscape
    await page.setViewportSize({ width: 667, height: 375 });
    
    // Verify landscape layout
    const feedLandscape = await page.locator('.feed');
    await expect(feedLandscape).toBeVisible();
    
    // Verify no horizontal scroll
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
  
  test('should handle long text without overflow', async ({ page }) => {
    await page.goto('/feed');
    
    // Create post with very long text
    const longText = 'A'.repeat(5000);
    await page.fill('.post-input', longText);
    await page.click('.post-submit');
    
    // Verify no horizontal scroll
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
```

---

## ACCEPTANCE CRITERIA

✅ **Orientation**
- No clipped UI on rotation
- Content reflows smoothly
- Scroll position maintained
- Modals remain accessible

✅ **Aspect Ratios**
- Works at 320px width
- Works at 2560px width
- Works at 375px height (landscape)
- No horizontal scroll at any size

✅ **Content Stress**
- Long text breaks correctly
- Emoji render correctly
- RTL text displays correctly
- Max depth enforced visually

✅ **Performance**
- Long feeds scroll smoothly
- No memory leaks
- Virtual scrolling works
- Images lazy load

✅ **Edge Cases**
- Empty states handled
- Broken images handled
- Offline mode works
- Multiple tabs work

---

**Status:** Ready for testing  
**Next Step:** Execute test plan and fix any issues found

