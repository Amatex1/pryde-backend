# Audit System Troubleshooting Guide

## MongoDB Connection Issues

### Error: "bad auth : authentication failed"

This error occurs when the audit script cannot connect to MongoDB. Here are the solutions:

#### Solution 1: Check Environment Variable Name

Your `.env` file should have one of these variables:
- `MONGO_URI`
- `MONGO_URL`
- `MONGODB_URI`

**Current .env file has:** `MONGO_URI`

The audit script now supports all three names, but if you're still having issues, try adding:

```env
MONGO_URL=your_connection_string_here
MONGODB_URI=your_connection_string_here
```

#### Solution 2: Verify MongoDB Credentials

1. Check that your MongoDB Atlas credentials are correct
2. Verify the database name in the connection string
3. Make sure the user has read permissions

#### Solution 3: Whitelist Your IP Address

MongoDB Atlas requires your IP address to be whitelisted:

1. Go to MongoDB Atlas dashboard
2. Navigate to Network Access
3. Click "Add IP Address"
4. Either:
   - Add your current IP address
   - Add `0.0.0.0/0` to allow all IPs (not recommended for production)

#### Solution 4: Check Database User Permissions

The database user needs at least **read** permissions to run the audit:

1. Go to MongoDB Atlas dashboard
2. Navigate to Database Access
3. Check that the user `prydeAdmin` has:
   - Read access to the `pryde` database
   - Or `readWrite` or `dbAdmin` role

#### Solution 5: Test Connection Separately

Test if your MongoDB connection works:

```bash
# Start your server normally
cd server
npm run dev
```

If the server connects successfully, the audit should work too.

### Error: "MONGO_URI environment variable not set"

The `.env` file is not being loaded correctly.

**Solution:**
1. Make sure `.env` file exists in the root directory (not in `server/`)
2. Check that `.env` contains `MONGO_URI=...`
3. Try running from the root directory:

```bash
# From root directory
npm run audit
```

## Alternative: Run Dry Run Mode

If you can't connect to MongoDB but want to test the audit structure:

```bash
npm run audit:dry-run
```

This will simulate the audit without requiring a database connection.

## Alternative: Run Individual Audit Modules

You can also run individual audit modules programmatically:

```javascript
import runRouteAudit from './server/audit/modules/routeAudit.js';

const report = await runRouteAudit();
console.log(report);
```

## Common Issues

### Issue: Audit runs but shows no data

**Cause:** Database is empty or has no data

**Solution:** This is normal for a new installation. The audit will show 0 counts but should not fail.

### Issue: Audit times out

**Cause:** Large database or slow connection

**Solution:** Increase timeout in `runFullAudit.js`:

```javascript
await mongoose.connect(mongoURL, {
  serverSelectionTimeoutMS: 30000,  // Increase from 10000
  socketTimeoutMS: 60000,            // Increase from 45000
});
```

### Issue: Some audit modules fail

**Cause:** Missing models or configuration files

**Solution:** Check that all required files exist:
- `server/config/routes.js`
- `server/config/roles.js`
- All model files in `server/models/`

## Getting Help

If you're still having issues:

1. Check the error message carefully
2. Verify your MongoDB Atlas configuration
3. Try the dry run mode: `npm run audit:dry-run`
4. Check that your server runs normally: `cd server && npm run dev`

## Environment Variables Checklist

Make sure your `.env` file has:

```env
# MongoDB Connection (at least one of these)
MONGO_URI=mongodb+srv://...
# OR
MONGO_URL=mongodb+srv://...
# OR
MONGODB_URI=mongodb+srv://...

# JWT Secrets (required for some audits)
JWT_SECRET=your_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
CSRF_SECRET=your_csrf_secret_here

# Optional but recommended
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

## Success Indicators

When the audit runs successfully, you should see:

```
🚀 Starting Full Platform Audit...
=====================================

📡 Connecting to MongoDB...
✅ Connected to MongoDB

  Running routes audit...
  ✓ routes audit complete: 45 pass, 0 warn, 0 fail
  Running features audit...
  ✓ features audit complete: 300 pass, 0 warn, 0 fail
  ...

🎉 Full platform audit complete in 1234ms
   Health Score: 98/100
   Pass: 437, Warn: 14, Fail: 0
```

