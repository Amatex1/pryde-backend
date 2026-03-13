# Pryde Backend Lint Fix TODO

## Status: 🔄 In Progress (Parsing errors → Unused vars → Full clean)

### Step 1: Fix Parsing Errors (Critical - Block Linting)
- [x] server/routes/posts.js (line 228: Unexpected token ')')
- [x] server/jobs/inactivityEmailJob.js (line 116: Duplicate function - remove plain function body)
```
cd server && npm run lint -- --fix
```

### Step 2: Fix no-unused-vars (103 warnings)
**Priority Files (from lint output):**
```
server/jobs/inactivityEmailJob.js (mongoose → used in other jobs?)
server/jobs/weeklyThemesJob.js (Post → used in wasThemePostedThisWeek)
server/jobs/releaseQueuedNotifications.js (mongoose)
server/middleware/moderation.js (_enforcementSettings → remove)
server/middleware/rateLimiter.js (req params → fix ESLint TS rule)
server/middleware/sessionMiddleware.js (_sessionTimeout → remove)
server/routes/admin.js (unused functions → comment/remove)
server/server.js (54-82: unused limiters → comment block)
```
- [ ] Remove/comment dead imports
- [ ] server.js: Unused limiters → `// DISABLED: Scale horizontally` comment block

### Step 3: Verify & Complete
```
cd server && npm run lint
```
- [ ] Zero errors/warnings
- [ ] `attempt_completion` ✅

**Recent Commits Check:** Bring back deleted imports if referenced (git log needed → will search_files post-fix)

**Progress Tracking:** Update after each batch edit.

