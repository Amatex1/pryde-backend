# 🔧 Troubleshooting Guide

Common issues and solutions for Pryde Social deployment.

## Frontend Issues (SiteGround)

### Issue: 404 Error on Page Refresh

**Symptoms**: Navigating works, but refreshing the page shows 404 error.

**Cause**: Apache doesn't know how to handle React Router URLs.

**Solution**:
1. Ensure `.htaccess` file is uploaded to `public_html`
2. Verify `.htaccess` contains the rewrite rules
3. Check that mod_rewrite is enabled (contact SiteGround if not)

```bash
# Verify .htaccess exists
ls -la public_html/.htaccess
```

### Issue: Blank White Page

**Symptoms**: Site loads but shows only a blank white page.

**Cause**: JavaScript errors or missing files.

**Solution**:
1. Open browser DevTools (F12)
2. Check Console tab for errors
3. Check Network tab for failed requests
4. Common fixes:
   - Re-upload all files from `dist` folder
   - Clear browser cache (Ctrl+Shift+Delete)
   - Verify all files in `assets` folder uploaded

### Issue: API Calls Failing / CORS Errors

**Symptoms**: Console shows CORS errors or "Failed to fetch"

**Cause**: Backend URL incorrect or CORS not configured.

**Solution**:
1. Check `.env.production` has correct backend URL
2. Rebuild frontend: `npm run build`
3. Re-upload to SiteGround
4. Verify backend CORS includes your domain
5. Check backend is running (visit health endpoint)

```env
# .env.production should have:
VITE_API_URL=https://your-backend.onrender.com/api
VITE_SOCKET_URL=https://your-backend.onrender.com
```

### Issue: Images/Assets Not Loading

**Symptoms**: Broken image icons, missing styles.

**Cause**: Assets folder not uploaded or incorrect paths.

**Solution**:
1. Verify entire `assets` folder uploaded
2. Check file permissions (644 for files, 755 for folders)
3. Clear browser cache
4. Check browser console for 404 errors

### Issue: SSL/HTTPS Not Working

**Symptoms**: Site shows "Not Secure" or SSL errors.

**Cause**: SSL certificate not installed or not forced.

**Solution**:
1. In cPanel → Security → SSL Manager
2. Install Let's Encrypt SSL certificate
3. Enable "Force HTTPS Redirect"
4. Wait 5-10 minutes for propagation
5. Clear browser cache

## Backend Issues (Render.com)

### Issue: Build Fails

**Symptoms**: Deployment fails during build phase.

**Cause**: Missing dependencies or incorrect build command.

**Solution**:
1. Check Render logs for specific error
2. Verify build command: `cd server && npm install`
3. Ensure `server/package.json` exists
4. Check Node.js version compatibility
5. Try manual deploy from Render dashboard

### Issue: Database Connection Failed

**Symptoms**: Logs show "MongoDB connection error"

**Cause**: Incorrect connection string or IP not whitelisted.

**Solution**:
1. Verify `MONGO_URL` environment variable
2. Check MongoDB Atlas:
   - Network Access → IP Whitelist → 0.0.0.0/0
   - Database Access → User exists with correct password
3. Test connection string format:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/pryde-social?retryWrites=true&w=majority
   ```
4. Ensure password doesn't contain special characters (or URL encode them)

### Issue: 502 Bad Gateway

**Symptoms**: Backend URL shows 502 error.

**Cause**: Service starting up (free tier) or crashed.

**Solution**:
1. **If just deployed**: Wait 30-60 seconds (free tier spin-up)
2. Check Render logs for errors
3. Verify all environment variables are set
4. Check if service is running in Render dashboard
5. Try manual restart from dashboard

### Issue: CORS Errors from Frontend

**Symptoms**: Frontend can't connect, CORS errors in console.

**Cause**: Frontend domain not in CORS whitelist.

**Solution**:
1. Check `FRONTEND_URL` environment variable in Render
2. Should match your domain exactly: `https://prydeapp.com`
3. Verify CORS configuration in `server/server.js`
4. Redeploy backend after changes
5. Check Render logs for "CORS blocked origin" messages

### Issue: JWT Authentication Fails

**Symptoms**: Login works but sessions don't persist.

**Cause**: JWT_SECRET not set or changed.

