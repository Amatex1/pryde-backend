# Tap-Target Accessibility Specification

**Date:** 2026-01-12  
**Objective:** Enforce 44px minimum tap targets and semantic buttons  
**Standard:** WCAG 2.1 Level AA (Success Criterion 2.5.5)

---

## WCAG 2.1 REQUIREMENTS

### Success Criterion 2.5.5: Target Size (Level AAA)

**Requirement:** The size of the target for pointer inputs is at least 44 by 44 CSS pixels.

**Exceptions:**
- Equivalent: The target is available through an equivalent link or control that is at least 44×44 pixels
- Inline: The target is in a sentence or block of text
- User Agent Control: The size of the target is determined by the user agent
- Essential: A particular presentation of the target is essential

---

## MINIMUM TAP TARGET SIZES

### Standard Sizes

| Element Type | Minimum Size | Recommended Size | Spacing |
|--------------|--------------|------------------|---------|
| Buttons | 44×44px | 48×48px | 8px |
| Icons | 44×44px | 48×48px | 8px |
| Links (standalone) | 44×44px | 48×48px | 8px |
| Checkboxes | 44×44px | 48×48px | 8px |
| Radio buttons | 44×44px | 48×48px | 8px |
| Toggle switches | 44×44px | 52×32px | 8px |

### Inline Links Exception

Links within paragraphs can be smaller than 44px if:
- They are part of flowing text
- They have adequate spacing from other links
- They have clear visual distinction (underline, color)

---

## CSS IMPLEMENTATION

### Base Button Styles

```css
/* Ensure all buttons meet minimum tap target */
button,
.btn,
[role="button"] {
  min-height: 44px;
  min-width: 44px;
  padding: 12px 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s ease;
}

/* Icon-only buttons */
.btn-icon {
  min-height: 44px;
  min-width: 44px;
  padding: 10px;
  border-radius: 50%;
}

/* Small buttons (still meet minimum) */
.btn-small {
  min-height: 44px;
  min-width: 44px;
  padding: 10px 16px;
  font-size: 13px;
}

/* Large buttons */
.btn-large {
  min-height: 48px;
  min-width: 48px;
  padding: 14px 28px;
  font-size: 16px;
}
```

### Icon Buttons

```css
/* Icon buttons must be at least 44×44px */
.icon-btn {
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 50%;
  transition: background-color 0.2s ease;
}

.icon-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.icon-btn:focus-visible {
  outline: 2px solid #1877f2;
  outline-offset: 2px;
}

/* Icon inside button */
.icon-btn svg,
.icon-btn img {
  width: 20px;
  height: 20px;
  pointer-events: none;
}
```

### Link Styles

```css
/* Standalone links (not in text) */
a.link-standalone {
  min-height: 44px;
  min-width: 44px;
  display: inline-flex;
  align-items: center;
  padding: 12px 16px;
  text-decoration: none;
  color: #1877f2;
  transition: color 0.2s ease;
}

a.link-standalone:hover {
  color: #145dbf;
  text-decoration: underline;
}

/* Inline links (in paragraphs) - exception allowed */
p a,
.text-content a {
  color: #1877f2;
  text-decoration: underline;
  /* No minimum size required for inline links */
}
```

### Form Controls

```css
/* Checkboxes */
input[type="checkbox"] {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

/* Checkbox label (provides tap target) */
.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 12px 0;
  cursor: pointer;
}

/* Radio buttons */
input[type="radio"] {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

/* Radio label (provides tap target) */
.radio-label {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 12px 0;
  cursor: pointer;
}

/* Toggle switches */
.toggle-switch {
  width: 52px;
  height: 32px;
  min-width: 52px;
  min-height: 32px;
  position: relative;
  cursor: pointer;
}
```

---

## SEMANTIC HTML

### ❌ Wrong: Div Clickables

```html
<!-- BAD: Non-semantic, not keyboard accessible -->
<div class="clickable" onclick="handleClick()">
  Click me
</div>
```

### ✅ Correct: Semantic Buttons

