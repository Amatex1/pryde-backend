import express from 'express';
const router = express.Router();
import User from '../models/User.js';
import Report from '../models/Report.js';
import Block from '../models/Block.js';
import Post from '../models/Post.js';
import Message from '../models/Message.js';
import SecurityLog from '../models/SecurityLog.js';
import auth from '../middleware/auth.js';
import adminAuth, { checkPermission } from '../middleware/adminAuth.js';

// All admin routes require authentication + admin role
router.use(auth);
router.use(adminAuth);

// @route   GET /api/admin/stats
// @desc    Get platform statistics
// @access  Admin (canViewAnalytics)
router.get('/stats', checkPermission('canViewAnalytics'), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const suspendedUsers = await User.countDocuments({ isSuspended: true });
    const bannedUsers = await User.countDocuments({ isBanned: true });
    const totalPosts = await Post.countDocuments();
    const totalMessages = await Message.countDocuments();
    const pendingReports = await Report.countDocuments({ status: 'pending' });
    const totalReports = await Report.countDocuments();
    const totalBlocks = await Block.countDocuments();

    // Get new users in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const newUsers = await User.countDocuments({ createdAt: { $gte: sevenDaysAgo } });

    // Get active users in last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const activeToday = await User.countDocuments({ lastLogin: { $gte: oneDayAgo } });

    res.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        suspended: suspendedUsers,
        banned: bannedUsers,
        newThisWeek: newUsers,
        activeToday
      },
      content: {
        totalPosts,
        totalMessages
      },
      moderation: {
        pendingReports,
        totalReports,
        totalBlocks
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/reports
// @desc    Get all reports with filters
// @access  Admin (canViewReports)
router.get('/reports', checkPermission('canViewReports'), async (req, res) => {
  try {
    const { status, reportType, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (reportType) query.reportType = reportType;

    const reports = await Report.find(query)
      .populate('reporter', 'username displayName email profilePhoto')
      .populate('reportedUser', 'username displayName email profilePhoto')
      .populate('reportedPost')
      .populate('reportedComment')
      .populate('reviewedBy', 'username displayName')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // Populate nested content for posts and comments
    for (let report of reports) {
      if (report.reportedPost) {
        await report.populate('reportedPost.author', 'username displayName profilePhoto');
      }
      if (report.reportedComment) {
        await report.populate('reportedComment.user', 'username displayName profilePhoto');
      }
    }

    const total = await Report.countDocuments(query);

    res.json({
      reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/reports/:id
// @desc    Update report status
// @access  Admin (canResolveReports)
router.put('/reports/:id', checkPermission('canResolveReports'), async (req, res) => {
  try {
    const { status, reviewNotes, action } = req.body;
    const adminUserId = req.adminUser._id;

    const report = await Report.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    report.status = status || report.status;
    report.reviewNotes = reviewNotes || report.reviewNotes;
    report.action = action || report.action;
    report.reviewedBy = adminUserId;
    report.reviewedAt = new Date();

    await report.save();

    res.json({ message: 'Report updated successfully', report });
  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with filters
// @access  Admin (canManageUsers)
router.get('/users', checkPermission('canManageUsers'), async (req, res) => {
  try {
    const { search, role, status, page = 1, limit = 20 } = req.query;
    
    const query = {};
    
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role) query.role = role;
    
    if (status === 'active') query.isActive = true;
    if (status === 'inactive') query.isActive = false;
    if (status === 'suspended') query.isSuspended = true;
    if (status === 'banned') query.isBanned = true;

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/users/:id/suspend
// @desc    Suspend a user
// @access  Admin (canManageUsers)
router.put('/users/:id/suspend', checkPermission('canManageUsers'), async (req, res) => {
  try {
    const { days, reason } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // NEVER allow super admins to be suspended (platform owner protection)
    if (user.role === 'super_admin') {
      return res.status(403).json({ message: 'Cannot suspend super admin (platform owner)' });
    }

    // Cannot suspend other admins unless you're a super admin
    if (['moderator', 'admin'].includes(user.role) && req.adminUser.role !== 'super_admin') {
      return res.status(403).json({ message: 'Cannot suspend admin users' });
    }

    const suspendedUntil = new Date();
    suspendedUntil.setDate(suspendedUntil.getDate() + (days || 7));

    user.isSuspended = true;
    user.suspendedUntil = suspendedUntil;
    user.suspensionReason = reason || 'Violation of Terms of Service';

    await user.save();

    res.json({ message: 'User suspended successfully', user: user.toJSON() });
  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/users/:id/unsuspend
// @desc    Unsuspend a user
// @access  Admin (canManageUsers)
router.put('/users/:id/unsuspend', checkPermission('canManageUsers'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isSuspended = false;
    user.suspendedUntil = null;
    user.suspensionReason = '';

    await user.save();

    res.json({ message: 'User unsuspended successfully', user: user.toJSON() });
  } catch (error) {
    console.error('Unsuspend user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/users/:id/ban
// @desc    Ban a user permanently
// @access  Admin (canManageUsers)
router.put('/users/:id/ban', checkPermission('canManageUsers'), async (req, res) => {
  try {
    const { reason } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // NEVER allow super admins to be banned (platform owner protection)
    if (user.role === 'super_admin') {
      return res.status(403).json({ message: 'Cannot ban super admin (platform owner)' });
    }

    // Cannot ban other admins unless you're a super admin
    if (['moderator', 'admin'].includes(user.role) && req.adminUser.role !== 'super_admin') {
      return res.status(403).json({ message: 'Cannot ban admin users' });
    }

    user.isBanned = true;
    user.bannedReason = reason || 'Severe violation of Terms of Service';
    user.isActive = false;

    await user.save();

    res.json({ message: 'User banned successfully', user: user.toJSON() });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/users/:id/unban
// @desc    Unban a user
// @access  Admin (canManageUsers)
router.put('/users/:id/unban', checkPermission('canManageUsers'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isBanned = false;
    user.bannedReason = '';
    user.isActive = true;

    await user.save();

    res.json({ message: 'User unbanned successfully', user: user.toJSON() });
  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/users/:id/role
// @desc    Update user role and permissions
// @access  Super Admin only (canManageAdmins)
router.put('/users/:id/role', checkPermission('canManageAdmins'), async (req, res) => {
  try {
    const { role, permissions } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (role) {
      user.role = role;

      // Set default permissions based on role
      if (role === 'moderator') {
        user.permissions = {
          canViewReports: true,
          canResolveReports: true,
          canManageUsers: false,
          canViewAnalytics: true,
          canManageAdmins: false
        };
      } else if (role === 'admin') {
        user.permissions = {
          canViewReports: true,
          canResolveReports: true,
          canManageUsers: true,
          canViewAnalytics: true,
          canManageAdmins: false
        };
      } else if (role === 'super_admin') {
        user.permissions = {
          canViewReports: true,
          canResolveReports: true,
          canManageUsers: true,
          canViewAnalytics: true,
          canManageAdmins: true
        };
      } else {
        user.permissions = {
          canViewReports: false,
          canResolveReports: false,
          canManageUsers: false,
          canViewAnalytics: false,
          canManageAdmins: false
        };
      }
    }

    // Allow custom permissions override
    if (permissions) {
      user.permissions = { ...user.permissions, ...permissions };
    }

    await user.save();

    res.json({ message: 'User role updated successfully', user: user.toJSON() });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/blocks
// @desc    Get all blocks
// @access  Admin (canViewAnalytics)
router.get('/blocks', checkPermission('canViewAnalytics'), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const blocks = await Block.find()
      .populate('blocker', 'username displayName email')
      .populate('blocked', 'username displayName email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Block.countDocuments();

    res.json({
      blocks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get blocks error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/activity
// @desc    Get recent user activity
// @access  Admin (canViewAnalytics)
router.get('/activity', checkPermission('canViewAnalytics'), async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const recentPosts = await Post.find({ createdAt: { $gte: startDate } })
      .populate('author', 'username displayName')
      .sort({ createdAt: -1 })
      .limit(50);

    const recentUsers = await User.find({ createdAt: { $gte: startDate } })
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(50);

    const recentReports = await Report.find({ createdAt: { $gte: startDate } })
      .populate('reporter', 'username displayName')
      .populate('reportedUser', 'username displayName')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      recentPosts,
      recentUsers,
      recentReports,
      period: `Last ${days} days`
    });
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

