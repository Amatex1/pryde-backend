# User Journey Stress Simulations

**Date:** 2026-01-12  
**Objective:** Test real user flows with failure scenarios and recovery  
**Status:** ✅ **READY FOR TESTING**

---

## OVERVIEW

This specification defines stress test scenarios for critical user journeys, including:
- ✅ Normal flow (happy path)
- ✅ Failure scenarios
- ✅ Recovery behavior
- ✅ Edge cases

---

## JOURNEY 1: USER REGISTRATION & LOGIN

### Happy Path
1. User visits registration page
2. Fills out form (username, email, password)
3. Submits form
4. Receives verification email
5. Clicks verification link
6. Account activated
7. Logs in successfully
8. Redirected to feed

**Expected:** ✅ All steps complete without errors

### Failure Scenarios

#### 1.1 Duplicate Username
- **Action:** Register with existing username
- **Expected:** Error message "Username already taken"
- **Recovery:** User tries different username
- **Result:** Registration succeeds

#### 1.2 Duplicate Email
- **Action:** Register with existing email
- **Expected:** Error message "Email already registered"
- **Recovery:** User tries different email or logs in
- **Result:** Registration succeeds or login succeeds

#### 1.3 Weak Password
- **Action:** Register with password "123"
- **Expected:** Error message "Password must be at least 8 characters"
- **Recovery:** User enters stronger password
- **Result:** Registration succeeds

#### 1.4 Network Failure During Registration
- **Action:** Submit form, network drops
- **Expected:** Error message "Network error, please try again"
- **Recovery:** User resubmits form
- **Result:** Registration succeeds (no duplicate created)

#### 1.5 Email Verification Link Expired
- **Action:** Click verification link after 24 hours
- **Expected:** Error message "Link expired, request new verification"
- **Recovery:** User requests new verification email
- **Result:** New link sent, verification succeeds

---

## JOURNEY 2: CREATE POST & RECEIVE ENGAGEMENT

### Happy Path
1. User creates post with text and image
2. Post appears in feed immediately
3. Friends see post in their feed
4. Friend likes post
5. User receives notification
6. Friend comments on post
7. User receives notification
8. User replies to comment
9. Friend receives notification

**Expected:** ✅ All real-time updates work

### Failure Scenarios

#### 2.1 Image Upload Fails
- **Action:** Upload 50MB image
- **Expected:** Error message "Image too large (max 10MB)"
- **Recovery:** User compresses image and retries
- **Result:** Upload succeeds

#### 2.2 Network Drops During Post Creation
- **Action:** Submit post, network drops
- **Expected:** Error message "Failed to create post"
- **Recovery:** User resubmits post
- **Result:** Post created (no duplicate)

#### 2.3 Socket Disconnects During Engagement
- **Action:** Friend likes post, socket disconnects
- **Expected:** Notification queued, delivered on reconnect
- **Recovery:** Socket reconnects automatically
- **Result:** Notification received

#### 2.4 Notification Fails to Deliver
- **Action:** Friend comments, notification service down
- **Expected:** Notification stored in database
- **Recovery:** User refreshes page
- **Result:** Notification appears in bell icon

---

## JOURNEY 3: DIRECT MESSAGING

### Happy Path
1. User opens messages
2. Selects friend to message
3. Types message
4. Sends message
5. Friend receives message in real-time
6. Friend replies
7. User receives reply in real-time
8. Conversation persists after refresh

**Expected:** ✅ All messages delivered and persisted

### Failure Scenarios

#### 3.1 Message Fails to Send
- **Action:** Send message, network drops
- **Expected:** Message shows "Sending..." then "Failed"
- **Recovery:** User clicks retry
- **Result:** Message sends successfully

#### 3.2 Message Delivered But Not Persisted
- **Action:** Send message, database write fails
- **Expected:** Message appears locally but not in database
- **Recovery:** User refreshes page
- **Result:** Message missing, user resends

#### 3.3 Socket Disconnects During Conversation
- **Action:** Typing message, socket disconnects
- **Expected:** "Reconnecting..." indicator appears
- **Recovery:** Socket reconnects automatically
- **Result:** Message sends after reconnect

#### 3.4 Recipient Offline
- **Action:** Send message to offline user
- **Expected:** Message stored in database
- **Recovery:** Recipient comes online
- **Result:** Message delivered on next login

---

## JOURNEY 4: COMMENT THREADING

### Happy Path
1. User views post with comments
2. Reads parent comment
3. Clicks "Reply"
4. Types reply
5. Submits reply
6. Reply appears nested under parent
7. Parent comment author receives notification
8. Can reply up to depth 3

**Expected:** ✅ Threading works correctly

### Failure Scenarios

#### 4.1 Reply to Deleted Comment
- **Action:** Parent comment deleted while user typing reply
- **Expected:** Error message "Comment no longer exists"
- **Recovery:** User posts as top-level comment instead
- **Result:** Comment created at depth 0

