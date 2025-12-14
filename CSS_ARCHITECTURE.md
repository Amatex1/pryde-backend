# Pryde Social - CSS Architecture Guide

## 🎯 **PURPOSE**
This document defines CSS architecture rules to prevent style conflicts and ensure design consistency across the application.

---

## 📁 **CSS FILE STRUCTURE**

```
src/
├── styles/
│   ├── components.css      # ✅ SHARED design system (buttons, inputs, cards)
│   ├── theme.css           # ✅ SHARED colors, spacing, typography
│   ├── darkMode.css        # ✅ SHARED dark mode overrides
│   ├── quiet-mode.css      # ✅ SHARED quiet mode overrides
│   └── responsive.css      # ✅ SHARED responsive utilities
│
├── pages/
│   ├── Feed.css            # ⚠️ FEED PAGE ONLY - Needs scoping
│   ├── Profile.css         # ✅ SCOPED to .profile-page
│   ├── Messages.css        # ⚠️ MESSAGES PAGE ONLY - Needs scoping
│   └── Settings.css        # ⚠️ SETTINGS PAGE ONLY - Needs scoping
│
└── components/
    ├── Navbar.css          # ✅ Component-specific
    ├── MiniChat.css        # ✅ Component-specific
    └── ... (41 components)
```

---

## ✅ **CSS SCOPING RULES**

### **Rule 1: All Page-Specific CSS MUST Be Scoped**

**WHY:** Prevents page styles from affecting other pages globally.

**HOW:** Wrap all page selectors with a page-specific class.

**Example:**
```css
/* ❌ BAD - Affects ALL pages */
.post-card {
  padding: 1rem;
}

/* ✅ GOOD - Only affects Profile page */
.profile-page .post-card {
  padding: 1rem;
}
```

### **Rule 2: Use Design System Classes for Common Elements**

**WHY:** Reduces duplication and ensures consistency.

**WHERE:** `src/styles/components.css`

**Available Classes:**
- **Buttons:** `.pryde-btn`, `.pryde-btn-secondary`, `.pryde-btn-ghost`, `.pryde-btn-danger`, `.pryde-btn-success`
- **Sizes:** `.pryde-btn-sm`, `.pryde-btn-lg`, `.pryde-btn-icon`
- **Inputs:** `.pryde-input`, `.pryde-textarea`, `.pryde-label`
- **Cards:** `.pryde-card`, `.pryde-card-compact`, `.pryde-card-hover`
- **Containers:** `.pryde-container`, `.pryde-container-feed`, `.pryde-container-form`

**Example:**
```jsx
// ❌ BAD - Creating custom button styles
<button className="my-custom-btn">Click Me</button>

// ✅ GOOD - Using design system
<button className="pryde-btn pryde-btn-secondary">Click Me</button>

// ✅ BETTER - Using Button component
<Button variant="secondary">Click Me</Button>
```

### **Rule 3: Component CSS Should Be Self-Contained**

**WHY:** Makes components reusable and prevents conflicts.

**HOW:** Scope all component styles to a unique component class.

**Example:**
```css
/* Navbar.css */
.navbar {
  /* All navbar styles here */
}

.navbar .nav-item {
  /* Scoped to navbar */
}
```

---

## 🚫 **ANTI-PATTERNS TO AVOID**

### **1. Global Selectors in Page CSS**
```css
/* ❌ BAD - Affects entire app */
.post-card { ... }
.action-btn { ... }
.comment-box { ... }

/* ✅ GOOD - Scoped to page */
.feed-page .post-card { ... }
.feed-page .action-btn { ... }
.feed-page .comment-box { ... }
```

### **2. Excessive !important Flags**
```css
/* ❌ BAD - Forces override, hard to debug */
.my-button {
  background: red !important;
  color: white !important;
}

/* ✅ GOOD - Use specificity or scoping */
.profile-page .my-button {
  background: red;
  color: white;
}
```

