# 📱 Pryde Social - Mobile Testing Checklist

## 🎯 Testing Overview

This checklist covers all critical mobile UX paths for Pryde Social. Test on:
- **iOS Safari** (iPhone 12+, iOS 15+)
- **Android Chrome** (Samsung Galaxy S21+, Android 11+)
- **Tablet** (iPad, Android tablet)

---

## ✅ Pre-Testing Setup

### Test Accounts
- [ ] Create 2 test accounts (User A, User B)
- [ ] User A follows User B
- [ ] User B has public, followers-only, and private content
- [ ] Both users have profile photos and cover photos

### Test Data
- [ ] Upload test images (small: 100KB, medium: 1MB, large: 5MB)
- [ ] Prepare test videos (if supported)
- [ ] Have long text ready (500+ characters)
- [ ] Have emoji and special characters ready

---

## 🔐 Authentication Flow

### Registration
- [ ] Open registration page on mobile
- [ ] Birthday dropdowns are touch-friendly (min 44px)
- [ ] Month/Day/Year dropdowns work correctly
- [ ] Selecting birthday under 18 shows error
- [ ] Password strength indicator displays correctly
- [ ] Username availability checker works
- [ ] hCaptcha loads and works on mobile
- [ ] Form doesn't zoom when focusing inputs (16px font)
- [ ] Submit button is accessible without scrolling
- [ ] Success message displays correctly
- [ ] Redirects to login after registration

### Login
- [ ] Email/username input doesn't zoom on focus
- [ ] Password field shows/hides correctly
- [ ] "Remember me" checkbox is touch-friendly
- [ ] Login button is accessible
- [ ] Error messages display clearly
- [ ] 2FA push notification appears (if enabled)
- [ ] 2FA approval code is readable
- [ ] Login succeeds and redirects to feed

### Password Reset
- [ ] "Forgot password" link is clickable
- [ ] Email input doesn't zoom
- [ ] Submit button works
- [ ] Success message displays
- [ ] Email arrives (check inbox)
- [ ] Reset link works on mobile
- [ ] New password form works
- [ ] Password changed successfully

---

## 📰 Feed & Posts

### Feed Scrolling
- [ ] Feed loads on mobile
- [ ] Infinite scroll works smoothly
- [ ] Pull-to-refresh works (if implemented)
- [ ] Posts display correctly (no overflow)
- [ ] Images load and fit screen width
- [ ] Videos play inline (if supported)
- [ ] No horizontal scrolling

### Create Post
- [ ] "Create post" button is accessible
- [ ] Post input expands correctly
- [ ] Keyboard doesn't cover input
- [ ] Media upload button works
- [ ] Camera access works (if implemented)
- [ ] Gallery picker works
- [ ] Image preview displays correctly
- [ ] Multiple images display in grid
- [ ] Privacy dropdown works
- [ ] GIF picker works (if implemented)
- [ ] Poll creator works (if implemented)
- [ ] Submit button is accessible
- [ ] Post appears in feed immediately

### Interact with Posts
- [ ] Like button is touch-friendly
- [ ] Like animation works
- [ ] Comment button opens comment box
- [ ] Comment input doesn't zoom
- [ ] Keyboard doesn't cover comment input
- [ ] Submit comment button works
- [ ] Comment appears immediately
- [ ] Share button works (if implemented)
- [ ] Privacy controls accessible
- [ ] "Hide from" modal works on mobile
- [ ] Friend checklist is scrollable
- [ ] Save button works

### Media Viewing
- [ ] Tap image to open fullscreen
- [ ] Pinch to zoom works
- [ ] Swipe to next/previous image works
- [ ] Close button is accessible
- [ ] Video controls work
- [ ] Fullscreen video works
- [ ] Back button closes media viewer

---

## 💬 Chat & Messaging

### Mini Chat Boxes
- [ ] Chat icon is accessible
- [ ] Chat list opens correctly
- [ ] Tap user to open mini chat
- [ ] Mini chat displays correctly on mobile
- [ ] Chat input doesn't zoom
- [ ] Keyboard doesn't cover input
- [ ] Send button is accessible
- [ ] Messages appear immediately
- [ ] Minimize button works
- [ ] Close button works
- [ ] Open multiple chats (test 3-5)
- [ ] Chats stack correctly on mobile
- [ ] Scroll through chat history works
- [ ] Unread badge displays correctly

### Message Features
- [ ] Voice recording button works
- [ ] Voice recording UI displays correctly
- [ ] Stop/send recording works
- [ ] Audio playback works
- [ ] GIF picker opens correctly
- [ ] GIF search works
- [ ] Select GIF sends message
- [ ] Emoji picker works
- [ ] Image upload works
- [ ] Image preview displays correctly

