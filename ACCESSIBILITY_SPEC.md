# Accessibility Improvements Specification

## Overview
Implement WCAG 2.1 Level AA compliance for Pryde Social platform.

## Backend Support

### 1. Image Alt Text Validation
```javascript
// Validate alt text on image upload
export const validateAltText = (altText) => {
  if (!altText || altText.trim().length === 0) {
    return {
      valid: false,
      message: 'Alt text is required for accessibility'
    };
  }
  
  if (altText.length < 10) {
    return {
      valid: false,
      message: 'Alt text should be descriptive (at least 10 characters)'
    };
  }
  
  if (altText.length > 250) {
    return {
      valid: false,
      message: 'Alt text should be concise (max 250 characters)'
    };
  }
  
  return { valid: true };
};
```

### 2. Content Warnings API
```javascript
// Add content warning field to posts
{
  contentWarning: {
    enabled: Boolean,
    text: String, // e.g., "Contains flashing images"
    categories: [String] // e.g., ["violence", "flashing"]
  }
}
```

### 3. Transcript Support for Media
```javascript
// Add transcript field for audio/video
{
  media: {
    type: String, // 'image', 'video', 'audio'
    url: String,
    altText: String, // For images
    transcript: String, // For audio/video
    captions: String // VTT file URL for videos
  }
}
```

## Frontend Implementation

### 1. Skip to Main Content Link
```html
<!-- Add at top of App.jsx -->
<a href="#main-content" className="skip-link">
  Skip to main content
</a>

<style>
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #000;
  color: #fff;
  padding: 8px;
  text-decoration: none;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
</style>

<!-- Add id to main content -->
<main id="main-content">
  {/* App content */}
</main>
```

### 2. ARIA Labels for Interactive Elements
```jsx
// Notification bell
<button 
  aria-label={`Notifications (${unreadCount} unread)`}
  aria-expanded={isOpen}
>
  <BellIcon />
  {unreadCount > 0 && <span className="sr-only">{unreadCount} unread notifications</span>}
</button>

// Like button
<button
  aria-label={isLiked ? 'Unlike post' : 'Like post'}
  aria-pressed={isLiked}
>
  <HeartIcon />
</button>

// Screen reader only text
<span className="sr-only">
  Post by {author.name}, {timeAgo}
</span>
```

### 3. Keyboard Navigation
```jsx
// Ensure all interactive elements are keyboard accessible
<div
  role="button"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
  onClick={handleClick}
>
  Click me
</div>

// Focus management for modals
useEffect(() => {
  if (isOpen) {
    const firstFocusable = modalRef.current.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    firstFocusable?.focus();
  }
}, [isOpen]);
```

### 4. Color Contrast
```css
/* Ensure WCAG AA contrast ratios (4.5:1 for normal text, 3:1 for large text) */

/* Good contrast examples */
.text-primary {
  color: #1a1a1a; /* Dark text on white background: 16.1:1 */
}

.text-secondary {
  color: #4a4a4a; /* Medium text on white background: 9.7:1 */
}

.link {
  color: #0066cc; /* Blue link on white background: 7.7:1 */
}

/* Bad contrast - avoid */
.text-light-gray {
  color: #999; /* Only 2.8:1 - fails WCAG AA */
}
```

### 5. Focus Indicators
```css
/* Visible focus indicators for keyboard navigation */
*:focus {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}

/* Custom focus styles */
button:focus-visible {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(0, 102, 204, 0.2);
}
```

### 6. Form Labels
```jsx
// Always associate labels with inputs
<label htmlFor="email">
  Email Address
  <span aria-label="required">*</span>
</label>
<input
  id="email"
  type="email"
  aria-required="true"
  aria-invalid={hasError}
  aria-describedby={hasError ? "email-error" : undefined}
/>
{hasError && (
  <div id="email-error" role="alert">
    Please enter a valid email address
  </div>
)}
```

### 7. Live Regions for Dynamic Content
```jsx
// Announce new notifications to screen readers
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"
>
  {newNotification && `New notification: ${newNotification.message}`}
</div>

// Urgent announcements
<div
  role="alert"
  aria-live="assertive"
  className="sr-only"
>
  {errorMessage}
</div>
```

### 8. Image Alt Text
```jsx
// Decorative images
<img src="decoration.png" alt="" role="presentation" />

// Informative images
<img 
  src="profile.jpg" 
  alt={`${user.name}'s profile picture`}
/>

// Complex images
<img
  src="chart.png"
  alt="Bar chart showing user growth from 100 to 1000 users over 6 months"
/>
```

## Testing Checklist

### Automated Testing
- [ ] Run axe-core accessibility tests
- [ ] Check color contrast with WAVE tool
- [ ] Validate HTML with W3C validator

### Manual Testing
- [ ] Navigate entire app using only keyboard (Tab, Enter, Space, Arrow keys)
- [ ] Test with screen reader (NVDA, JAWS, or VoiceOver)
- [ ] Verify all images have alt text
- [ ] Check focus indicators are visible
- [ ] Test form validation announcements
- [ ] Verify skip links work
- [ ] Test with 200% zoom
- [ ] Test with high contrast mode

### Screen Reader Testing
```bash
# Windows: NVDA (free)
# Mac: VoiceOver (built-in, Cmd+F5)
# Test:
# - Can navigate to all interactive elements
# - Buttons announce their purpose
# - Form errors are announced
# - Dynamic content updates are announced
# - Images have descriptive alt text
```

## Implementation Priority

### High Priority (Sprint 3)
1. Skip to main content link
2. ARIA labels for all buttons
3. Keyboard navigation for modals
4. Focus indicators
5. Form label associations

### Medium Priority (Sprint 4)
1. Alt text validation
2. Live regions for notifications
3. Content warnings
4. Color contrast fixes

### Low Priority (Sprint 5)
1. Transcript support
2. Captions for videos
3. Advanced keyboard shortcuts
4. Screen reader optimizations

