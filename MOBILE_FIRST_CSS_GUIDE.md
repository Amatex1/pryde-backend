# Mobile-First CSS Enforcement Guide

**Date:** 2026-01-12  
**Objective:** Reorder CSS to mobile-first with min-width media queries  
**Principle:** Mobile styles are default, desktop enhances

---

## MOBILE-FIRST PHILOSOPHY

### Core Concept
1. **Mobile styles are the base** - Written without media queries
2. **Desktop styles enhance** - Added with `min-width` media queries
3. **Content-first stacking** - Vertical layout is default
4. **Progressive enhancement** - Add complexity as screen grows

### Why Mobile-First?

✅ **Performance** - Mobile devices load only necessary CSS  
✅ **Simplicity** - Start simple, add complexity  
✅ **Accessibility** - Linear content flow is most accessible  
✅ **Future-proof** - New devices default to mobile styles

---

## BEFORE & AFTER EXAMPLES

### ❌ Desktop-First (Wrong)

```css
/* Desktop styles (default) */
.container {
  width: 1200px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 32px;
}

/* Mobile overrides (max-width) */
@media (max-width: 768px) {
  .container {
    width: 100%;
    grid-template-columns: 1fr;
    padding: 16px;
  }
}
```

**Problems:**
- Mobile devices load desktop CSS first
- Overrides are inefficient
- Easy to miss mobile edge cases

### ✅ Mobile-First (Correct)

```css
/* Mobile styles (default) */
.container {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr;
  padding: 16px;
}

/* Tablet enhancement (min-width) */
@media (min-width: 600px) {
  .container {
    padding: 24px;
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop enhancement (min-width) */
@media (min-width: 1024px) {
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 32px;
    grid-template-columns: repeat(3, 1fr);
  }
}
```

**Benefits:**
- Mobile devices load minimal CSS
- Progressive enhancement
- Clear separation of concerns

---

## CSS REORDERING PATTERN

### Step 1: Identify Base Styles (Mobile)

```css
/* These apply to ALL screen sizes */
.button {
  /* Mobile-first base styles */
  display: inline-block;
  padding: 12px 24px;
  font-size: 14px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  width: 100%; /* Full width on mobile */
}
```

### Step 2: Add Tablet Enhancements

```css
/* Tablet: 600px and up */
@media (min-width: 600px) {
  .button {
    width: auto; /* Auto width on tablet+ */
    padding: 14px 28px;
    font-size: 15px;
  }
}
```

### Step 3: Add Desktop Enhancements

```css
/* Desktop: 1024px and up */
@media (min-width: 1024px) {
  .button {
    padding: 16px 32px;
    font-size: 16px;
  }
}
```

---

## COMMON PATTERNS

### 1. Navigation

```css
/* Mobile: Hamburger menu */
.nav {
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: -100%;
  width: 80%;
  height: 100vh;
  background: white;
  transition: left 0.3s ease;
}

.nav.open {
  left: 0;
}

.nav-item {
  padding: 16px;
  border-bottom: 1px solid #eee;
}

/* Desktop: Horizontal menu */
@media (min-width: 1024px) {
  .nav {
    position: static;
    flex-direction: row;
    width: auto;
    height: auto;
    background: transparent;
  }
  
  .nav-item {
    padding: 8px 16px;
    border-bottom: none;
  }
}
```

### 2. Grid Layouts

```css
/* Mobile: Single column */
.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

/* Tablet: 2 columns */
@media (min-width: 600px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
  }
}

/* Desktop: 3 columns */
@media (min-width: 1024px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
  }
}

/* Ultra-wide: 4 columns */
@media (min-width: 1920px) {
  .grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 32px;
  }
}
```

### 3. Typography

```css
/* Mobile: Smaller, tighter */
h1 {
  font-size: 24px;
  line-height: 1.2;
  margin-bottom: 16px;
}

p {
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 12px;
}

/* Tablet: Slightly larger */
@media (min-width: 600px) {
  h1 {
    font-size: 32px;
    margin-bottom: 20px;
  }
  
  p {
    font-size: 15px;
    margin-bottom: 16px;
  }
}

/* Desktop: Full size */
@media (min-width: 1024px) {
  h1 {
    font-size: 48px;
    line-height: 1.1;
    margin-bottom: 24px;
  }
  
  p {
    font-size: 16px;
    line-height: 1.6;
    margin-bottom: 20px;
  }
}
```

### 4. Spacing

```css
/* Mobile: Compact spacing */
.section {
  padding: 16px;
  margin-bottom: 24px;
}

/* Tablet: More breathing room */
@media (min-width: 600px) {
  .section {
    padding: 24px;
    margin-bottom: 32px;
  }
}

/* Desktop: Generous spacing */
@media (min-width: 1024px) {
  .section {
    padding: 32px;
    margin-bottom: 48px;
  }
}
```

---

## MIGRATION CHECKLIST

### Audit Existing CSS

- [ ] Find all `max-width` media queries
- [ ] Identify desktop-first patterns
- [ ] List components needing reordering

### Reorder Process

1. **Extract mobile styles** - Move base styles outside media queries
2. **Convert max-width to min-width** - Flip the logic
3. **Test at each breakpoint** - Verify nothing breaks
4. **Remove redundant overrides** - Clean up duplicates

### Example Migration

```css
/* BEFORE (Desktop-first) */
.card {
  width: 300px;
  padding: 20px;
}

@media (max-width: 768px) {
  .card {
    width: 100%;
    padding: 16px;
  }
}

/* AFTER (Mobile-first) */
.card {
  width: 100%;
  padding: 16px;
}

@media (min-width: 768px) {
  .card {
    width: 300px;
    padding: 20px;
  }
}
```

---

## TESTING STRATEGY

### 1. Start Small (Mobile)
- Test at 320px width
- Verify all content visible
- Check touch targets (44px minimum)

### 2. Scale Up (Tablet)
- Test at 600px, 768px, 900px
- Verify enhancements apply
- Check layout doesn't break

### 3. Full Size (Desktop)
- Test at 1024px, 1366px, 1920px
- Verify all enhancements work
- Check max-width constraints

### 4. Edge Cases
- Test at 599px (just before tablet)
- Test at 1023px (just before desktop)
- Test orientation changes

---

## ACCEPTANCE CRITERIA

✅ **Mobile Styles Default**
- No media queries for base styles
- Works at 320px without queries

✅ **Min-Width Only**
- All media queries use `min-width`
- No `max-width` queries

✅ **Progressive Enhancement**
- Each breakpoint adds features
- Never removes features

✅ **Content-First**
- Vertical stacking default
- Horizontal layouts enhanced

✅ **Performance**
- Mobile loads minimal CSS
- Desktop loads full CSS

---

## TOOLS & HELPERS

### CSS Custom Properties for Breakpoints

```css
:root {
  --mobile: 320px;
  --tablet: 600px;
  --desktop: 1024px;
  --wide: 1920px;
}

/* Usage */
@media (min-width: var(--tablet)) {
  /* Tablet styles */
}
```

### Browser DevTools

1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Test at different widths
4. Check responsive mode

---

**Status:** Ready for implementation  
**Next Step:** Audit and reorder existing CSS files