---

## 👤 Profile

### View Profile
- [ ] Profile loads correctly
- [ ] Cover photo displays full width
- [ ] Profile photo overlaps cover photo
- [ ] Bio text wraps correctly
- [ ] Stats (followers, following) display correctly
- [ ] Tabs (Posts, Photos, etc.) are touch-friendly
- [ ] Tab content loads correctly
- [ ] No horizontal scrolling

### Edit Profile
- [ ] Edit button is accessible
- [ ] Edit form displays correctly
- [ ] Upload profile photo works
- [ ] Upload cover photo works
- [ ] Crop tool works on mobile (if implemented)
- [ ] Bio textarea expands correctly
- [ ] Save button is accessible
- [ ] Changes save successfully
- [ ] Profile updates immediately

### Profile Content
- [ ] Posts tab shows user's posts
- [ ] Photo essays tab works
- [ ] Journals tab works
- [ ] Longform tab works
- [ ] Content respects privacy settings
- [ ] Empty states display correctly

---

## 🔔 Notifications

### Notification Center
- [ ] Notification icon shows badge
- [ ] Tap icon opens notification list
- [ ] Notifications display correctly
- [ ] Tap notification navigates correctly
- [ ] Mark as read works
- [ ] Clear all works
- [ ] No horizontal scrolling

### Push Notifications
- [ ] Push notification permission prompt appears
- [ ] Allow notifications works
- [ ] Push notification arrives
- [ ] Notification displays correctly
- [ ] Tap notification opens app
- [ ] Sound plays (if enabled)
- [ ] Badge updates correctly

---

## 🎨 UI/UX Elements

### Navigation
- [ ] Hamburger menu button works
- [ ] Menu slides out correctly
- [ ] Menu items are touch-friendly
- [ ] Close menu works (tap outside)
- [ ] Bottom nav works (if implemented)
- [ ] Back button behavior is correct
- [ ] Deep links work

### Modals & Overlays
- [ ] Modals display correctly on mobile
- [ ] Modal content is scrollable
- [ ] Close button is accessible
- [ ] Tap outside closes modal (if intended)
- [ ] Keyboard doesn't break modal layout
- [ ] Bottom sheet works (if implemented)

### Forms & Inputs
- [ ] All inputs are 16px font (no zoom)
- [ ] Touch targets are min 44px
- [ ] Dropdowns work correctly
- [ ] Checkboxes are touch-friendly
- [ ] Radio buttons are touch-friendly
- [ ] Date pickers work
- [ ] File upload works
- [ ] Form validation displays correctly

---

## 🚀 Performance

### Load Times
- [ ] Initial page load < 3 seconds
- [ ] Feed loads < 2 seconds
- [ ] Images load progressively
- [ ] Lazy loading works
- [ ] No layout shift during load

### Responsiveness
- [ ] Tap response < 100ms
- [ ] Scroll is smooth (60fps)
- [ ] Animations are smooth
- [ ] No janky transitions
- [ ] App feels native

### Offline Behavior
- [ ] Offline message displays
- [ ] Cached content loads
- [ ] Service worker works (if implemented)
- [ ] Reconnect works automatically

---

## 🐛 Edge Cases

### Network Issues
- [ ] Slow 3G simulation works
- [ ] Failed image upload shows error
- [ ] Retry mechanism works
- [ ] Timeout handling works

### Device Rotation
- [ ] Portrait to landscape works
- [ ] Layout adjusts correctly
- [ ] No content loss on rotation
- [ ] Keyboard dismisses on rotation

### Long Content
- [ ] Long usernames truncate correctly
- [ ] Long post text wraps correctly
- [ ] Long comments display correctly
- [ ] Overflow is handled gracefully

### Multiple Sessions
- [ ] Login on second device works
- [ ] Logout on one device works
- [ ] Session sync works (if implemented)

---

## 📊 Testing Results

### Device: _____________
### OS Version: _____________
### Browser: _____________
### Date: _____________

**Overall Score:** _____ / 100

**Critical Issues Found:**
1. 
2. 
3. 

**Minor Issues Found:**
1. 
2. 
3. 

**Notes:**


---

## 🎯 Priority Fixes

### P0 - Critical (Blocks Usage)
- [ ] 

### P1 - High (Major UX Issue)
- [ ] 

### P2 - Medium (Minor UX Issue)
- [ ] 

### P3 - Low (Nice to Have)
- [ ] 

