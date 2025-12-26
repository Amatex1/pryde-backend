# Manual Smoke Test Checklist

**Version:** 1.0  
**Last Updated:** 2025-12-26  
**Purpose:** Prevent regression bugs by verifying core functionality before any merge or deployment

---

## 🔐 1. Authentication

| Test | Steps | Expected Result | Pass? |
|------|-------|-----------------|-------|
| Login | Enter valid credentials → Click login | Redirect to feed, user data loaded | ☐ |
| Login (invalid) | Enter wrong password | Error message shown, no redirect | ☐ |
| Logout | Click logout button | Session cleared, redirect to login | ☐ |
| Session persistence | Refresh page after login | User remains logged in | ☐ |
| Protected routes | Visit /feed without auth | Redirect to login page | ☐ |

---

## 📰 2. Feed

| Test | Steps | Expected Result | Pass? |
|------|-------|-----------------|-------|
| Load feed | Navigate to /feed | Posts load, no errors | ☐ |
| Scroll pagination | Scroll to bottom | More posts load | ☐ |
| Like post | Click like button | Like count updates, button toggles | ☐ |
| Unlike post | Click like button again | Like count decreases | ☐ |
| View comments | Click comment button | Comments section expands | ☐ |

---

## ✍️ 3. Posts

| Test | Steps | Expected Result | Pass? |
|------|-------|-----------------|-------|
| Create text post | Write content → Submit | Post appears in feed | ☐ |
| Create post with image | Add image → Submit | Post with image displays | ☐ |
| Edit own post | Click edit → Modify → Save | Changes saved and displayed | ☐ |
| Delete own post | Click delete → Confirm | Post removed from feed | ☐ |
| Add comment | Write comment → Submit | Comment appears under post | ☐ |
| Delete comment | Delete own comment | Comment removed | ☐ |

---

## 👥 4. Groups

| Test | Steps | Expected Result | Pass? |
|------|-------|-----------------|-------|
| View groups list | Navigate to /groups | Groups list loads | ☐ |
| Create group | Fill form → Submit | Group created, redirected | ☐ |
| Join group | Click join on public group | Membership confirmed | ☐ |
| Leave group | Click leave → Confirm | Removed from group | ☐ |
| Post in group | Create post in group | Post visible to members | ☐ |
| Group settings | Edit group as admin | Settings saved | ☐ |

---

## 💬 5. Messages

| Test | Steps | Expected Result | Pass? |
|------|-------|-----------------|-------|
| View conversations | Navigate to /messages | Conversation list loads | ☐ |
| Open conversation | Click on conversation | Messages load correctly | ☐ |
| Send message | Type → Send | Message appears in thread | ☐ |
| Receive message | Wait for incoming | New message notification | ☐ |
| Unread indicator | Have unread messages | Badge shows correct count | ☐ |
| Group chat | Open group conversation | All participants visible | ☐ |

---

## 🔔 6. Notifications

| Test | Steps | Expected Result | Pass? |
|------|-------|-----------------|-------|
| View notifications | Click notification bell | Notification list opens | ☐ |
| Notification count | Have unread notifications | Badge shows count | ☐ |
| Click notification | Click on notification | Navigate to relevant content | ☐ |
| Mark as read | Open notification panel | Notifications marked read | ☐ |
| Real-time updates | Trigger notification | Appears without refresh | ☐ |

---

## ⚙️ 7. Settings

| Test | Steps | Expected Result | Pass? |
|------|-------|-----------------|-------|
| View settings | Navigate to /settings | Settings page loads | ☐ |
| Update profile | Change display name → Save | Profile updated | ☐ |
| Update privacy | Toggle privacy setting | Setting persisted | ☐ |
| Change password | Enter new password → Save | Password changed | ☐ |
| Upload profile photo | Select image → Upload | Photo updated | ☐ |
| Blocked users | View blocked users list | List displays correctly | ☐ |

---

## 🛡️ 8. Admin Actions

| Test | Steps | Expected Result | Pass? |
|------|-------|-----------------|-------|
| Access admin panel | Navigate to /admin | Panel loads (admin only) | ☐ |
| View users list | Open users management | User list loads | ☐ |
| Moderate post | Delete/hide a post | Action completed | ☐ |
| Ban user | Ban a test account | User access restricted | ☐ |
| View reports | Open reports queue | Reports display | ☐ |
| System stats | View dashboard | Stats load correctly | ☐ |

---

## 📱 9. Mobile Responsiveness

| Test | Steps | Expected Result | Pass? |
|------|-------|-----------------|-------|
| Mobile nav | Open hamburger menu | Menu opens smoothly | ☐ |
| Mobile feed | Scroll feed on mobile | Smooth scrolling | ☐ |
| Mobile post | Create post on mobile | Works correctly | ☐ |
| Touch targets | Tap buttons on mobile | All buttons responsive | ☐ |

---

## ⚡ 10. Performance

| Test | Steps | Expected Result | Pass? |
|------|-------|-----------------|-------|
| Initial load | Load app cold | < 3s to interactive | ☐ |
| Feed load | Navigate to feed | Posts appear < 2s | ☐ |
| No console errors | Open dev tools | No red errors | ☐ |
| No network errors | Check network tab | All requests succeed | ☐ |

---

## 📋 Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tester | | | |
| Developer | | | |
| Reviewer | | | |

---

**Notes:**
- All tests must pass before merge/deploy
- Document any failures with screenshots
- Run on both Chrome and Firefox minimum
- Test on at least one mobile device