#### 4.2 Max Depth Exceeded
- **Action:** Try to reply at depth 3
- **Expected:** Reply button disabled, max depth notice shown
- **Recovery:** User posts as top-level comment
- **Result:** Comment created at depth 0

#### 4.3 Duplicate Reply Submitted
- **Action:** Click submit twice quickly
- **Expected:** Only one reply created
- **Recovery:** Deduplication prevents duplicate
- **Result:** Single reply appears

---

## JOURNEY 5: PROFILE UPDATE

### Happy Path
1. User opens profile settings
2. Updates display name
3. Uploads new profile photo
4. Updates bio
5. Saves changes
6. Changes reflected immediately
7. Friends see updated profile

**Expected:** ✅ All updates persist and propagate

### Failure Scenarios

#### 5.1 Profile Photo Upload Fails
- **Action:** Upload corrupted image
- **Expected:** Error message "Invalid image file"
- **Recovery:** User uploads valid image
- **Result:** Upload succeeds

#### 5.2 Network Drops During Save
- **Action:** Click save, network drops
- **Expected:** Error message "Failed to save changes"
- **Recovery:** User clicks save again
- **Result:** Changes saved

#### 5.3 Concurrent Updates
- **Action:** User updates profile in two tabs
- **Expected:** Last write wins
- **Recovery:** User refreshes to see latest
- **Result:** Latest changes visible

---

## JOURNEY 6: SEARCH & DISCOVERY

### Happy Path
1. User types in search box
2. Results appear in real-time
3. User clicks on user result
4. Profile loads
5. User sends friend request
6. Recipient receives notification

**Expected:** ✅ Search and discovery work

### Failure Scenarios

#### 6.1 Search Returns No Results
- **Action:** Search for non-existent user
- **Expected:** "No results found" message
- **Recovery:** User tries different search term
- **Result:** Results appear

#### 6.2 Search Service Down
- **Action:** Type in search box, service down
- **Expected:** Error message "Search unavailable"
- **Recovery:** User refreshes page
- **Result:** Search works

---

## STRESS TEST SCENARIOS

### Scenario 1: High Concurrency
- **Action:** 100 users create posts simultaneously
- **Expected:** All posts created, no duplicates
- **Verify:** Database has exactly 100 new posts

### Scenario 2: Rapid Socket Reconnects
- **Action:** Disconnect/reconnect socket 10 times in 1 minute
- **Expected:** No duplicate notifications, no memory leaks
- **Verify:** Notification count correct, memory stable

### Scenario 3: Long-Running Session
- **Action:** Keep session open for 24 hours
- **Expected:** No token expiration, no memory leaks
- **Verify:** User can still perform actions, memory stable

### Scenario 4: Large Data Load
- **Action:** Load feed with 1000 posts
- **Expected:** Smooth scrolling, no lag
- **Verify:** Virtual scrolling works, memory stable

### Scenario 5: Offline/Online Cycling
- **Action:** Go offline, perform actions, go online
- **Expected:** Actions queued, executed on reconnect
- **Verify:** All actions completed, no data loss

---

## AUTOMATED TESTING

### Playwright Test Example

```javascript
// tests/user-journey.spec.js

import { test, expect } from '@playwright/test';

test.describe('User Journey: Registration & Login', () => {
  test('should handle duplicate username gracefully', async ({ page }) => {
    await page.goto('/register');
    
    // Try to register with existing username
    await page.fill('[name="username"]', 'existinguser');
    await page.fill('[name="email"]', 'new@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Expect error message
    await expect(page.locator('.error-message')).toContainText('Username already taken');
    
    // Recovery: Try different username
    await page.fill('[name="username"]', 'newuser');
    await page.click('button[type="submit"]');
    
    // Expect success
    await expect(page).toHaveURL('/verify-email');
  });
  
  test('should handle network failure during registration', async ({ page, context }) => {
    await page.goto('/register');
    
    // Fill form
    await page.fill('[name="username"]', 'testuser');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    
    // Simulate network failure
    await context.setOffline(true);
    await page.click('button[type="submit"]');
    
    // Expect error message
    await expect(page.locator('.error-message')).toContainText('Network error');
    
    // Recovery: Restore network and retry
    await context.setOffline(false);
    await page.click('button[type="submit"]');
    
    // Expect success (no duplicate created)
    await expect(page).toHaveURL('/verify-email');
  });
});
```

---

## ACCEPTANCE CRITERIA

✅ **Happy Paths**
- All user journeys complete successfully
- Real-time updates work
- Data persists correctly

✅ **Failure Scenarios**
- Errors handled gracefully
- User-friendly error messages
- Recovery paths clear

✅ **Recovery Behavior**
- Users can retry failed actions
- No duplicate data created
- State remains consistent

✅ **Stress Tests**
- High concurrency handled
- No memory leaks
- Performance stable

---

**Status:** ✅ READY FOR TESTING  
**Estimated Time:** 8-12 hours (comprehensive testing)  
**Tools Required:** Playwright, network throttling, load testing tools

