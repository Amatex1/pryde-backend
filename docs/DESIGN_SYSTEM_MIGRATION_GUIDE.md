# Pryde Social Design System Migration Guide

## 🎨 Overview

This guide explains the new design system implemented across Pryde Social and how to use it for future development.

---

## 📦 Design System Files

### Core Files
- **`src/styles/theme.css`** - Global design tokens (colors, spacing, typography, shadows)
- **`src/styles/components.css`** - Reusable component classes
- **`src/index.css`** - Base styles and legacy variable mappings

### Updated Page Styles
- `src/components/Navbar.css`
- `src/pages/Feed.css`
- `src/pages/Profile.css`
- `src/pages/Messages.css`
- `src/pages/Lounge.css`
- `src/pages/Auth.css`
- `src/pages/Settings.css`
- `src/pages/Notifications.css`
- `src/pages/Discover.css`
- `src/pages/Events.css`
- `src/pages/Journal.css`
- `src/pages/Admin.css`

---

## 🎯 Design Tokens

### Colors

```css
/* Brand Colors */
--color-primary: #6C5CE7;        /* Pryde Purple */
--color-primary-hover: #5a4bd8;
--color-primary-soft: #EDEAFF;   /* Soft Lavender */
--color-accent: #0984E3;         /* Electric Blue */

/* Status Colors */
--color-danger: #FF7675;
--color-danger-soft: rgba(255, 118, 117, 0.1);
--color-success: #00B894;
--color-success-soft: rgba(0, 184, 148, 0.1);
--color-warning: #FDCB6E;
--color-warning-soft: rgba(253, 203, 110, 0.1);

/* Backgrounds */
--bg: #F5F6FA;                   /* Page background */
--bg-card: #FFFFFF;              /* Card background */
--bg-subtle: #F0EEF9;            /* Subtle background */
--bg-hover: rgba(108, 92, 231, 0.04);

/* Text */
--text-main: #1E1E26;
--text-muted: #6B6E80;
--text-light: #9CA0B3;

/* Borders */
--border-subtle: #E8E9F0;
--border-medium: #D1D3E0;
```

### Spacing Scale

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
```

### Border Radius

```css
--radius-sm: 6px;
--radius-md: 10px;
--radius-card: 16px;
--radius-lg: 20px;
--radius-pill: 9999px;
```

### Shadows

```css
--shadow-soft: 0 2px 8px rgba(15, 16, 33, 0.04);
--shadow-medium: 0 4px 12px rgba(15, 16, 33, 0.08);
--shadow-strong: 0 8px 24px rgba(15, 16, 33, 0.12);
--shadow-focus: 0 0 0 3px rgba(108, 92, 231, 0.15);
```

### Typography

```css
/* Headings */
.h1-page-title { font-size: 22px; font-weight: 600; }
.h2-section-title { font-size: 18px; font-weight: 500; }
.h3-subsection-title { font-size: 16px; font-weight: 500; }

/* Body Text */
body { font-size: 15px; }
.text-muted { font-size: 13px; color: var(--text-muted); }
.text-small { font-size: 12px; }
.text-tiny { font-size: 11px; }
```

---

## 🧩 Component Classes

### Cards

```jsx
<div className="pryde-card">
  <h2 className="h2-section-title">Title</h2>
  <p>Content</p>
</div>

<div className="pryde-card pryde-card-hover">Hoverable card</div>
<div className="pryde-card pryde-card-compact">Compact padding</div>
<div className="pryde-card pryde-card-spacious">Extra padding</div>
```

### Buttons

```jsx
<button className="pryde-btn">Primary</button>
<button className="pryde-btn pryde-btn-secondary">Secondary</button>
<button className="pryde-btn pryde-btn-ghost">Ghost</button>
<button className="pryde-btn pryde-btn-danger">Danger</button>
<button className="pryde-btn pryde-btn-success">Success</button>

{/* Sizes */}
<button className="pryde-btn pryde-btn-sm">Small</button>
<button className="pryde-btn pryde-btn-lg">Large</button>
<button className="pryde-btn pryde-btn-icon">🔔</button>
```

### Forms

```jsx
<div className="pryde-form-group">
  <label className="pryde-label">Email</label>
  <input type="email" className="pryde-input" placeholder="Enter email" />
  <span className="pryde-helper-text">We'll never share your email</span>
</div>

<div className="pryde-form-group">
  <label className="pryde-label">Message</label>
  <textarea className="pryde-textarea" rows="4"></textarea>
  <span className="pryde-error-text">This field is required</span>
</div>
```

---

## 📱 Responsive Breakpoints

```css
/* Mobile First */
@media (min-width: 768px) { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop */ }
@media (min-width: 1200px) { /* Large Desktop */ }
```

---

## 🌙 Theme Support

The design system supports:
- **Light Mode** (default)
- **Dark Mode** (`[data-theme="dark"]`)
- **Quiet Mode** (`[data-quiet-mode="true"]`)

All color variables automatically adapt to the active theme.

---

## ✅ Migration Checklist

When creating new components or pages:

1. ✅ Use design tokens instead of hardcoded values
2. ✅ Use component classes (`.pryde-card`, `.pryde-btn`, etc.)
3. ✅ Use spacing scale (`var(--space-*)`)
4. ✅ Use color variables (`var(--color-*)`, `var(--bg-*)`, `var(--text-*)`)
5. ✅ Test in light mode, dark mode, and quiet mode
6. ✅ Test responsive behavior on mobile, tablet, desktop
7. ✅ Ensure proper focus states for accessibility

---

## 🚀 Next Steps

1. Review the example component: `src/components/DesignSystemExamples.jsx`
2. Test the application at http://localhost:3000
3. Report any visual inconsistencies or bugs
4. Enjoy the new professional, cohesive design! ✨

