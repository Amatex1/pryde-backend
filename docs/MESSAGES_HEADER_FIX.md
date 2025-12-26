# Messages Header Update Fix

## 🐛 Issue

When switching between conversations in `/messages`, the chat header (top bar) was not updating properly:

1. Click on "Test" user → Header shows "Test"
2. Click on "Notes to self" → Header shows "📝 Notes to self" ✅
3. Click back on "Test" (deactivated user) → Header still shows "📝 Notes to self" ❌

The header was showing the previous conversation's information instead of updating to the new conversation.

## 🔍 Root Cause

In `src/pages/Messages.jsx`, the `fetchChatInfo` function was setting the new user/group data but **not clearing the previous data first**. This caused a race condition where:

1. Old state (`selectedUser` or `selectedGroup`) remained visible
2. New API call fetched data
3. State updated, but React didn't re-render because the component thought nothing changed

## ✅ Solution

Updated the `fetchChatInfo` function to **immediately clear previous chat info** before fetching new data:

### Changes Made

**File:** `src/pages/Messages.jsx` (lines 260-313)

```javascript
const fetchChatInfo = async () => {
  try {
    // ✅ Clear previous chat info IMMEDIATELY when switching conversations
    setSelectedUser(null);
    setSelectedGroup(null);
    setIsRecipientUnavailable(false);
    setRecipientUnavailableReason('');

    if (selectedChatType === 'group') {
      const response = await api.get(`/groupchats/${selectedChat}`);
      setSelectedGroup(response.data);
    } else {
      const response = await api.get(`/users/${selectedChat}`);
      const user = response.data;
      setSelectedUser(user);

      // Check if recipient is unavailable for messaging
      const isDeleted = user.isDeleted === true;
      const isDeactivated = user.isActive === false;
      const hasBlocked = user.hasBlockedCurrentUser === true;

      if (isDeleted || isDeactivated || hasBlocked) {
        setIsRecipientUnavailable(true);
        if (isDeactivated) {
          setRecipientUnavailableReason("You can't message this account while it's deactivated.");
        } else {
          setRecipientUnavailableReason("You can't message this account.");
        }
      }
    }
  } catch (error) {
    logger.error('Error fetching chat info:', error);
    // ✅ Clear state on error too
    setSelectedUser(null);
    setSelectedGroup(null);
  }
};

// Also clear when no chat is selected
if (!selectedChat) {
  setSelectedUser(null);
  setSelectedGroup(null);
  setMessages([]);
  setIsRecipientUnavailable(false);
  setRecipientUnavailableReason('');
}
```

## 📊 Before & After

### Before:
1. Switch from "Notes to self" to "Test"
2. Header still shows "📝 Notes to self"
3. `selectedUser` state has old data
4. React doesn't re-render

### After:
1. Switch from "Notes to self" to "Test"
2. State immediately cleared: `selectedUser = null`, `selectedGroup = null`
3. React re-renders with loading state
4. New data fetched
5. Header updates to "Test" with "Account deactivated" subtitle ✅

## 🎯 Benefits

1. **Immediate visual feedback** - Header clears instantly when switching
2. **No stale data** - Previous conversation info doesn't linger
3. **Error handling** - State cleared even if API call fails
4. **Consistent behavior** - Works for user chats, group chats, and self-chats

## 🧪 Testing

Test the fix:
1. ✅ Open Messages page
2. ✅ Click on a user conversation
3. ✅ Click on "Notes to self"
4. ✅ Click back on the user conversation
5. ✅ Header should update immediately to show correct user
6. ✅ Deactivated users should show "Account deactivated" subtitle
7. ✅ Deleted users should show "Unknown User"

---

**Date:** 2025-12-24  
**Files Changed:** 1 (src/pages/Messages.jsx)  
**Lines Changed:** ~15 lines (added state clearing logic)

