# Frontend Deployment Guide - SiteGround

This guide will help you deploy the Pryde Social frontend to SiteGround hosting.

## Prerequisites

- SiteGround hosting account with cPanel access
- Domain name configured (e.g., prydeapp.com)
- Backend already deployed on Render.com

## Step 1: Build the Frontend

1. Open terminal in the project root directory
2. Update `.env.production` with your backend URL:
   ```
   VITE_API_URL=https://your-backend-app.onrender.com/api
   VITE_SOCKET_URL=https://your-backend-app.onrender.com
   ```
3. Run the build command:
   ```bash
   npm run build
   ```
4. This creates a `dist` folder with all production files

## Step 2: Prepare Files for Upload

The `dist` folder contains:
- `index.html` - Main HTML file
- `assets/` - JavaScript and CSS files
- `.htaccess` - Apache configuration for SPA routing (already created)

## Step 3: Upload to SiteGround

### Option A: Using File Manager (Recommended for beginners)

1. Log in to SiteGround cPanel
2. Navigate to **File Manager**
3. Go to `public_html` directory (or your domain's root directory)
4. **Delete** all existing files in the directory (backup first if needed)
5. Upload all files from the `dist` folder:
   - Upload `index.html`
   - Upload `.htaccess`
   - Upload the entire `assets` folder
6. Ensure file permissions are correct (644 for files, 755 for folders)

### Option B: Using FTP

1. Use an FTP client (FileZilla, WinSCP, etc.)
2. Connect to your SiteGround server:
   - Host: Your domain or server IP
   - Username: Your cPanel username
   - Password: Your cPanel password
   - Port: 21 (FTP) or 22 (SFTP)
3. Navigate to `public_html`
4. Upload all files from the `dist` folder

## Step 4: Verify Deployment

1. Visit your domain (e.g., https://prydeapp.com)
2. The app should load correctly
3. Test the following:
   - Login/Register pages load
   - Navigation works (refresh on any page should work)
   - API calls connect to backend
   - Real-time features work (if backend is running)

## Step 5: Configure SSL (HTTPS)

1. In SiteGround cPanel, go to **Security** → **SSL Manager**
2. Install a free Let's Encrypt SSL certificate
3. Enable **Force HTTPS Redirect**
4. Update backend CORS to include your domain

## Troubleshooting

### Issue: 404 errors on page refresh
- **Solution**: Ensure `.htaccess` file is uploaded and mod_rewrite is enabled

### Issue: API calls failing
- **Solution**: Check CORS settings in backend and verify API URLs in `.env.production`

### Issue: Blank page
- **Solution**: Check browser console for errors. Ensure all files uploaded correctly

### Issue: Assets not loading
- **Solution**: Check file paths and ensure `assets` folder uploaded completely

## Updating the Frontend

To deploy updates:
1. Make your changes
2. Run `npm run build`
3. Upload only changed files from `dist` folder
4. Clear browser cache to see changes

## Important Notes

- Always test locally before deploying
- Keep a backup of your current deployment
- The `.htaccess` file is crucial for React Router to work
- Environment variables are baked into the build, so rebuild after changing them

## Support

If you encounter issues:
1. Check SiteGround error logs in cPanel
2. Check browser console for JavaScript errors
3. Verify backend is running and accessible
4. Contact SiteGround support for server-specific issues

