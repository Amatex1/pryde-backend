# Comment UI — Responsive & Accessibility Verification

**Date:** 2026-01-12  
**Objective:** Verify comment UI across all devices and ensure accessibility  
**Scope:** Testing checklist for responsive design and WCAG compliance  
**Status:** READY FOR TESTING

---

## RESPONSIVE TESTING CHECKLIST

### Mobile (320px - 480px)

#### iPhone SE (320×568)
- [ ] Comments render without horizontal scroll
- [ ] Indentation: 0px, 16px, 32px, 48px (depths 0-3)
- [ ] Avatar sizes: 40px (depth 0), 32px (depths 1-3)
- [ ] Font sizes: 15px (depth 0), 14px (depths 1-3)
- [ ] "View X replies" button full width
- [ ] Tap targets minimum 44px
- [ ] Text wraps correctly
- [ ] No layout shift on expand/collapse

#### iPhone 8 (375×667)
- [ ] Comments render without horizontal scroll
- [ ] Indentation correct
- [ ] All interactive elements accessible
- [ ] Smooth expand/collapse animation

#### iPhone 11 (414×896)
- [ ] Comments render without horizontal scroll
- [ ] Indentation correct
- [ ] Touch targets comfortable
- [ ] No visual glitches

---

### Tablet (600px - 900px)

#### iPad Portrait (768×1024)
- [ ] Comments render without horizontal scroll
- [ ] Indentation: 0px, 32px, 64px, 96px (depths 0-3)
- [ ] Avatar sizes correct
- [ ] Font sizes readable
- [ ] "View X replies" button aligned left
- [ ] Tap targets minimum 44px

#### iPad Landscape (1024×768)
- [ ] Comments render without horizontal scroll
- [ ] Indentation correct
- [ ] Layout uses available space well
- [ ] No wasted space

---

### Desktop (1024px+)

#### Desktop (1920×1080)
- [ ] Comments render without horizontal scroll
- [ ] Indentation: 0px, 32px, 64px, 96px (depths 0-3)
- [ ] Avatar sizes: 40px (depth 0), 32px (depths 1-3)
- [ ] Font sizes: 15px (depth 0), 14px (depths 1-3)
- [ ] "View X replies" button aligned left
- [ ] Hover states work correctly
- [ ] Focus indicators visible

#### Ultra-wide (2560×1440)
- [ ] Comments don't stretch too wide
- [ ] Max width enforced (if applicable)
- [ ] Layout remains readable

---

## ORIENTATION TESTING

### Portrait → Landscape
- [ ] Rotate device while viewing comments
- [ ] No layout shift
- [ ] Content reflows smoothly
- [ ] Scroll position maintained
- [ ] No clipped UI elements

### Landscape → Portrait
- [ ] Rotate device while viewing comments
- [ ] No layout shift
- [ ] Content reflows smoothly
- [ ] Scroll position maintained
- [ ] No clipped UI elements

### Rotate While Expanded
- [ ] Expand replies
- [ ] Rotate device
- [ ] Replies remain expanded
- [ ] No layout issues

---

## ACCESSIBILITY TESTING (WCAG 2.1 Level AA)

### Semantic HTML

#### Structure
- [ ] Comments use `<article>` or semantic container
- [ ] Buttons use `<button>` (not `<div>`)
- [ ] Links use `<a>` with proper href
- [ ] Headings use proper hierarchy (if applicable)

#### ARIA Labels
- [ ] "View X replies" button has `aria-expanded`
- [ ] "View X replies" button has `aria-label`
- [ ] Comment container has `aria-label` with author name
- [ ] Reply button has `aria-label`
- [ ] Delete button has `aria-label`
- [ ] Edit button has `aria-label`

---

### Keyboard Navigation

#### Tab Order
- [ ] Tab through comments in logical order
- [ ] Tab reaches all interactive elements
- [ ] Tab skips hidden elements (collapsed replies)
- [ ] Shift+Tab works in reverse

#### Keyboard Actions
- [ ] Enter key activates "View X replies" button
- [ ] Space key activates "View X replies" button
- [ ] Enter key activates Reply button
- [ ] Enter key activates Like button
- [ ] Escape key closes menus (if applicable)

#### Focus Indicators
- [ ] Focus outline visible on all interactive elements
- [ ] Focus outline has sufficient contrast (3:1 minimum)
- [ ] Focus outline not obscured by other elements
- [ ] Focus outline follows tab order

---

### Screen Reader Testing

#### VoiceOver (iOS/macOS)
- [ ] Announces comment author
- [ ] Announces comment text
- [ ] Announces "View X replies" button state (expanded/collapsed)
- [ ] Announces reply count
- [ ] Announces depth level (if applicable)
- [ ] Announces deleted comment placeholder

