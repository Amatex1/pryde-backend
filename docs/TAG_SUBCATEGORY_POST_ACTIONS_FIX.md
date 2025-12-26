# Tag and Subcategory Pages - Post Actions Fix

## Summary
Fixed tag and subcategory pages so post actions (edit/delete) and comments behave correctly, matching the behavior of /feed and /profile pages.

## Changes Made

### Frontend Changes

#### 1. **TagFeed.jsx** (Community Tag Pages - `/tags/:slug`)

**Added:**
- Import `useNavigate` from react-router-dom
- Import `getCurrentUser` from auth utils
- Admin role check: `isAdmin = currentUser && ['moderator', 'admin', 'super_admin'].includes(currentUser.role)`

**Updated:**
- **Comment Button**: Changed from `<Link to="/feed">` to `navigate(\`/feed?post=${post._id}\`)` 
  - Now navigates to the specific post in the feed instead of just the feed homepage
  - Users can view and add comments properly

- **Delete Button Visibility**: Changed from `currentUser && post.author._id === currentUser.id` to `currentUser && (post.author._id === currentUser.id || isAdmin)`
  - Post authors can delete their own posts
  - Admins (moderator, admin, super_admin) can delete any post
  - Matches behavior of feed and profile pages

#### 2. **Hashtag.jsx** (Hashtag Pages - `/hashtag/:tag`)

**Added:**
- Import `useNavigate` from react-router-dom
- Import `getCurrentUser` from auth utils
- Admin role check: `isAdmin = currentUser && ['moderator', 'admin', 'super_admin'].includes(currentUser.role)`
- `handleDelete` function to delete posts with confirmation

**Updated:**
- **Comment Button**: Changed from non-functional button to `navigate(\`/feed?post=${post._id}\`)`
  - Now navigates to the specific post in the feed
  - Users can view and add comments properly

- **Delete Button**: Added delete button with admin check
  - Visible to post author OR admin
  - Includes confirmation dialog
  - Removes post from state on successful deletion

### Backend Changes

#### 3. **server/routes/posts.js**

**Updated POST Edit Route (`PUT /api/posts/:id`):**
```javascript
// Get user to check role
const user = await User.findById(userId);
const isAdmin = user && ['moderator', 'admin', 'super_admin'].includes(user.role);

// Check if user is the author OR admin
if (post.author.toString() !== userId.toString() && !isAdmin) {
  return res.status(403).json({ message: 'Not authorized to edit this post' });
}
```

**Updated POST Delete Route (`DELETE /api/posts/:id`):**
```javascript
// Get user to check role
const user = await User.findById(userId);
const isAdmin = user && ['moderator', 'admin', 'super_admin'].includes(user.role);

// Check if user is the author OR admin
if (post.author.toString() !== userId.toString() && !isAdmin) {
  return res.status(403).json({ message: 'Not authorized to delete this post' });
}
```

## Behavior

### Edit/Delete Permissions
Posts can be edited or deleted if:
- Current user is the post author, OR
- Current user has admin role (moderator, admin, or super_admin)
- This applies REGARDLESS of context (feed, profile, tag, hashtag)

### Comment Navigation
- Comment buttons now navigate to `/feed?post=${postId}`
- Feed page already handles the `?post=` query parameter
- Scrolls to the specific post and highlights it
- Opens comment box if `?comment=` parameter is also present

### Admin Roles
The following roles can edit/delete any post:
- `moderator`
- `admin`
- `super_admin`

Regular users (`role: 'user'`) can only edit/delete their own posts.

## Files Modified

### Frontend
1. `src/pages/TagFeed.jsx` - Community tag feed page
2. `src/pages/Hashtag.jsx` - Hashtag feed page

### Backend
3. `server/routes/posts.js` - Post edit and delete routes

## Testing Checklist

- [x] Comment button works on tag pages
- [x] Comment button works on hashtag pages
- [x] Comment button navigates to correct post
- [x] Edit/Delete visible to post authors
- [x] Edit/Delete visible to admins
- [x] Edit/Delete hidden from non-authors who aren't admins
- [x] Delete confirmation dialog appears
- [x] Backend allows post author to edit/delete
- [x] Backend allows admins to edit/delete
- [x] Backend blocks non-authors who aren't admins
- [x] Same behavior as /feed and /profile pages

## Notes

- The Feed page already had proper handling for the `?post=` query parameter
- No new routes were needed - leveraged existing Feed functionality
- Admin check is consistent across frontend and backend
- All three admin roles (moderator, admin, super_admin) have equal post management permissions

