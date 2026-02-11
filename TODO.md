# Delete Account Flow Fixes - Implementation Plan

## Issues Identified
1. **Email confirmation not sent** - Delete request endpoint has TODO but doesn't send email ✅ FIXED
2. **Recovery security vulnerability** - Recover endpoint doesn't validate email
3. **No permanent deletion** - Soft-deleted accounts never actually deleted after 30 days
4. **Data loss on recovery** - Anonymized data not restored when recovering accounts
5. **Missing email function** - No email service function for deletion confirmations ✅ FIXED

## Implementation Plan

### Phase 1: Email Service & Confirmation ✅ COMPLETED
- [x] Add `sendAccountDeletionEmail` function to `server/utils/emailService.js`
- [x] Update `server/routes/users.js` delete-request endpoint to send confirmation email
- [x] Test email sending functionality

### Phase 2: Fix Recovery Security ✅ COMPLETED
- [x] Modify User schema to store original data before anonymization
- [x] Update delete-confirm endpoint to store original email/name/etc.
- [x] Fix recover endpoint to validate email and restore original data
- [x] Test recovery flow with proper validation

### Phase 3: Permanent Deletion Job ✅ COMPLETED
- [x] Add account deletion cleanup to `server/scripts/cleanupOldData.js`
- [x] Add scheduled job in `server/server.js` to run cleanup daily
- [x] Test permanent deletion after 30 days

### Phase 4: Testing & Validation
- [ ] Test complete delete account flow
- [ ] Test recovery within 30-day window
- [ ] Test permanent deletion after 30 days
- [ ] Verify security fixes prevent unauthorized recovery
