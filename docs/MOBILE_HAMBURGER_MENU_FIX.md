# Mobile Hamburger Menu Z-Index Fix

## 🐛 Issue

On mobile PWA, the hamburger menu was appearing **behind** the feed title bar and navigation back button when opened.

### Problem Details:
- **Mobile header** had `z-index: 10` (too low)
- **Mobile bottom nav** had `z-index: 10` (too low)
- **Hamburger menu** had `z-index: calc(var(--z-modal) + 100)` (~1101)
- **Menu overlay** had `z-index: var(--z-modal)` (~1001)

The hamburger menu should appear **above** all other UI elements, but the mobile header/nav were using hardcoded low z-index values instead of the design system variables.

## ✅ Solution

Updated mobile header and navigation to use proper z-index from the design system:

### Changes Made:

**File:** `src/layouts/MobileLayout.css`

1. **Mobile Header** (line 26):
   ```css
   /* Before */
   z-index: 10;
   
   /* After */
   z-index: var(--z-sticky);
   ```

2. **Mobile Nav** (line 97):
   ```css
   /* Before */
   z-index: 10;
   
   /* After */
   z-index: var(--z-sticky);
   ```

### Z-Index Hierarchy (from design-system.css):

```css
--z-base: 1;           /* Base layer */
--z-dropdown: 100;     /* Dropdowns */
--z-sticky: 200;       /* Sticky headers/navs */
--z-modal-backdrop: 1000;  /* Modal backdrop */
--z-modal: 1001;       /* Modals */
--z-toast: 2000;       /* Toast notifications */
```

### Hamburger Menu Z-Index:
```css
.mobile-hamburger-btn {
  z-index: calc(var(--z-modal) + 100);  /* 1101 */
}

.mobile-menu {
  z-index: calc(var(--z-modal) + 100);  /* 1101 */
}

.mobile-menu-overlay {
  z-index: var(--z-modal);  /* 1001 */
}
```

## 📊 Result

**Before:**
- Mobile header: z-index 10
- Mobile nav: z-index 10
- Hamburger menu: z-index 1101
- **Problem:** Menu appeared behind header/nav

**After:**
- Mobile header: z-index 200 (var(--z-sticky))
- Mobile nav: z-index 200 (var(--z-sticky))
- Hamburger menu: z-index 1101
- **Fixed:** Menu appears above everything

## 🎯 Layering Order (Bottom to Top)

1. **Base content** - z-index: 1
2. **Dropdowns** - z-index: 100
3. **Sticky header/nav** - z-index: 200 ✅ (mobile header & nav)
4. **Modal backdrop** - z-index: 1000
5. **Modals** - z-index: 1001 (hamburger menu overlay)
6. **Hamburger menu** - z-index: 1101 ✅ (appears on top)
7. **Toasts** - z-index: 2000

## ✅ Benefits

1. **Consistent z-index usage** - Uses design system variables instead of hardcoded values
2. **Proper layering** - Hamburger menu now appears above all UI elements
3. **Maintainable** - Changes to z-index scale in design-system.css will propagate
4. **No visual conflicts** - Menu doesn't hide behind header or navigation

## 🧪 Testing

Test on mobile/PWA:
1. ✅ Open hamburger menu
2. ✅ Menu should appear above feed title bar
3. ✅ Menu should appear above back button
4. ✅ Menu should appear above bottom navigation
5. ✅ Overlay should dim background properly
6. ✅ Clicking overlay should close menu

---

**Date:** 2025-12-24  
**Files Changed:** 1 (src/layouts/MobileLayout.css)  
**Lines Changed:** 2 (z-index values)

