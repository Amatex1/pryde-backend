# MongoDB Connection Fix Guide

## Current Issue

Your audit system cannot connect to MongoDB with error:
```
bad auth : authentication failed
```

## What We Know

✅ Password is correct (you confirmed)  
✅ You are MongoDB admin  
✅ IP 0.0.0.0/0 is whitelisted  
✅ Password doesn't need URL encoding  
❌ Authentication still failing  

## Most Likely Causes

### 1. User Doesn't Have Access to the `pryde` Database

**Solution:**
1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Select your project
3. Click "Database Access" in left sidebar
4. Find user `prydeAdmin`
5. Click "Edit"
6. Under "Database User Privileges", make sure it has:
   - **Option A:** "Atlas admin" role (full access)
   - **Option B:** "Read and write to any database"
   - **Option C:** Specific privileges for database `pryde` with role `readWrite` or `dbAdmin`
7. Click "Update User"
8. Wait 1-2 minutes for changes to propagate

### 2. User Was Created in Different Database

The `authSource=admin` in your connection string means MongoDB will look for the user in the `admin` database.

**Check:**
1. In MongoDB Atlas → Database Access
2. Look at the "Authentication Method" for `prydeAdmin`
3. If it says "SCRAM" and was created in a different database, you need to update the connection string

**Try these connection strings in your `.env` file:**

```env
# Try without authSource
MONGO_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@pryde-social.bvs3dyu.mongodb.net/pryde?retryWrites=true&w=majority

# Try with authSource=pryde
MONGO_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@pryde-social.bvs3dyu.mongodb.net/pryde?retryWrites=true&w=majority&authSource=pryde
```

### 3. Password Was Recently Changed

If you recently changed the password in MongoDB Atlas:
1. Wait 1-2 minutes for changes to propagate
2. Make sure you updated the `.env` file with the new password
3. Try connecting again

### 4. User Doesn't Exist

**Create a new user:**
1. Go to MongoDB Atlas → Database Access
2. Click "Add New Database User"
3. Choose "Password" authentication
4. Username: `prydeAdmin` (or any name)
5. Password: Generate a secure password (save it!)
6. Database User Privileges: "Atlas admin" or "Read and write to any database"
7. Click "Add User"
8. Update your `.env` file with the new credentials

## Quick Test Commands

```bash
# Test MongoDB connection
npm run test:mongo

# Check connection string format
npm run fix:mongo

# Run audit in dry-run mode (no database needed)
npm run audit:dry-run
```

## Step-by-Step Fix

### Step 1: Verify User Exists

1. Go to MongoDB Atlas
2. Database Access
3. Look for `prydeAdmin`
4. If not found, create it (see "User Doesn't Exist" above)

### Step 2: Check User Permissions

1. Click "Edit" on the user
2. Make sure it has access to the `pryde` database
3. Recommended: "Read and write to any database"
4. Click "Update User"

### Step 3: Try Different Connection Strings

Edit your `.env` file and try each of these:

**Option 1: No authSource**
```env
MONGO_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@pryde-social.bvs3dyu.mongodb.net/pryde?retryWrites=true&w=majority
```

**Option 2: authSource=admin (current)**
```env
MONGO_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@pryde-social.bvs3dyu.mongodb.net/pryde?retryWrites=true&w=majority&authSource=admin
```

**Option 3: authSource=pryde**
```env
MONGO_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@pryde-social.bvs3dyu.mongodb.net/pryde?retryWrites=true&w=majority&authSource=pryde
```

After each change, test with:
```bash
npm run test:mongo
```

### Step 4: If Still Failing, Create New User

1. MongoDB Atlas → Database Access → Add New Database User
2. Username: `prydeBackend`
3. Password: (generate and save)
4. Privileges: "Atlas admin"
5. Add User
6. Update `.env`:
```env
MONGO_URI=mongodb+srv://prydeBackend:YOUR_NEW_PASSWORD@pryde-social.bvs3dyu.mongodb.net/pryde?retryWrites=true&w=majority
```

## Alternative: Use Existing Server Connection

If your server (`npm run server:dev`) connects successfully, you can copy its connection string:

1. Check if there's a `.env` file in the `server/` directory
2. Or check `server/config/config.js` for the connection string
3. Copy the working connection string to your root `.env` file

## Once Fixed

After MongoDB connection works:

```bash
# Test connection
npm run test:mongo

# Run full audit
npm run audit

# Save audit results
npm run audit:json
```

## Need More Help?

1. Check MongoDB Atlas logs: Clusters → ... → View Monitoring
2. Look for authentication errors in the logs
3. Verify the cluster is running (not paused)
4. Check if you're using the correct cluster URL

## Contact Info

If you're still stuck, provide:
- Screenshot of Database Access page (hide passwords)
- Screenshot of Network Access page
- Output of `npm run fix:mongo`
- Output of `npm run test:mongo`