**Solution**:
1. Verify `JWT_SECRET` environment variable exists
2. Generate new secret if needed:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
3. Add to Render environment variables
4. Redeploy service

### Issue: WebSocket/Real-time Features Not Working

**Symptoms**: Messages don't appear in real-time.

**Cause**: Socket.IO connection failing.

**Solution**:
1. Check browser console for Socket.IO errors
2. Verify `VITE_SOCKET_URL` in frontend (no `/api`)
3. Check Render logs for Socket.IO connections
4. Ensure CORS allows WebSocket connections
5. Test with: `https://your-backend.onrender.com/socket.io/socket.io.js`

## Integration Issues

### Issue: Can't Register/Login

**Symptoms**: Registration or login fails with error.

**Cause**: Database connection, validation, or API issues.

**Solution**:
1. Check browser console for errors
2. Check Render logs for backend errors
3. Verify database connection is working
4. Test API endpoint directly:
   ```bash
   curl -X POST https://your-backend.onrender.com/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@test.com","password":"test123","username":"testuser"}'
   ```

### Issue: Images Won't Upload

**Symptoms**: Image upload fails or shows error.

**Cause**: File size limit or upload configuration.

**Solution**:
1. Check file size (limit is 10MB)
2. Verify Multer configuration in backend
3. Check Render logs for upload errors
4. Ensure proper Content-Type headers

### Issue: Slow Performance

**Symptoms**: App is slow to load or respond.

**Cause**: Free tier limitations or unoptimized queries.

**Solution**:
1. **Free tier spin-down**: First request takes 30-60 seconds
2. Consider upgrading Render plan for production
3. Optimize database queries
4. Enable caching where appropriate
5. Compress images before upload

## Environment Variable Issues

### Issue: Environment Variables Not Working

**Symptoms**: App uses default values instead of env vars.

**Cause**: Variables not set or incorrect names.

**Solution**:
1. **Frontend**: Rebuild after changing `.env.production`
   ```bash
   npm run build
   ```
2. **Backend**: Verify in Render dashboard → Environment
3. Check variable names match exactly (case-sensitive)
4. Restart service after adding variables

### Issue: Can't Find Environment Variable

**Symptoms**: Logs show "undefined" for env vars.

**Cause**: Variable name mismatch or not set.

**Solution**:
1. Check spelling and case
2. Frontend vars must start with `VITE_`
3. Backend vars set in Render dashboard
4. Restart/redeploy after changes

## Debugging Tips

### Check Frontend Logs
```javascript
// Open browser console (F12)
// Check for errors in Console tab
// Check failed requests in Network tab
```

### Check Backend Logs
1. Go to Render dashboard
2. Select your service
3. Click "Logs" tab
4. Look for errors or warnings

### Test API Endpoints
```bash
# Health check
curl https://your-backend.onrender.com/api/health

# Should return:
# {"status":"ok","message":"Pryde Social API is running"}
```

### Verify Database Connection
```bash
# Check Render logs for:
# "✅ MongoDB Connected Successfully"
```

## Getting Help

If you're still stuck:

1. **Check the logs**:
   - Browser console (F12)
   - Render dashboard logs
   - SiteGround error logs (cPanel)

2. **Verify configuration**:
   - All environment variables set
   - URLs are correct (https://, no trailing slash)
   - CORS includes your domain

3. **Test components separately**:
   - Test backend health endpoint
   - Test frontend loads
   - Test database connection

4. **Review documentation**:
   - [QUICK_START.md](./QUICK_START.md)
   - [DEPLOYMENT_README.md](./DEPLOYMENT_README.md)
   - [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)

## Common Error Messages

| Error | Likely Cause | Solution |
|-------|--------------|----------|
| "Network Error" | Backend not running | Check Render service status |
| "CORS policy" | CORS not configured | Update CORS in backend |
| "404 Not Found" | Missing .htaccess | Upload .htaccess to SiteGround |
| "502 Bad Gateway" | Service starting | Wait 60 seconds (free tier) |
| "MongoDB connection error" | DB config wrong | Check connection string |
| "Invalid token" | JWT secret changed | Regenerate and update |
| "Cannot GET /" | Wrong URL | Check API_BASE_URL includes /api |

---

**Still having issues?** Double-check the [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) to ensure all steps were completed.

