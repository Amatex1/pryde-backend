# Responsive Layout Guarantees Specification

**Date:** 2026-01-12  
**Objective:** Enforce fluid layouts with no horizontal scroll at any viewport size  
**Scope:** CSS architecture, breakpoints, overflow guards

---

## CORE PRINCIPLES

### 1. Fluid-First Design
- ✅ Percentage widths, not fixed pixels
- ✅ CSS Grid and Flexbox for layouts
- ✅ Min/max widths for content bounds
- ✅ No fixed-width traps

### 2. No Horizontal Scroll
- ✅ Global overflow guard
- ✅ Content reflows cleanly
- ✅ Images scale responsively
- ✅ Modals fit viewport

### 3. Range-Based Breakpoints
- ✅ Mobile: 320px–480px
- ✅ Tablet: 600px–900px
- ✅ Desktop: 1024px–1920px
- ✅ Ultra-wide: ≥2560px

---

## GLOBAL CSS RESET

```css
/* Global overflow guard */
* {
  box-sizing: border-box;
}

html {
  overflow-x: hidden;
  width: 100%;
}

body {
  margin: 0;
  padding: 0;
  overflow-x: hidden;
  width: 100%;
  min-height: 100vh;
}

/* Prevent horizontal scroll from any element */
#root {
  overflow-x: hidden;
  width: 100%;
  min-height: 100vh;
}

/* Ensure images never overflow */
img {
  max-width: 100%;
  height: auto;
}

/* Ensure videos never overflow */
video {
  max-width: 100%;
  height: auto;
}

/* Ensure iframes never overflow */
iframe {
  max-width: 100%;
}

/* Prevent long words from breaking layout */
p, h1, h2, h3, h4, h5, h6, span, div {
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}

/* Prevent pre/code from overflowing */
pre, code {
  max-width: 100%;
  overflow-x: auto;
  word-wrap: break-word;
  white-space: pre-wrap;
}
```

---

## VIEWPORT META TAG

```html
<!-- REQUIRED in index.html -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
```

**Rules:**
- ✅ `width=device-width` - Match device width
- ✅ `initial-scale=1.0` - No zoom on load
- ✅ `maximum-scale=5.0` - Allow zoom for accessibility
- ✅ `user-scalable=yes` - Allow pinch-to-zoom

---

## BREAKPOINT SYSTEM

### Mobile-First Media Queries

```css
/* Mobile (default) - 320px to 480px */
.container {
  width: 100%;
  padding: 16px;
}

/* Tablet - 600px and up */
@media (min-width: 600px) {
  .container {
    padding: 24px;
  }
}

/* Desktop - 1024px and up */
@media (min-width: 1024px) {
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 32px;
  }
}

/* Ultra-wide - 2560px and up */
@media (min-width: 2560px) {
  .container {
    max-width: 1600px;
  }
}
```

### Breakpoint Variables (CSS Custom Properties)

```css
:root {
  /* Breakpoints */
  --breakpoint-mobile: 320px;
  --breakpoint-tablet: 600px;
  --breakpoint-desktop: 1024px;
  --breakpoint-wide: 1920px;
  --breakpoint-ultra: 2560px;
  
  /* Container widths */
  --container-mobile: 100%;
  --container-tablet: 100%;
  --container-desktop: 1200px;
  --container-wide: 1400px;
  --container-ultra: 1600px;
  
  /* Spacing */
  --spacing-mobile: 16px;
  --spacing-tablet: 24px;
  --spacing-desktop: 32px;
}
```

---

## FLUID LAYOUT PATTERNS

### 1. Fluid Grid

```css
.grid {
  display: grid;
  gap: 16px;
  width: 100%;
}

/* Mobile: 1 column */
.grid {
  grid-template-columns: 1fr;
}

/* Tablet: 2 columns */
@media (min-width: 600px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop: 3 columns */
@media (min-width: 1024px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* Ultra-wide: 4 columns */
@media (min-width: 2560px) {
  .grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

### 2. Fluid Flexbox

```css
.flex-container {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  width: 100%;
}

.flex-item {
  flex: 1 1 100%; /* Mobile: full width */
  min-width: 0; /* Prevent overflow */
}

@media (min-width: 600px) {
  .flex-item {
    flex: 1 1 calc(50% - 8px); /* Tablet: 2 columns */
  }
}

@media (min-width: 1024px) {
  .flex-item {
    flex: 1 1 calc(33.333% - 11px); /* Desktop: 3 columns */
  }
}
```

### 3. Fluid Typography

```css
/* Fluid font sizes using clamp() */
h1 {
  font-size: clamp(24px, 5vw, 48px);
}

h2 {
  font-size: clamp(20px, 4vw, 36px);
}

h3 {
  font-size: clamp(18px, 3vw, 28px);
}

p {
  font-size: clamp(14px, 2vw, 16px);
  line-height: 1.6;
}
```

---

## COMMON LAYOUT TRAPS (AVOID)

### ❌ Fixed Widths

```css
/* BAD */
.container {
  width: 1200px; /* Breaks on mobile */
}

/* GOOD */
.container {
  width: 100%;
  max-width: 1200px;
}
```

### ❌ Viewport Width Units Without Max

```css
/* BAD */
.hero {
  width: 100vw; /* Can cause horizontal scroll */
}

/* GOOD */
.hero {
  width: 100%;
  max-width: 100vw;
}
```

### ❌ Absolute Positioning Without Bounds

```css
/* BAD */
.modal {
  position: absolute;
  width: 800px; /* Breaks on mobile */
}

/* GOOD */
.modal {
  position: fixed;
  width: 90%;
  max-width: 800px;
  left: 50%;
  transform: translateX(-50%);
}
```

---

## MODAL & OVERLAY PATTERNS

```css
/* Modal container */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  overflow-y: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

/* Modal content */
.modal-content {
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  background: white;
  border-radius: 8px;
  padding: 24px;
}

/* Mobile adjustments */
@media (max-width: 599px) {
  .modal-content {
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
  }
}
```

---

## TESTING CHECKLIST

### Viewport Sizes to Test

- [ ] 320px (iPhone SE)
- [ ] 375px (iPhone 12/13)
- [ ] 414px (iPhone 12 Pro Max)
- [ ] 768px (iPad portrait)
- [ ] 1024px (iPad landscape)
- [ ] 1366px (Laptop)
- [ ] 1920px (Desktop)
- [ ] 2560px (Ultra-wide)

### Orientation Tests

- [ ] Portrait mode
- [ ] Landscape mode
- [ ] Rotation transition

### Content Tests

- [ ] Long text (no overflow)
- [ ] Long URLs (break correctly)
- [ ] Large images (scale down)
- [ ] Empty states (no collapse)
- [ ] Max content (no horizontal scroll)

---

## ACCEPTANCE CRITERIA

✅ **No Horizontal Scroll**
- At any viewport size (320px - 2560px+)
- With any content length
- In any orientation

✅ **Fluid Layouts**
- Percentage widths
- CSS Grid/Flexbox
- Min/max constraints

✅ **Responsive Images**
- Scale to container
- Maintain aspect ratio
- No overflow

✅ **Modals Fit Viewport**
- Never exceed screen bounds
- Scrollable if needed
- Centered properly

✅ **Typography Scales**
- Readable at all sizes
- No text overflow
- Proper line breaks

---

**Status:** Ready for implementation  
**Next Step:** Apply CSS patterns to frontend codebase

