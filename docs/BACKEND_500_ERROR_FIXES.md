# Backend 500 Error Fixes

## Overview
Fixed two critical bugs causing 500 Internal Server Error responses on production backend.

---

## Issue 1: User Profile Endpoint (GET /api/users/:identifier)

### Error
```
GET https://pryde-backend.onrender.com/api/users/Amatex 500 (Internal Server Error)
```

### Root Cause
The `checkProfileVisibility` middleware in `server/middleware/privacy.js` was calling `.select()` on an already-fetched Mongoose document:

```javascript
// ❌ WRONG - .select() doesn't work on fetched documents
let profileUser = await getUserByIdOrUsername(profileIdentifier);
profileUser = await profileUser.select('_id privacySettings friends followers');
```

This caused a runtime error because `.select()` must be chained with the query, not called on the result.

### Fix
Moved `.select()` to be chained with the query:

```javascript
// ✅ CORRECT - .select() chained with query
if (mongoose.Types.ObjectId.isValid(profileIdentifier) && profileIdentifier.length === 24) {
  profileUser = await User.findById(profileIdentifier)
    .select('_id privacySettings friends followers');
} else {
  profileUser = await User.findOne({ username: profileIdentifier })
    .select('_id privacySettings friends followers');
}
```

### Files Changed
- `server/middleware/privacy.js`

### Commit
`4c8b298` - "Fix 500 error in checkProfileVisibility middleware"

---

## Issue 2: Admin Stats Endpoint (GET /api/admin/stats)

### Error
```
GET https://pryde-backend.onrender.com/api/admin/stats 500 (Internal Server Error)
```

### Root Cause
The `adminAuth` middleware in `server/middleware/adminAuth.js` had a bug when used directly as middleware:

```javascript
// ❌ WRONG - res and next are not defined in this scope
if (typeof allowedRoles === 'object' && allowedRoles.headers) {
  const req = allowedRoles;
  return adminAuthMiddleware(DEFAULT_ADMIN_ROLES)(req, res, next);  // ReferenceError!
}
```

When `router.use(adminAuth)` is called (direct usage), the function receives `(req, res, next)` as arguments, but the code was trying to reference `res` and `next` which were not in scope.

### Fix
Properly access `res` and `next` from the `arguments` object:

```javascript
// ✅ CORRECT - Access res and next from arguments
if (typeof allowedRoles === 'object' && allowedRoles.headers) {
  const req = allowedRoles;
  const res = arguments[1];
  const next = arguments[2];
  return adminAuthMiddleware(DEFAULT_ADMIN_ROLES)(req, res, next);
}
```

### Files Changed
- `server/middleware/adminAuth.js`

### Commit
`a8fae4a` - "Fix 500 error in admin routes - fix adminAuth middleware direct usage"

---

## Impact

### Before Fixes
- ❌ User profiles failed to load (500 error)
- ❌ Admin dashboard failed to load (500 error)
- ❌ All admin endpoints returned 500 errors

### After Fixes
- ✅ User profiles load correctly
- ✅ Admin dashboard loads correctly
- ✅ All admin endpoints work as expected

---

## Testing

The fixes have been deployed to production. To verify:

1. **User Profile Endpoint:**
   ```bash
   curl https://pryde-backend.onrender.com/api/users/Amatex
   ```
   Should return user data (or 404 if not found), not 500.

2. **Admin Stats Endpoint:**
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" https://pryde-backend.onrender.com/api/admin/stats
   ```
   Should return stats data (or 403 if not admin), not 500.

---

## Lessons Learned

1. **Mongoose Query Methods**: Always chain `.select()`, `.populate()`, etc. with the query, not on the result.
2. **Middleware Arguments**: When supporting both factory and direct usage patterns, properly handle the `arguments` object.
3. **Error Handling**: Generic 500 errors make debugging harder - consider adding more specific error messages in development.

---

## Related Files

- `server/middleware/privacy.js` - Profile visibility checks
- `server/middleware/adminAuth.js` - Admin authentication
- `server/routes/users.js` - User profile endpoint
- `server/routes/admin.js` - Admin endpoints

