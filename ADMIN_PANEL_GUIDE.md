# 🛡️ Admin Panel Guide

## Overview

The Admin Panel is a **hidden, secure management interface** for platform administrators to monitor user activity, manage reports, moderate content, and maintain the health of Pryde Social.

---

## 🔐 Access Control

### Admin Roles

The system supports **4 role levels**:

1. **User** (default) - Regular platform members
2. **Moderator** - Can view and resolve reports, view analytics
3. **Admin** - Can manage users, suspend/ban, plus all moderator permissions
4. **Super Admin** - Full access including managing other admins

### Permissions

Each role has specific permissions:

| Permission | Moderator | Admin | Super Admin |
|------------|-----------|-------|-------------|
| View Reports | ✅ | ✅ | ✅ |
| Resolve Reports | ✅ | ✅ | ✅ |
| View Analytics | ✅ | ✅ | ✅ |
| Manage Users | ❌ | ✅ | ✅ |
| Suspend/Ban Users | ❌ | ✅ | ✅ |
| Manage Admins | ❌ | ❌ | ✅ |

---

## 🚀 How to Access the Admin Panel

### Step 1: Make Yourself an Admin

You need to manually update your user account in MongoDB to grant admin access:

**Option A: Using MongoDB Atlas Web Interface (Recommended)**
1. Go to [https://cloud.mongodb.com](https://cloud.mongodb.com)
2. Log in to your MongoDB Atlas account
3. Click on your cluster (e.g., "Cluster0")
4. Click the **"Browse Collections"** button
5. Select your database (e.g., "pryde-social" or whatever you named it)
6. Click on the **"users"** collection
7. Find your user account:
   - Use the search/filter at the top
   - Search by email: `{ "email": "your-email@example.com" }`
8. Click on your user document to expand it
9. Click the **"Edit"** button (pencil icon)
10. Add these fields to your document:
    ```json
    "role": "super_admin",
    "permissions": {
      "canViewReports": true,
      "canResolveReports": true,
      "canManageUsers": true,
      "canViewAnalytics": true,
      "canManageAdmins": true
    }
    ```
11. Click **"Update"**

**Option B: Using MongoDB Atlas Shell (mongosh)**
1. In MongoDB Atlas, click **"Connect"** on your cluster
2. Choose **"Connect with MongoDB Shell"**
3. Copy the connection string and run it in your terminal
4. Once connected, run:
   ```javascript
   use your-database-name  // Replace with your actual database name

   db.users.updateOne(
     { email: "your-email@example.com" },
     {
       $set: {
         role: "super_admin",
         permissions: {
           canViewReports: true,
           canResolveReports: true,
           canManageUsers: true,
           canViewAnalytics: true,
           canManageAdmins: true
         }
       }
     }
   )
   ```

**Option C: Using MongoDB Compass (Desktop App)**
1. Download and install [MongoDB Compass](https://www.mongodb.com/try/download/compass)
2. Get your connection string from MongoDB Atlas:
   - Click **"Connect"** on your cluster
   - Choose **"Connect using MongoDB Compass"**
   - Copy the connection string
3. Open MongoDB Compass and paste the connection string
4. Navigate to your database → `users` collection
5. Find your user account (use the filter: `{ email: "your-email@example.com" }`)
6. Hover over the document and click the **pencil icon** to edit
7. Add/update these fields:
   ```json
   "role": "super_admin",
   "permissions": {
     "canViewReports": true,
     "canResolveReports": true,
     "canManageUsers": true,
     "canViewAnalytics": true,
     "canManageAdmins": true
   }
   ```
8. Click **"Update"**

### Step 2: Access the Admin Panel

1. Log in to your account
2. Navigate to: **`https://prydeapp.com/admin`** (or `http://localhost:3000/admin` in development)
3. The panel will verify your admin role and grant access

**Note:** The admin panel is **not linked anywhere** in the UI. Only people who know the URL can access it, and they must have admin privileges.

---

## 📊 Admin Panel Features

### 1. Dashboard Tab

**Overview statistics:**
- Total users, active users, suspended, banned
- New users this week
- Active users today
- Total posts and messages
- Pending reports
- Total blocks

### 2. Reports Tab

**Manage user reports:**
- View all pending reports
- See reporter, reported user, reason, and description
- Take actions:
  - ⚠️ **Warning** - Issue a warning to the user
  - 🗑️ **Remove Content** - Delete the reported content
  - ❌ **Dismiss** - Mark report as invalid

### 3. Users Tab

**User management:**
- Search users by username, email, or display name
- Filter by role or status
- View user details (username, email, role, status, join date)
- Actions:
  - ⏸️ **Suspend** - Temporarily suspend user (specify days and reason)
  - 🚫 **Ban** - Permanently ban user (specify reason)
  - 🔓 **Unsuspend** - Lift suspension
  - ✅ **Unban** - Lift ban

**Suspension vs Ban:**
- **Suspension:** Temporary (e.g., 7 days). User can't log in until suspension expires.
- **Ban:** Permanent. User account is deactivated and cannot log in.

### 4. Blocks Tab

**Monitor user blocks:**
- View all user blocks
- See who blocked whom
- View block dates and reasons
- Useful for identifying harassment patterns

### 5. Activity Tab

**Recent platform activity:**
- Recent posts (last 7 days)
- New users (last 7 days)
- Recent reports (last 7 days)
- Helps identify trends and issues

---

## 🔧 Backend API Endpoints

All admin endpoints require authentication + admin role.

### Statistics
- `GET /api/admin/stats` - Platform statistics (requires `canViewAnalytics`)

### Reports
- `GET /api/admin/reports` - Get all reports with filters (requires `canViewReports`)
- `PUT /api/admin/reports/:id` - Update report status (requires `canResolveReports`)

### Users
- `GET /api/admin/users` - Get all users with filters (requires `canManageUsers`)
- `PUT /api/admin/users/:id/suspend` - Suspend user (requires `canManageUsers`)
- `PUT /api/admin/users/:id/unsuspend` - Unsuspend user (requires `canManageUsers`)
- `PUT /api/admin/users/:id/ban` - Ban user (requires `canManageUsers`)
- `PUT /api/admin/users/:id/unban` - Unban user (requires `canManageUsers`)
- `PUT /api/admin/users/:id/role` - Update user role (requires `canManageAdmins`)

### Blocks
- `GET /api/admin/blocks` - Get all blocks (requires `canViewAnalytics`)

### Activity
- `GET /api/admin/activity` - Get recent activity (requires `canViewAnalytics`)

---

## 👥 Adding Team Members as Admins

To give your team admin access, use **MongoDB Atlas** to update their user documents:

### Method 1: MongoDB Atlas Web Interface

1. Go to [https://cloud.mongodb.com](https://cloud.mongodb.com)
2. Navigate to **Browse Collections** → your database → **users** collection
3. Find the team member's account (search by email)
4. Click **Edit** (pencil icon)
5. Add the appropriate role and permissions (see examples below)
6. Click **Update**

### Method 2: MongoDB Atlas Shell or Compass

Use one of these commands depending on the role you want to assign:

#### 1. Make Them a Moderator (Basic Access)
**Can view and resolve reports, view analytics**

```javascript
db.users.updateOne(
  { email: "team-member@example.com" },
  {
    $set: {
      role: "moderator",
      permissions: {
        canViewReports: true,
        canResolveReports: true,
        canManageUsers: false,
        canViewAnalytics: true,
        canManageAdmins: false
      }
    }
  }
)
```

#### 2. Make Them an Admin (Full User Management)
**Can suspend/ban users, plus all moderator permissions**

```javascript
db.users.updateOne(
  { email: "team-member@example.com" },
  {
    $set: {
      role: "admin",
      permissions: {
        canViewReports: true,
        canResolveReports: true,
        canManageUsers: true,
        canViewAnalytics: true,
        canManageAdmins: false
      }
    }
  }
)
```

#### 3. Make Them a Super Admin (Can Manage Other Admins)
**Full access including promoting/demoting other admins**

```javascript
db.users.updateOne(
  { email: "team-member@example.com" },
  {
    $set: {
      role: "super_admin",
      permissions: {
        canViewReports: true,
        canResolveReports: true,
        canManageUsers: true,
        canViewAnalytics: true,
        canManageAdmins: true
      }
    }
  }
)
```

**Recommendation:** Only give `super_admin` to people you trust completely, as they can promote/demote other admins.

---

## 🔒 Security Features

1. **Hidden URL** - Admin panel is not linked anywhere in the UI
2. **Role-Based Access** - Only users with admin roles can access
3. **Permission Checks** - Each action requires specific permissions
4. **Protection Against Self-Harm** - Admins cannot suspend/ban other admins (unless super admin)
5. **Audit Trail** - All report actions are logged with reviewer ID and timestamp
6. **Ban/Suspend Checks** - Banned/suspended users cannot log in

---

## ⚠️ Important Notes

1. **First Admin Setup:** You must manually set your first admin in MongoDB. After that, super admins can promote others via the API.

2. **No UI for Role Management Yet:** Currently, you must use MongoDB or the API to change user roles. A future update could add a UI for this in the admin panel.

3. **Regular Users Cannot See Admin Panel:** If a regular user tries to access `/admin`, they'll see "Access denied" and be redirected to the home page.

4. **Suspended Users:** When a suspended user tries to log in, they'll see a message with the suspension end date and reason.

5. **Banned Users:** Banned users cannot log in and will see a message with the ban reason.

---

## 🚀 Next Steps

1. **Set up your first admin account** using MongoDB
2. **Access the admin panel** at `/admin`
3. **Add your team members** as moderators or admins
4. **Start managing reports** and monitoring activity
5. **Consider adding more features:**
   - Email notifications for new reports
   - Bulk actions (ban multiple users at once)
   - Advanced analytics and charts
   - Content moderation queue
   - Admin activity logs

---

## 📞 Support

If you need help setting up the admin panel or have questions, refer to:
- `DATA_RESPONSIBILITY.md` - Your responsibilities as platform owner
- `TESTING_VERIFICATION.md` - Testing guide for all features
- Backend code: `server/routes/admin.js`
- Frontend code: `src/pages/Admin.jsx`

---

**Remember:** With great power comes great responsibility. Use admin privileges wisely and always follow your platform's Terms of Service and Community Guidelines when moderating content.

