# 🔐 MongoDB Atlas - Admin Setup Guide

## Quick Guide: Make Yourself an Admin in MongoDB Atlas

Since you're using **MongoDB Atlas** (cloud-hosted MongoDB), here's the easiest way to make yourself an admin:

---

## ✅ **Recommended Method: MongoDB Atlas Web Interface**

### Step-by-Step Instructions:

1. **Go to MongoDB Atlas**
   - Visit: [https://cloud.mongodb.com](https://cloud.mongodb.com)
   - Log in with your MongoDB Atlas account

2. **Navigate to Your Cluster**
   - You'll see your cluster (probably named "Cluster0" or similar)
   - Click on the cluster name

3. **Browse Collections**
   - Click the **"Browse Collections"** button
   - This opens the data explorer

4. **Select Your Database**
   - You'll see a list of databases
   - Click on your Pryde Social database (e.g., "pryde-social", "test", or whatever you named it)

5. **Open the Users Collection**
   - Click on the **"users"** collection
   - You'll see a list of all user documents

6. **Find Your User Account**
   - Look for your user account in the list
   - OR use the filter at the top:
     ```json
     { "email": "your-email@example.com" }
     ```
   - Click the **Filter** button

7. **Edit Your User Document**
   - Click on your user document to expand it
   - Click the **"Edit"** button (looks like a pencil icon)

8. **Add Admin Fields**
   - Scroll down in the document editor
   - Add these two fields (you can copy-paste):
   
   **Add this after the existing fields:**
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

   **Your document should look something like this:**
   ```json
   {
     "_id": "...",
     "username": "yourname",
     "email": "your-email@example.com",
     "password": "...",
     "fullName": "Your Name",
     "displayName": "Your Display Name",
     "role": "super_admin",
     "permissions": {
       "canViewReports": true,
       "canResolveReports": true,
       "canManageUsers": true,
       "canViewAnalytics": true,
       "canManageAdmins": true
     },
     "isActive": true,
     "createdAt": "..."
   }
   ```

9. **Save Changes**
   - Click the **"Update"** button at the bottom
   - You should see a success message

10. **Done!**
    - Log out of Pryde Social (if you're logged in)
    - Log back in
    - Navigate to: `https://prydeapp.com/admin` (or `http://localhost:3000/admin` in dev)
    - You should now have access to the admin panel! 🎉

---

## 🔍 **Alternative: If You Can't Find the Edit Button**

If the web interface doesn't have an edit button, use the **MongoDB Atlas Shell**:

1. **In MongoDB Atlas, click "Connect"** on your cluster
2. **Choose "Connect with MongoDB Shell"**
3. **Follow the instructions** to install `mongosh` if you don't have it
4. **Copy the connection string** and run it in your terminal
5. **Once connected, run these commands:**

```javascript
// Switch to your database (replace with your actual database name)
use pryde-social

// Update your user to be a super admin
db.users.updateOne(
  { email: "your-email@example.com" },  // Replace with your actual email
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

// You should see: { acknowledged: true, matchedCount: 1, modifiedCount: 1 }
```

---

## 📝 **What Database Name Should I Use?**

If you're not sure what your database is called:

1. In MongoDB Atlas, click **"Browse Collections"**
2. You'll see a list of databases on the left side
3. Common names:
   - `pryde-social`
   - `test`
   - `myFirstDatabase`
   - Or whatever you named it when setting up

---

## ⚠️ **Troubleshooting**

### "I can't find my user account"
- Make sure you're looking in the correct database
- Try searching by username instead: `{ "username": "yourname" }`
- Make sure you've registered an account on Pryde Social first

### "The update didn't work"
- Make sure you're using the correct email address
- Check that the JSON syntax is correct (no missing commas or brackets)
- Try logging out and back in to Pryde Social

### "I still can't access /admin"
- Make sure you logged out and back in after updating your role
- Check the browser console for errors (F12 → Console tab)
- Verify the update worked by checking your user document in MongoDB Atlas again

---

## 🎯 **Quick Reference: Admin Roles**

| Role | Description | Use Case |
|------|-------------|----------|
| **user** | Regular member | Default for all users |
| **moderator** | Can view/resolve reports | Content moderators |
| **admin** | Can manage users (suspend/ban) | Platform administrators |
| **super_admin** | Full access, can manage other admins | You and trusted co-founders |

---

## 👥 **Adding Your Team**

Once you're a super admin, you can add team members the same way:

1. Have them create an account on Pryde Social first
2. Find their user document in MongoDB Atlas
3. Update their `role` and `permissions` fields
4. Tell them to log out and back in
5. Share the `/admin` URL with them

---

## 🔒 **Security Reminder**

- **Only give super_admin to people you trust completely**
- **Start team members as moderators** and promote them as needed
- **The /admin URL is hidden** - don't share it publicly
- **Keep your MongoDB Atlas credentials secure**

---

## 📞 **Need Help?**

If you're stuck, check:
- MongoDB Atlas documentation: [https://docs.atlas.mongodb.com](https://docs.atlas.mongodb.com)
- MongoDB Shell (mongosh) docs: [https://docs.mongodb.com/mongodb-shell](https://docs.mongodb.com/mongodb-shell)
- Or refer to `ADMIN_PANEL_GUIDE.md` for full admin panel documentation

