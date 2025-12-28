# Quiet Mode V2 Specification

## Overview

Quiet Mode V2 is a sensory-aware feature designed to create a calmer, more intentional browsing experience. It reduces visual noise, motion, and social comparison triggers while maintaining full functionality.

## Design Philosophy

- **Calm over stimulation**: Reduce visual urgency and motion
- **Focus over distraction**: Minimize interruptions during writing
- **Presence over comparison**: Hide engagement metrics to reduce anxiety
- **User control**: Granular sub-toggles for personalized experience

## Data Attributes

Quiet Mode V2 uses HTML data attributes on the document root (`<html>`) element:

| Attribute | Values | Description |
|-----------|--------|-------------|
| `data-quiet` | `"true"` / `"false"` | Master toggle for quiet mode |
| `data-quiet-visuals` | `"true"` / `"false"` | Calm visuals sub-toggle |
| `data-quiet-writing` | `"true"` / `"false"` | Writing focus sub-toggle |
| `data-quiet-metrics` | `"true"` / `"false"` | Hide metrics sub-toggle |

## Sub-Toggles

### 1. Calm Visuals (`data-quiet-visuals`)
**Default: ON when quiet mode enabled**

Reduces motion and visual noise:
- Disables decorative animations (pulse, bounce, shake, wiggle)
- Removes hover transforms on buttons and cards
- Replaces shadows with subtle borders
- Reduces color saturation on CTAs
- Faster, subtler transitions (120ms vs 300ms)

### 2. Writing Focus (`data-quiet-writing`)
**Default: ON when quiet mode enabled**

Creates distraction-free writing environment:
- Hides sidebar and navigation during composition
- Removes social features from journal view
- Softer cursor/caret color
- Increased line height for readability
- Minimal chrome around text areas

### 3. Hide Metrics (`data-quiet-metrics`)
**Default: OFF (opt-in)**

Reduces social comparison anxiety:
- Hides reaction counts on posts
- Hides like/comment counts
- Hides follower/following numbers
- Hides trending numbers
- Hides notification count badges

## CSS Tokens

```css
[data-quiet="true"] {
  /* Spacing */
  --space-2: 10px;
  --space-3: 16px;
  --space-4: 22px;
  --space-5: 30px;
  --space-6: 40px;

  /* Typography */
  --line-height-body: 1.7;
  --line-height-writing: 1.85;

  /* Motion */
  --motion-fast: 120ms;
  --motion-normal: 180ms;
  --motion-ease: cubic-bezier(0.2, 0, 0, 1);

  /* Emphasis */
  --opacity-muted: 0.55;
  --opacity-soft: 0.75;

  /* Borders */
  --border-subtle: rgba(127, 127, 127, 0.15);
}
```

## JavaScript API

### Theme Manager Functions

```javascript
import { 
  setQuietMode,
  getQuietMode,
  setQuietSubToggle,
  getQuietSubToggle,
  getQuietModeSettings
} from '../utils/themeManager';

// Toggle main quiet mode
setQuietMode(true);

// Toggle sub-features
setQuietSubToggle('visuals', true);
setQuietSubToggle('writing', true);
setQuietSubToggle('metrics', false);

// Get current settings
const settings = getQuietModeSettings();
// { enabled: true, visuals: true, writing: true, metrics: false }
```

## Backend Schema

User privacy settings include:

```javascript
privacySettings: {
  quietModeEnabled: Boolean,  // Master toggle
  quietVisuals: Boolean,      // Default: true
  quietWriting: Boolean,      // Default: true
  quietMetrics: Boolean       // Default: false
}
```

## Settings UI

Located in Settings.jsx under "🌿 Quiet Mode" section:

1. **Main Toggle**: Enable/disable quiet mode
2. **Sub-toggles** (visible when quiet mode enabled):
   - 🎨 Calm Visuals
   - ✍️ Writing Focus
   - 📊 Hide Metrics

## Accessibility

- Respects `prefers-reduced-motion` system preference
- All toggles have proper ARIA labels
- Focus states remain visible
- Color contrast maintained in quiet mode

## Files Modified

- `src/styles/quiet-mode.css` - CSS tokens and rules
- `src/utils/themeManager.js` - JavaScript API
- `src/pages/Settings.jsx` - Settings UI
- `src/pages/Settings.css` - Settings styling
- `server/models/User.js` - Backend schema
- `server/routes/users.js` - API endpoint

## Future Considerations

- Automatic quiet hours (21:00-06:00)
- Per-page quiet mode overrides
- Quiet mode for specific content types
- Integration with system dark mode scheduling