```html
<!-- GOOD: Semantic, keyboard accessible -->
<button type="button" onclick="handleClick()">
  Click me
</button>
```

### ✅ Correct: Semantic Links

```html
<!-- GOOD: For navigation -->
<a href="/profile" class="link-standalone">
  View Profile
</a>
```

---

## SPACING BETWEEN TARGETS

### Minimum Spacing

```css
/* Ensure 8px spacing between interactive elements */
.button-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.icon-group {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* List of links */
.link-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.link-list a {
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: 12px 16px;
}
```

---

## REACT COMPONENT EXAMPLES

### Button Component

```jsx
const Button = ({ children, icon, size = 'medium', ...props }) => {
  const sizeClasses = {
    small: 'btn-small',
    medium: '',
    large: 'btn-large'
  };
  
  return (
    <button 
      className={`btn ${sizeClasses[size]}`}
      {...props}
    >
      {icon && <span className="btn-icon">{icon}</span>}
      {children}
    </button>
  );
};
```

### Icon Button Component

```jsx
const IconButton = ({ icon, label, ...props }) => {
  return (
    <button 
      className="icon-btn"
      aria-label={label}
      {...props}
    >
      {icon}
    </button>
  );
};

// Usage
<IconButton 
  icon={<HeartIcon />} 
  label="Like post"
  onClick={handleLike}
/>
```

### Checkbox Component

```jsx
const Checkbox = ({ label, checked, onChange, ...props }) => {
  const id = useId();
  
  return (
    <label htmlFor={id} className="checkbox-label">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        {...props}
      />
      <span>{label}</span>
    </label>
  );
};
```

---

## TESTING CHECKLIST

### Visual Testing

- [ ] All buttons at least 44×44px
- [ ] All icons at least 44×44px
- [ ] All standalone links at least 44×44px
- [ ] 8px spacing between interactive elements
- [ ] No overlapping tap targets

### Touch Testing

- [ ] Test on actual mobile device
- [ ] Verify all targets easy to tap
- [ ] No accidental taps on adjacent elements
- [ ] Comfortable thumb reach

### Keyboard Testing

- [ ] All interactive elements focusable
- [ ] Tab order logical
- [ ] Enter/Space activates buttons
- [ ] Focus indicators visible

### Screen Reader Testing

- [ ] All buttons have accessible names
- [ ] Icon buttons have aria-label
- [ ] Form controls have labels
- [ ] Role attributes correct

---

## COMMON VIOLATIONS & FIXES

### Violation 1: Small Icon Buttons

```css
/* ❌ BAD: Too small */
.icon-btn {
  width: 24px;
  height: 24px;
}

/* ✅ GOOD: Meets minimum */
.icon-btn {
  width: 44px;
  height: 44px;
  padding: 12px; /* Icon inside is 20px */
}
```

### Violation 2: Clickable Divs

```html
<!-- ❌ BAD: Not semantic -->
<div onClick={handleClick}>Click</div>

<!-- ✅ GOOD: Semantic button -->
<button onClick={handleClick}>Click</button>
```

### Violation 3: No Spacing

```css
/* ❌ BAD: No gap */
.buttons {
  display: flex;
}

/* ✅ GOOD: Adequate spacing */
.buttons {
  display: flex;
  gap: 8px;
}
```

---

## ACCEPTANCE CRITERIA

✅ **Minimum Size**
- All buttons ≥ 44×44px
- All icons ≥ 44×44px
- All standalone links ≥ 44×44px

✅ **Spacing**
- ≥ 8px between interactive elements
- No overlapping tap targets

✅ **Semantic HTML**
- Buttons use `<button>`
- Links use `<a>`
- No clickable `<div>` elements

✅ **Accessibility**
- All elements keyboard accessible
- All elements have accessible names
- Focus indicators visible

✅ **Touch-Friendly**
- Easy to tap on mobile
- No accidental taps
- Comfortable thumb reach

---

**Status:** Ready for implementation  
**Next Step:** Audit and fix all interactive elements in frontend

