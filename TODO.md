# Push Notifications Fix - TODO Progress Tracker

## Approved Plan Steps (Confirmed by User)

### 1. ✅ Create TODO.md [Completed]

### 2. Environment Validation & Setup ✅
- [x] Generate VAPID keys if missing (`npx web-push generate-vap...)
- [x] Update `server/config/config.js` - Add VAPID validation
- [ ] Verify Redis/Firebase env vars

### 3. Core Push Handler Improvements
- [ ] Update `server/routes/pushNotifications.js` - Rate limiting, validation, TTL cleanup
- [ ] Update `server/queues/index.js` - Increase concurrency, dead-letter queue

### 4. Queue Wrapper (Async Delivery) ✅
- [x] Create `server/utils/queuePush.js` - Smart queue/sync fallback

### 5. Replace Sync Calls → Queued (Major Routes)
- [ ] `server/routes/comments.js`
- [ ] `server/routes/messages.js` 
- [ ] `server/routes/posts.js`
- [ ] `server/routes/loginApproval.js`
- [ ] `server/routes/reactions.js`
- [ ] Others (friends.js, follow.js, etc.)

### 6. Testing & Deployment
- [ ] Test `/api/push/test` endpoint
- [ ] Run production audit
- [ ] Deploy & monitor Render logs
- [ ] ✅ Complete task

**Next Step**: Update config.js for VAPID validation
