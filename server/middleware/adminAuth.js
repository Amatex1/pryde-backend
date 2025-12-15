import User from '../models/User.js';

// Middleware to check if user is an admin (any admin role)
const adminAuth = async (req, res, next) => {
  try {
    // Standardized: Always use req.userId (set by auth middleware)
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has any admin role
    if (!['moderator', 'admin', 'super_admin'].includes(user.role)) {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    // Attach user to request for use in routes
    req.adminUser = user;
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Middleware to check specific permissions
const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const user = req.adminUser;
      
      if (!user) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      // Super admins have all permissions
      if (user.role === 'super_admin') {
        return next();
      }

      // Check if user has the specific permission
      if (!user.permissions[permission]) {
        return res.status(403).json({ message: `Access denied. ${permission} permission required.` });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  };
};

export { adminAuth, checkPermission };
export default adminAuth;

