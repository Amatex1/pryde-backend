# Comment System Migration Guide

## Problem

Comments are not showing up on posts because there are **two comment systems**:

1. **Old System**: Comments stored as embedded documents in `Post.comments` array
2. **New System**: Comments stored in separate `Comment` collection

The frontend is fetching from the new `Comment` collection, but existing comments are in the old `Post.comments` array.

## Solution

Run the migration script to move all comments from `Post.comments` to the `Comment` collection.

## Before Running Migration

### 1. Backup Your Database

```bash
# Create a backup
mongodump --uri="your_mongodb_uri" --out=./backup_before_comment_migration
```

### 2. Check Existing Comments

```bash
# Connect to MongoDB and check how many comments exist
mongo your_mongodb_uri

# Count posts with comments
db.posts.countDocuments({ "comments.0": { $exists: true } })

# Count existing Comment documents
db.comments.countDocuments({})
```

## Running the Migration

### Step 1: Navigate to Server Directory

```bash
cd server
```

### Step 2: Run Migration Script

```bash
node migrations/migrateCommentsToCollection.js
```

### Step 3: Verify Migration

The script will output:
- Number of posts processed
- Number of comments migrated
- Number of replies migrated
- Any errors or skipped comments

### Step 4: Check Results

```bash
# Connect to MongoDB
mongo your_mongodb_uri

# Count migrated comments
db.comments.countDocuments({})

# Check a sample comment
db.comments.findOne()
```

## What the Migration Does

1. ✅ Finds all posts with embedded comments
2. ✅ Creates `Comment` documents for each embedded comment
3. ✅ Preserves all data:
   - Content
   - Author
   - Timestamps (createdAt, editedAt)
   - Reactions (converted to new format)
   - GIF URLs
   - Edit status
4. ✅ Handles threaded comments (replies)
5. ✅ Skips already-migrated comments (safe to re-run)
6. ✅ Keeps old `Post.comments` array intact (for safety)

## After Migration

### Verify Comments Are Showing

1. Restart your server
2. Open the app in browser
3. Check posts - comments should now appear
4. Try adding a new comment - should work

### Optional: Clean Up Old Comments

After verifying everything works, you can optionally remove old comments from posts:

```javascript
// WARNING: Only run this after verifying migration worked!
db.posts.updateMany(
  {},
  { $set: { comments: [] } }
)
```

## Code Changes Made

### 1. Post Model (`server/models/Post.js`)

Added virtual field for `commentCount`:

```javascript
postSchema.virtual('commentCount', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'postId',
  count: true,
  match: { isDeleted: false, parentCommentId: null }
});
```

### 2. Posts Routes (`server/routes/posts.js`)

Added `.populate('commentCount')` to post queries to include the count.

### 3. Frontend Already Updated

The frontend (`src/pages/Feed.jsx`, `src/pages/Profile.jsx`) already:
- Fetches comments from `/api/posts/:postId/comments` (new Comment collection)
- Displays comments using `CommentThread` component
- Handles real-time comment updates

## Troubleshooting

### Comments Still Not Showing

1. **Check if migration ran successfully**
   ```bash
   db.comments.countDocuments({})
   ```

2. **Check browser console for errors**
   - Open DevTools → Console
   - Look for API errors

3. **Check server logs**
   - Look for errors when fetching comments

4. **Verify API endpoint**
   ```bash
   # Test the endpoint
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:5000/api/posts/POST_ID/comments
   ```

### Migration Errors

If migration fails:
1. Check MongoDB connection string
2. Ensure `Comment` model is properly imported
3. Check for duplicate comments (script skips them)
4. Review error messages in console

## Rollback (If Needed)

If something goes wrong:

1. **Restore from backup**
   ```bash
   mongorestore --uri="your_mongodb_uri" ./backup_before_comment_migration
   ```

2. **Old comments are still in `Post.comments`**
   - The migration doesn't delete old comments
   - Your data is safe

## Support

If you encounter issues:
1. Check the migration script output
2. Review server logs
3. Check MongoDB for data integrity
4. Verify frontend is fetching from correct endpoint

