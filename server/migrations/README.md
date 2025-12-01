# Database Migrations

This folder contains database migration scripts for the Pryde Social refactor.

## Running Migrations

Migrations should be run in order, after deploying the corresponding backend changes.

### Phase 1: Remove Legacy Features

**Migration:** `phase1-cleanup-friends.js`

**Purpose:** Cleans up friend-related data from the database.

**What it does:**
- Clears `friends` arrays from all User documents
- Deletes all FriendRequest documents
- Preserves user accounts and posts

**When to run:** After deploying Phase 1 backend changes (tasks 1.1-1.4)

**How to run:**
```bash
cd server
node migrations/phase1-cleanup-friends.js
```

**Expected output:**
```
🔄 Connecting to MongoDB...
✅ Connected to MongoDB

📊 Counting documents before cleanup...
   - Users with friends: X
   - Friend requests: Y

🧹 Clearing friends arrays from User documents...
   ✅ Updated X users

🗑️  Deleting all FriendRequest documents...
   ✅ Deleted Y friend requests

✅ Verifying cleanup...
   - Users with friends: 0
   - Friend requests: 0

✅ Migration completed successfully!
   - All friends arrays cleared
   - All friend requests deleted
   - User accounts preserved
   - Posts preserved

🔌 Disconnected from MongoDB
```

## Safety Notes

- **Backup your database** before running any migration
- Migrations are **irreversible** - friend data will be permanently deleted
- Test migrations on a staging environment first
- Verify the migration completed successfully before proceeding

## Future Migrations

Additional migrations will be added for subsequent phases:
- Phase 2: Quiet Mode + Slow Feed
- Phase 3: Journaling + Longform Posts
- Phase 4: Community Tags + Discovery
- Phase 5: Creator Pages + Photo Essays
- Phase 6: Rebrand UI/UX Text