### **3. Duplicate Button Styles**
```css
/* ❌ BAD - Duplicating design system */
.btn-cancel {
  padding: 0.75rem 1.5rem;
  border-radius: 12px;
  font-weight: 600;
  /* ... 20 more lines ... */
}

/* ✅ GOOD - Extend design system */
.btn-cancel {
  /* Inherits from .pryde-btn */
  background: var(--bg);
  border-color: var(--border-subtle);
}
```

---

## 📋 **PAGE SCOPING CHECKLIST**

### **Profile.css** ✅ COMPLETE
- [x] All selectors scoped to `.profile-page`
- [x] `.posts-list` scoped
- [x] `.post-input` scoped
- [x] `.post-actions-bar` scoped
- [x] `.post-stats` scoped
- [x] `.post-actions` scoped
- [x] `.action-btn` scoped
- [x] All reaction/comment selectors scoped

### **Feed.css** ⚠️ NEEDS WORK
- [ ] 128+ selectors need scoping to `.feed-page`
- [ ] `.post-card` needs scoping
- [ ] `.action-btn` needs scoping
- [ ] `button.btn-poll` needs scoping
- [ ] `button.btn-content-warning` needs scoping
- [ ] All reaction/comment selectors need scoping

### **Messages.css** ⚠️ NEEDS REVIEW
- [ ] Check for global selectors
- [ ] Scope to `.messages-page` if needed

### **Settings.css** ⚠️ NEEDS REVIEW
- [ ] Check for global selectors
- [ ] Scope to `.settings-page` if needed

---

## 🔧 **HOW TO ADD A NEW PAGE**

1. **Create page wrapper with unique class:**
```jsx
// NewPage.jsx
return (
  <div className="page-container new-page">
    <Navbar />
    <div className="new-page-content">
      {/* Page content */}
    </div>
  </div>
);
```

2. **Scope ALL CSS selectors:**
```css
/* NewPage.css */
.new-page .page-content {
  /* Styles */
}

.new-page .custom-element {
  /* Styles */
}
```

3. **Use design system classes:**
```jsx
<Button variant="primary">Submit</Button>
<input className="pryde-input" />
<div className="pryde-card">...</div>
```

---

## 🎨 **DESIGN SYSTEM USAGE**

### **When to Use Shared Classes:**
- ✅ Common buttons (submit, cancel, delete, etc.)
- ✅ Form inputs and textareas
- ✅ Card containers
- ✅ Standard spacing and layout

### **When to Create Custom Styles:**
- ✅ Unique page-specific layouts
- ✅ Special interactive elements
- ✅ Custom animations or transitions
- ✅ Component-specific variations

**Always scope custom styles to prevent conflicts!**

---

## 🐛 **DEBUGGING CSS CONFLICTS**

### **Symptoms:**
- Design breaks when making unrelated changes
- Styles from one page affect another page
- Action buttons stop working after CSS edits

### **Solution:**
1. Check if selectors are scoped to page class
2. Verify page wrapper has correct class (e.g., `.profile-page`)
3. Remove `!important` flags if possible
4. Use browser DevTools to inspect conflicting styles

---

## 📝 **COMMIT MESSAGE TEMPLATE**

When fixing CSS conflicts:
```
FIX: Scope [PageName].css to prevent conflicts

PROBLEM:
- [Describe what was breaking]

SOLUTION:
- Scoped all selectors to .[page-name]
- [List specific selectors fixed]

RESULT:
- [Page] design is now stable
- No more conflicts with other pages
```

---

## 🎯 **SUMMARY**

1. ✅ **Always scope page CSS** to `.page-name`
2. ✅ **Use design system classes** from `components.css`
3. ✅ **Avoid global selectors** in page CSS files
4. ✅ **Use Button component** instead of custom button styles
5. ✅ **Test on multiple pages** after CSS changes

**Following these rules will prevent design from breaking! 🎉**

