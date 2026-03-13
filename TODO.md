# 2FA Enforcement for Admin Dashboard - Implementation Plan

## Status: [ ] 0/6 Complete

### [✅] Step 1: Create requireAdmin2FA middleware
**File**: `server/middleware/requireAdmin2FA.js` (CREATED)
```
✅ Check if req.user.role in ['super_admin','admin','moderator']
✅ AND !req.user.twoFactorEnabled && !req.user.pushTwoFactorEnabled  
✅ → 403 { code: 'ADMIN_2FA_REQUIRED', message: 'Admin accounts must enable 2FA...' }
```
**Status**: ✅ COMPLETE

### [✅] Step 2: Update login response (auth.js)
**File**: `server/routes/auth.js` (UPDATED)
```
✅ Added adminTwoFactorRequired flag to ALL login endpoints (/login, /verify-2fa-login, /verify-push-login)
✅ if (['super_admin','admin','moderator'].includes(user.role) && !twoFactorEnabled && !pushTwoFactorEnabled)
✅ Frontend receives adminTwoFactorRequired: true → redirect to 2FA setup
```
**Status**: ✅ COMPLETE

### [✅] Step 3: Protect admin routes  
**File**: `server/routeRegistry.js` (UPDATED)
```
✅ Added requireAdmin2FA to /api/admin and /api/admin/posts routes
✅ app.use('/api/admin', requireDatabaseReady, requireAdmin2FA, adminRoutes);
```
**Status**: ✅ COMPLETE

### [ ] Step 4: Test login flows
```
✅ Regular user → normal login
✅ Moderator no 2FA → login OK + adminTwoFactorRequired: true + /admin 403  
✅ Moderator WITH 2FA → full admin access
```

### [ ] Step 5: Frontend update note
```
Admin login receives adminTwoFactorRequired: true 
→ Redirect to /twoFactor/setup with message
→ After /verify → admin panel accessible
```

### [ ] Step 6: Deploy & verify
```
npm run build
Restart server
Test all 3 roles
Check logs for ADMIN_2FA_REQUIRED blocks
```

**Current Step: Update server/routes/auth.js (Step 2)**

