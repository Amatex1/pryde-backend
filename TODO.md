## Problem
Users unable to login to production site with 500 Internal Server Error: "Client must be connected before running operations"

## Root Cause
Race condition in server.js where the server starts listening for requests before the MongoDB database connection is established.

## MongoDB Lifecycle Manager Implementation

### Solution Implemented
- ✅ Created centralized `server/utils/dbManager.js` with connectDB/disconnectDB functions
- ✅ Refactored `server/server.js` to use dbManager instead of direct mongoose.connect
- ✅ Added mongoose connection event listeners for monitoring
- ✅ Converted `cleanupOldData.js` and `cleanupTempMedia.js` to pure workers
- ✅ Created safe CLI wrapper `server/cli/runCleanup.js`
- ✅ Ensured server never calls disconnectDB (only CLI wrappers do)

### Files Modified
- [x] `server/utils/dbManager.js` - New centralized database manager
- [x] `server/server.js` - Updated to use dbManager and added connection monitoring
- [x] `server/scripts/cleanupOldData.js` - Converted to pure worker
- [x] `server/scripts/cleanupTempMedia.js` - Converted to pure worker
- [x] `server/cli/runCleanup.js` - New safe CLI wrapper

### Implementation Complete ✅

**Key Changes Made:**
- ✅ Created `server/utils/dbManager.js` - Centralized database lifecycle manager
- ✅ Updated `server/server.js` - Uses dbManager and waits for DB readiness
- ✅ Converted scripts to pure workers - `cleanupOldData.js`, `cleanupTempMedia.js`
- ✅ Created CLI wrapper - `server/cli/runCleanup.js` for standalone execution
- ✅ Fixed database property access issue in cleanup script

### Testing Required
- [ ] Deploy to production and test login functionality
- [ ] Verify no more 500 errors on login endpoint
- [ ] Check server logs for proper database connection sequence
- [ ] Test CLI script execution via wrapper

### Expected Outcome
- **Login Issue Fixed**: Server waits for database connection before accepting requests
- **No Race Conditions**: Only server manages DB lifecycle, scripts assume connection exists
- **Improved Reliability**: Centralized connection management prevents accidental disconnects
- **Better Architecture**: Scripts are pure workers, CLI wrappers handle standalone execution

**Architecture Benefits:**
- Single source of truth for database connections
- Scripts never manage connections directly
- Server lifecycle owns the connection during normal operation
- CLI operations are properly isolated and managed
- No possibility of accidental DB disconnects