#### NVDA (Windows)
- [ ] Announces comment structure
- [ ] Announces interactive elements
- [ ] Announces state changes (expand/collapse)

#### JAWS (Windows)
- [ ] Announces comment structure
- [ ] Announces interactive elements
- [ ] Announces state changes (expand/collapse)

---

### Color Contrast

#### Text Contrast
- [ ] Comment text: 4.5:1 minimum (WCAG AA)
- [ ] Author name: 4.5:1 minimum
- [ ] Timestamp: 4.5:1 minimum
- [ ] Button text: 4.5:1 minimum
- [ ] Max depth notice: 4.5:1 minimum

#### Interactive Elements
- [ ] Button background: 3:1 minimum (WCAG AA)
- [ ] Focus outline: 3:1 minimum
- [ ] Hover state: 3:1 minimum

#### Tools
- Use Chrome DevTools Lighthouse
- Use WebAIM Contrast Checker
- Use axe DevTools

---

### Touch Targets

#### Minimum Size (WCAG 2.1 Level AA)
- [ ] "View X replies" button: 44×44px minimum
- [ ] Reply button: 44×44px minimum
- [ ] Like button: 44×44px minimum
- [ ] Edit button: 44×44px minimum
- [ ] Delete button: 44×44px minimum
- [ ] Menu button: 44×44px minimum

#### Spacing
- [ ] 8px minimum between interactive elements
- [ ] No overlapping tap targets
- [ ] Comfortable spacing on mobile

---

## EDGE CASE TESTING

### Long Content
- [ ] Very long comment text (5000+ characters)
- [ ] Very long username (50+ characters)
- [ ] Very long word (100+ characters, no spaces)
- [ ] Text wraps correctly
- [ ] No horizontal scroll

### Emoji & Special Characters
- [ ] Emoji-only comment
- [ ] Mixed emoji and text
- [ ] RTL text (Arabic, Hebrew)
- [ ] Mixed RTL/LTR text
- [ ] Special characters (©, ®, ™, etc.)

### Deleted Comments
- [ ] Deleted parent shows placeholder
- [ ] Deleted parent hides replies
- [ ] Deleted reply shows placeholder
- [ ] Deleted comment styling correct

### Max Depth
- [ ] Comment at depth 3 shows max depth notice
- [ ] Reply button hidden at depth 3
- [ ] Cannot reply at depth 3
- [ ] Indentation capped at depth 3

### Empty States
- [ ] No comments shows empty state
- [ ] No replies shows no "View X replies" button
- [ ] Deleted comment with no content shows placeholder

---

## BROWSER TESTING

### Desktop Browsers
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Mobile Browsers
- [ ] Safari iOS (latest)
- [ ] Chrome Android (latest)
- [ ] Firefox Android (latest)
- [ ] Samsung Internet (latest)

---

## PERFORMANCE TESTING

### Render Performance
- [ ] 100 comments render smoothly
- [ ] 1000 comments render smoothly (with virtualization)
- [ ] Expand/collapse is smooth (60fps)
- [ ] No jank on scroll

### Memory Usage
- [ ] No memory leaks on expand/collapse
- [ ] No memory leaks on comment add/remove
- [ ] Memory usage stable over time

---

## AUTOMATED TESTING

### Lighthouse Audit
````bash
# Run Lighthouse in Chrome DevTools
# Target scores:
# - Accessibility: 95+
# - Best Practices: 90+
# - Performance: 80+
````

### axe DevTools
````bash
# Install axe DevTools extension
# Run automated accessibility scan
# Fix all critical and serious issues
````

### Manual Testing Script
````javascript
// Test expand/collapse
document.querySelectorAll('.view-replies-btn').forEach(btn => {
  btn.click();
  setTimeout(() => btn.click(), 1000);
});

// Test keyboard navigation
document.querySelector('.view-replies-btn').focus();
// Press Tab, Enter, Space

// Test screen reader
// Enable VoiceOver/NVDA
// Navigate through comments
````

---

## ACCEPTANCE CRITERIA

✅ **Responsive**
- Works on 320px - 2560px
- No horizontal scroll at any size
- Orientation changes handled
- Touch targets 44px minimum

✅ **Accessible**
- WCAG 2.1 Level AA compliant
- Keyboard navigation works
- Screen reader compatible
- Color contrast meets standards

✅ **Performance**
- Smooth expand/collapse
- No memory leaks
- 60fps animations

✅ **Edge Cases**
- Long content handled
- Emoji render correctly
- Deleted comments handled
- Max depth enforced

---

**Status:** ✅ READY FOR TESTING  
**Estimated Time:** 4-6 hours (comprehensive testing)  
**Tools Required:** Chrome DevTools, axe DevTools, screen readers

