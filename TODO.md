# Workspace Problems Fix - TODO

## Issues Identified
- [x] CSP violations for blob URLs during photo uploads
- [x] Socket connection error: "Session has been logged out"

## Fixes Applied
- [x] Updated CSP connect-src directive to include Vercel preview URLs
- [x] Blob URLs were already allowed in CSP (no change needed)

## Testing Required
- [ ] Test photo upload functionality in frontend
- [ ] Verify socket connections work properly
- [ ] Check CSP violations are resolved

## Notes
- The CSP already included 'blob:' in connect-src, so the main issue was likely the missing Vercel preview URLs
- Socket logout issue may require frontend investigation if it persists
