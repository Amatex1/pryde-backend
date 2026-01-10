import express from 'express';
const router = express.Router();
import User from '../models/User.js';
import Badge from '../models/Badge.js';
import Report from '../models/Report.js';
import Block from '../models/Block.js';
import Post from '../models/Post.js';
import Message from '../models/Message.js';
import SecurityLog from '../models/SecurityLog.js';
import ModerationSettings from '../models/ModerationSettings.js';
import AdminActionLog from '../models/AdminActionLog.js'; // PHASE D: Admin action logs
import auth from '../middleware/auth.js';
import adminAuth, { checkPermission } from '../middleware/adminAuth.js';
import crypto from 'crypto';
import { sendPasswordResetEmail, sendPasswordChangedEmail } from '../utils/emailService.js';
import config from '../config/config.js';
import logger from '../utils/logger.js';

/**
 * Helper to resolve badge IDs to full badge objects for admin user listing
 * @param {string[]} badgeIds - Array of badge IDs
 * @returns {Promise<Object[]>} Array of badge objects
 */
async function resolveBadges(badgeIds) {
  if (!badgeIds || !Array.isArray(badgeIds) || badgeIds.length === 0) {
    return [];
  }

  try {
    const badges = await Badge.find({ id: { $in: badgeIds } })
      .select('id label icon tooltip type priority color')
      .lean();

    return badges.sort((a, b) => (a.priority || 100) - (b.priority || 100));
  } catch (error) {
    logger.error('Failed to resolve badges:', error);
    return [];
  }
}

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
    const { search, role, status } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } }
      ];
    }

    if (role) query.role = role;

    if (status === 'active') query.isActive = true;
    if (status === 'inactive') query.isActive = false;
    if (status === 'suspended') query.isSuspended = true;
    if (status === 'banned') query.isBanned = true;

    // Get all users without pagination
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    const total = users.length;

    // BADGE SYSTEM: Resolve badge IDs to full badge objects for each user
    const usersWithBadges = await Promise.all(
      users.map(async (user) => {
        if (user.badges && user.badges.length > 0) {
          user.badges = await resolveBadges(user.badges);
        }
        return user;
      })
    );

    res.json({
      users: usersWithBadges,
      pagination: {
        page: 1,
        limit: total,
        total,
        pages: 1
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

    // PHASE G: God-Mode Protection
    // NEVER allow system accounts to be suspended
    if (user.isSystemAccount === true) {
      return res.status(403).json({
        message: 'Cannot suspend system accounts',
        code: 'SYSTEM_ACCOUNT_PROTECTED'
      });
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

    // Emit real-time event for user suspension (for admin panel)
    if (req.io) {
      req.io.emit('user_suspended', {
        userId: user._id
      });
    }

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

    // Emit real-time event for user unsuspension (for admin panel)
    if (req.io) {
      req.io.emit('user_unsuspended', {
        userId: user._id
      });
    }

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

    // PHASE G: God-Mode Protection
    // NEVER allow system accounts to be banned
    if (user.isSystemAccount === true) {
      return res.status(403).json({
        message: 'Cannot ban system accounts',
        code: 'SYSTEM_ACCOUNT_PROTECTED'
      });
    }

    // NEVER allow super admins to be banned (platform owner protection)
    if (user.role === 'super_admin') {
      return res.status(403).json({ message: 'Cannot ban super admin (platform owner)' });
    }

    // Cannot ban other admins unless you're a super admin
    if (['moderator', 'admin'].includes(user.role) && req.adminUser.role !== 'super_admin') {
      return res.status(403).json({ message: 'Cannot ban admin users' });
    }

    // Log the action
    await AdminActionLog.logAction({
      actorId: req.user.id,
      action: 'BAN_USER',
      targetType: 'USER',
      targetId: user._id,
      details: {
        username: user.username,
        reason: reason || 'Severe violation of Terms of Service'
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    user.isBanned = true;
    user.bannedReason = reason || 'Severe violation of Terms of Service';
    user.isActive = false;

    await user.save();

    // Emit real-time event for user ban (for admin panel)
    if (req.io) {
      req.io.emit('user_banned', {
        userId: user._id
      });
    }

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

    // Emit real-time event for user unban (for admin panel)
    if (req.io) {
      req.io.emit('user_unbanned', {
        userId: user._id
      });
    }

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

    // PHASE G: God-Mode Protection
    // NEVER allow system accounts to have their role changed
    if (user.isSystemAccount === true) {
      return res.status(403).json({
        message: 'Cannot change role of system accounts',
        code: 'SYSTEM_ACCOUNT_PROTECTED'
      });
    }

    // PHASE G: Prevent Platform Suicide
    // If demoting the last SUPER_ADMIN, prevent it
    if (user.role === 'super_admin' && role !== 'super_admin') {
      const superAdminCount = await User.countDocuments({
        role: 'super_admin',
        isDeleted: { $ne: true },
        isBanned: { $ne: true }
      });

      if (superAdminCount <= 1) {
        return res.status(403).json({
          message: 'Cannot demote the last super admin. Promote another user to super admin first.',
          code: 'LAST_SUPER_ADMIN_PROTECTED'
        });
      }
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

// @route   GET /api/admin/posts
// @desc    Get all posts bypassing privacy filters (for admin content viewing)
// @access  Admin (canViewAnalytics)
router.get('/posts', checkPermission('canViewAnalytics'), async (req, res) => {
  try {
    const { postId, page = 1, limit = 20 } = req.query;

    // If specific post ID is requested
    if (postId) {
      const post = await Post.findById(postId)
        .populate('author', 'username displayName profilePhoto isVerified pronouns')
        .populate('comments.user', 'username displayName profilePhoto isVerified pronouns')
        .populate('reactions.user', 'username displayName profilePhoto')
        .populate('comments.reactions.user', 'username displayName profilePhoto');
        // REMOVED 2025-12-28: tags and originalPost populates deleted (Phase 5)

      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }

      return res.json(post);
    }

    // Otherwise return paginated list of all posts (no privacy filters)
    const posts = await Post.find()
      .populate('author', 'username displayName profilePhoto isVerified pronouns')
      .populate('comments.user', 'username displayName profilePhoto isVerified pronouns')
      .populate('reactions.user', 'username displayName profilePhoto')
      .populate('comments.reactions.user', 'username displayName profilePhoto')
      // REMOVED 2025-12-28: tags and originalPost populates deleted (Phase 5)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Post.countDocuments();

    res.json({
      posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get admin posts error:', error);
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

// @route   GET /api/admin/security-logs
// @desc    Get security logs (underage attempts, suspicious activity, etc.)
// @access  Admin (canViewAnalytics)
router.get('/security-logs', checkPermission('canViewAnalytics'), async (req, res) => {
  try {
    const { type, severity, resolved, limit = 50, skip = 0 } = req.query;

    // Build filter
    const filter = {};
    if (type) filter.type = type;
    if (severity) filter.severity = severity;
    if (resolved !== undefined) filter.resolved = resolved === 'true';

    // Fetch logs and stats in parallel for faster response
    const [logs, total, statsAggregation] = await Promise.all([
      // Get logs
      SecurityLog.find(filter)
        .populate('userId', 'username email profilePicture')
        .populate('resolvedBy', 'username')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip)),

      // Get total count
      SecurityLog.countDocuments(filter),

      // Get all stats in a single aggregation query (much faster!)
      SecurityLog.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            unresolved: [
              { $match: { resolved: false } },
              { $count: 'count' }
            ],
            byType: [
              { $group: { _id: '$type', count: { $sum: 1 } } }
            ],
            bySeverity: [
              { $group: { _id: '$severity', count: { $sum: 1 } } }
            ]
          }
        }
      ])
    ]);

    // Format aggregation results
    const stats = {
      total: statsAggregation[0].total[0]?.count || 0,
      unresolved: statsAggregation[0].unresolved[0]?.count || 0,
      byType: {
        underage_registration: 0,
        underage_login: 0,
        underage_access: 0,
        failed_login: 0,
        suspicious_activity: 0
      },
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      }
    };

    // Map aggregation results to stats object
    statsAggregation[0].byType.forEach(item => {
      if (stats.byType.hasOwnProperty(item._id)) {
        stats.byType[item._id] = item.count;
      }
    });

    statsAggregation[0].bySeverity.forEach(item => {
      if (stats.bySeverity.hasOwnProperty(item._id)) {
        stats.bySeverity[item._id] = item.count;
      }
    });

    res.json({
      logs,
      total,
      stats,
      hasMore: total > parseInt(skip) + parseInt(limit)
    });
  } catch (error) {
    console.error('Get security logs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/security-logs/:id/resolve
// @desc    Mark a security log as resolved
// @access  Admin (canManageUsers)
router.put('/security-logs/:id/resolve', checkPermission('canManageUsers'), async (req, res) => {
  try {
    const { notes } = req.body;

    const log = await SecurityLog.findByIdAndUpdate(
      req.params.id,
      {
        resolved: true,
        resolvedBy: req.user._id,
        resolvedAt: new Date(),
        notes: notes || ''
      },
      { new: true }
    ).populate('userId', 'username email')
      .populate('resolvedBy', 'username');

    if (!log) {
      return res.status(404).json({ message: 'Security log not found' });
    }

    res.json(log);
  } catch (error) {
    console.error('Resolve security log error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/verification-requests
// @desc    DEPRECATED - Verification system removed 2025-12-26
// @access  Admin (canManageUsers)
router.get('/verification-requests', checkPermission('canManageUsers'), (req, res) => {
  res.status(410).json({
    message: 'Verification request system has been removed.',
    deprecated: true,
    removedDate: '2025-12-26'
  });
});

// @route   PUT /api/admin/verification-requests/:userId
// @desc    DEPRECATED - Verification system removed 2025-12-26
// @access  Admin (canManageUsers)
router.put('/verification-requests/:userId', checkPermission('canManageUsers'), (req, res) => {
  res.status(410).json({
    message: 'Verification request system has been removed.',
    deprecated: true,
    removedDate: '2025-12-26'
  });
});

// @route   POST /api/admin/users/:id/send-reset-link
// @desc    Admin triggers password reset link for a user
// @access  Admin (canManageUsers)
router.post('/users/:id/send-reset-link', checkPermission('canManageUsers'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent admins from resetting super_admin passwords (unless they are super_admin themselves)
    if (user.role === 'super_admin' && req.adminUser.role !== 'super_admin') {
      return res.status(403).json({ message: 'Cannot reset password for super admin' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHashed = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Save hashed token and expiration to user
    user.resetPasswordToken = resetTokenHashed;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    // Send password reset email
    const emailResult = await sendPasswordResetEmail(user.email, resetToken, user.username);

    if (!emailResult.success) {
      return res.status(500).json({
        message: 'Failed to send password reset email',
        error: emailResult.error
      });
    }

    // Log admin action
    console.log('ADMIN ACTION:', {
      adminId: req.adminUser._id,
      adminUsername: req.adminUser.username,
      action: 'PASSWORD_RESET_TRIGGERED',
      targetUserId: user._id,
      targetUsername: user.username,
      timestamp: new Date()
    });

    res.json({
      message: 'Password reset link sent successfully',
      email: user.email
    });
  } catch (error) {
    console.error('Send reset link error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/users/:id/email
// @desc    Admin updates user email
// @access  Admin (canManageUsers)
router.put('/users/:id/email', checkPermission('canManageUsers'), async (req, res) => {
  try {
    const { newEmail } = req.body;

    if (!newEmail || !newEmail.includes('@')) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent admins from changing super_admin emails (unless they are super_admin themselves)
    if (user.role === 'super_admin' && req.adminUser.role !== 'super_admin') {
      return res.status(403).json({ message: 'Cannot change email for super admin' });
    }

    // Check if new email is already in use
    const existingUser = await User.findOne({ email: newEmail.toLowerCase() });
    if (existingUser && existingUser._id.toString() !== user._id.toString()) {
      return res.status(400).json({ message: 'Email already in use by another account' });
    }

    const oldEmail = user.email;
    user.email = newEmail.toLowerCase();
    await user.save();

    // Send notification to new email
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    if (resend) {
      try {
        await resend.emails.send({
          from: 'Pryde Social <noreply@prydeapp.com>',
          to: newEmail,
          subject: '✅ Your Pryde Social Email Was Updated',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; background-color: #F7F7F7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #F7F7F7;">
                <tr>
                  <td style="padding: 40px 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #6C5CE7 0%, #0984E3 100%); border-radius: 16px; overflow: hidden;">
                      <tr>
                        <td style="padding: 40px; text-align: center;">
                          <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700;">Email Updated</h1>
                        </td>
                      </tr>
                      <tr>
                        <td style="background: white; padding: 40px;">
                          <p style="margin: 0 0 20px 0; color: #2B2B2B; font-size: 16px; line-height: 1.6;">
                            Hello <strong>${user.displayName || user.username}</strong>,
                          </p>
                          <p style="margin: 0 0 20px 0; color: #2B2B2B; font-size: 16px; line-height: 1.6;">
                            Your Pryde Social login email has been updated by an administrator.
                          </p>
                          <div style="background: #F7F7F7; border-left: 4px solid #6C5CE7; padding: 20px; margin: 20px 0; border-radius: 4px;">
                            <p style="margin: 0 0 10px 0; color: #616161; font-size: 14px;"><strong>Previous Email:</strong></p>
                            <p style="margin: 0 0 20px 0; color: #2B2B2B; font-size: 16px;">${oldEmail}</p>
                            <p style="margin: 0 0 10px 0; color: #616161; font-size: 14px;"><strong>New Email:</strong></p>
                            <p style="margin: 0; color: #2B2B2B; font-size: 16px;">${newEmail}</p>
                          </div>
                          <p style="margin: 0 0 20px 0; color: #2B2B2B; font-size: 16px; line-height: 1.6;">
                            If this wasn't you or you didn't request this change, please contact Pryde Social support immediately.
                          </p>
                          <div style="text-align: center; margin: 30px 0;">
                            <a href="${config.frontendURL}/settings" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #6C5CE7, #0984E3); color: white; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px;">View Account Settings</a>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td style="background: #F7F7F7; padding: 30px; text-align: center;">
                          <p style="margin: 0; color: #616161; font-size: 14px;">
                            © ${new Date().getFullYear()} Pryde Social. All rights reserved.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `
        });

        // Send notification to old email
        await resend.emails.send({
          from: 'Pryde Social <noreply@prydeapp.com>',
          to: oldEmail,
          subject: '⚠️ Your Pryde Social Email Was Changed',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; background-color: #F7F7F7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #F7F7F7;">
                <tr>
                  <td style="padding: 40px 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #DC3545 0%, #C82333 100%); border-radius: 16px; overflow: hidden;">
                      <tr>
                        <td style="padding: 40px; text-align: center;">
                          <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700;">⚠️ Email Changed</h1>
                        </td>
                      </tr>
                      <tr>
                        <td style="background: white; padding: 40px;">
                          <p style="margin: 0 0 20px 0; color: #2B2B2B; font-size: 16px; line-height: 1.6;">
                            Hello <strong>${user.displayName || user.username}</strong>,
                          </p>
                          <p style="margin: 0 0 20px 0; color: #2B2B2B; font-size: 16px; line-height: 1.6;">
                            Your Pryde Social account email was changed by an administrator.
                          </p>
                          <div style="background: #FFF3CD; border-left: 4px solid #DC3545; padding: 20px; margin: 20px 0; border-radius: 4px;">
                            <p style="margin: 0 0 10px 0; color: #856404; font-size: 14px;"><strong>Your new login email is:</strong></p>
                            <p style="margin: 0; color: #2B2B2B; font-size: 16px; font-weight: 700;">${newEmail}</p>
                          </div>
                          <p style="margin: 0 0 20px 0; color: #DC3545; font-size: 16px; line-height: 1.6; font-weight: 600;">
                            ⚠️ If you didn't request this change, your account may be compromised. Contact support immediately!
                          </p>
                          <div style="text-align: center; margin: 30px 0;">
                            <a href="${config.frontendURL}/contact" style="display: inline-block; padding: 14px 32px; background: #DC3545; color: white; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px;">Contact Support</a>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td style="background: #F7F7F7; padding: 30px; text-align: center;">
                          <p style="margin: 0; color: #616161; font-size: 14px;">
                            © ${new Date().getFullYear()} Pryde Social. All rights reserved.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `
        });
      } catch (emailError) {
        console.error('Error sending email notifications:', emailError);
        // Don't fail the request if emails fail
      }
    }

    // Log admin action
    console.log('ADMIN ACTION:', {
      adminId: req.adminUser._id,
      adminUsername: req.adminUser.username,
      action: 'EMAIL_UPDATED',
      targetUserId: user._id,
      targetUsername: user.username,
      oldEmail,
      newEmail,
      timestamp: new Date()
    });

    res.json({
      message: 'Email updated successfully',
      oldEmail,
      newEmail
    });
  } catch (error) {
    console.error('Update email error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================
// GROUP MANAGEMENT
// ============================================

import Group from '../models/Group.js';

// @route   GET /api/admin/groups/pending
// @desc    Get all pending group requests
// @access  Admin
router.get('/groups/pending', async (req, res) => {
  try {
    const pendingGroups = await Group.find({ status: 'pending' })
      .populate('owner', 'username displayName profilePhoto email')
      .sort({ createdAt: -1 });

    res.json({ groups: pendingGroups });
  } catch (error) {
    console.error('Get pending groups error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PATCH /api/admin/groups/:id/approve
// @desc    Approve a pending group
// @access  Admin
router.patch('/groups/:id/approve', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (group.status !== 'pending') {
      return res.status(400).json({ message: 'Group is not pending approval' });
    }

    group.status = 'approved';
    await group.save();

    res.json({
      success: true,
      message: 'Group approved',
      group: {
        _id: group._id,
        name: group.name,
        slug: group.slug,
        status: group.status
      }
    });
  } catch (error) {
    console.error('Approve group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PATCH /api/admin/groups/:id/reject
// @desc    Reject a pending group
// @access  Admin
router.patch('/groups/:id/reject', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (group.status !== 'pending') {
      return res.status(400).json({ message: 'Group is not pending approval' });
    }

    group.status = 'rejected';
    await group.save();

    res.json({
      success: true,
      message: 'Group rejected',
      group: {
        _id: group._id,
        name: group.name,
        slug: group.slug,
        status: group.status
      }
    });
  } catch (error) {
    console.error('Reject group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// MODERATION SETTINGS ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// @route   GET /api/admin/moderation/settings
// @desc    Get current moderation settings
// @access  Admin (canManageUsers)
router.get('/moderation/settings', checkPermission('canManageUsers'), async (req, res) => {
  try {
    const settings = await ModerationSettings.getSettings();
    res.json(settings);
  } catch (error) {
    logger.error('Get moderation settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/moderation/settings
// @desc    Update moderation settings
// @access  Admin (canManageUsers)
router.put('/moderation/settings', checkPermission('canManageUsers'), async (req, res) => {
  try {
    const { autoMute, toxicity } = req.body;

    const updates = {};
    if (autoMute) updates.autoMute = autoMute;
    if (toxicity) updates.toxicity = toxicity;

    const settings = await ModerationSettings.updateSettings(updates, req.userId);

    logger.info(`Moderation settings updated by admin ${req.userId}`);
    res.json({ message: 'Settings updated', settings });
  } catch (error) {
    logger.error('Update moderation settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/moderation/blocked-words
// @desc    Get all blocked words by category
// @access  Admin (canManageUsers)
router.get('/moderation/blocked-words', checkPermission('canManageUsers'), async (req, res) => {
  try {
    const settings = await ModerationSettings.getSettings();
    res.json({
      blockedWords: settings.blockedWords,
      totalCount: settings.getAllBlockedWords().length
    });
  } catch (error) {
    logger.error('Get blocked words error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/moderation/blocked-words
// @desc    Add a blocked word to a category
// @access  Admin (canManageUsers)
router.post('/moderation/blocked-words', checkPermission('canManageUsers'), async (req, res) => {
  try {
    const { word, category } = req.body;

    if (!word || !category) {
      return res.status(400).json({ message: 'Word and category are required' });
    }

    const validCategories = ['profanity', 'slurs', 'sexual', 'spam', 'custom'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ message: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
    }

    const settings = await ModerationSettings.getSettings();
    const normalizedWord = word.toLowerCase().trim();

    // Check if word already exists in any category
    const allWords = settings.getAllBlockedWords();
    if (allWords.includes(normalizedWord)) {
      return res.status(400).json({ message: 'Word already exists in blocked list' });
    }

    // Add word to the specified category
    settings.blockedWords[category].push(normalizedWord);
    settings.updatedBy = req.userId;
    await settings.save();

    logger.info(`Blocked word "${normalizedWord}" added to ${category} by admin ${req.userId}`);
    res.json({
      message: 'Word added',
      word: normalizedWord,
      category,
      blockedWords: settings.blockedWords
    });
  } catch (error) {
    logger.error('Add blocked word error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/admin/moderation/blocked-words
// @desc    Remove a blocked word from a category
// @access  Admin (canManageUsers)
router.delete('/moderation/blocked-words', checkPermission('canManageUsers'), async (req, res) => {
  try {
    const { word, category } = req.body;

    if (!word || !category) {
      return res.status(400).json({ message: 'Word and category are required' });
    }

    const validCategories = ['profanity', 'slurs', 'sexual', 'spam', 'custom'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ message: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
    }

    const settings = await ModerationSettings.getSettings();
    const normalizedWord = word.toLowerCase().trim();

    const index = settings.blockedWords[category].indexOf(normalizedWord);
    if (index === -1) {
      return res.status(404).json({ message: 'Word not found in specified category' });
    }

    settings.blockedWords[category].splice(index, 1);
    settings.updatedBy = req.userId;
    await settings.save();

    logger.info(`Blocked word "${normalizedWord}" removed from ${category} by admin ${req.userId}`);
    res.json({
      message: 'Word removed',
      word: normalizedWord,
      category,
      blockedWords: settings.blockedWords
    });
  } catch (error) {
    logger.error('Remove blocked word error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/moderation/history
// @desc    Get moderation history across all users
// @access  Admin (canViewReports)
router.get('/moderation/history', checkPermission('canViewReports'), async (req, res) => {
  try {
    const { limit = 50, offset = 0, action, automated } = req.query;

    // Build aggregation pipeline to get moderation history from all users
    const pipeline = [
      { $match: { 'moderationHistory.0': { $exists: true } } },
      { $unwind: '$moderationHistory' },
      { $sort: { 'moderationHistory.timestamp': -1 } }
    ];

    // Filter by action type if specified
    if (action) {
      pipeline.push({ $match: { 'moderationHistory.action': action } });
    }

    // Filter by automated if specified
    if (automated !== undefined) {
      pipeline.push({ $match: { 'moderationHistory.automated': automated === 'true' } });
    }

    // Project the fields we need (including new detail fields)
    pipeline.push({
      $project: {
        _id: 0,
        oderId: '$_id',
        username: 1,
        displayName: 1,
        profilePicture: 1,
        action: '$moderationHistory.action',
        reason: '$moderationHistory.reason',
        contentType: '$moderationHistory.contentType',
        contentId: '$moderationHistory.contentId',
        contentPreview: '$moderationHistory.contentPreview',
        detectedViolations: '$moderationHistory.detectedViolations',
        moderatorId: '$moderationHistory.moderatorId',
        timestamp: '$moderationHistory.timestamp',
        automated: '$moderationHistory.automated'
      }
    });

    // Get total count
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await User.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    // Apply pagination
    pipeline.push({ $skip: parseInt(offset) });
    pipeline.push({ $limit: parseInt(limit) });

    const history = await User.aggregate(pipeline);

    res.json({
      history,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + history.length < total
      }
    });
  } catch (error) {
    logger.error('Get moderation history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/moderation/user/:userId
// @desc    Get moderation details for a specific user
// @access  Admin (canManageUsers)
router.get('/moderation/user/:userId', checkPermission('canManageUsers'), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('username displayName moderation moderationHistory');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      userId: user._id,
      username: user.username,
      displayName: user.displayName,
      moderation: user.moderation || {},
      history: user.moderationHistory || []
    });
  } catch (error) {
    logger.error('Get user moderation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/moderation/user/:userId/unmute
// @desc    Manually unmute a user
// @access  Admin (canManageUsers)
router.post('/moderation/user/:userId/unmute', checkPermission('canManageUsers'), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.moderation?.isMuted) {
      return res.status(400).json({ message: 'User is not muted' });
    }

    user.moderation.isMuted = false;
    user.moderation.muteExpires = null;
    user.moderation.muteReason = '';
    user.moderationHistory.push({
      action: 'unmute',
      reason: `Manually unmuted by admin`,
      contentType: 'other',
      moderatorId: req.userId,
      automated: false,
      timestamp: new Date()
    });

    await user.save();

    logger.info(`User ${user.username} unmuted by admin ${req.userId}`);
    res.json({ message: 'User unmuted', user: { username: user.username, moderation: user.moderation } });
  } catch (error) {
    logger.error('Unmute user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/moderation/user/:userId/mute
// @desc    Manually mute a user
// @access  Admin (canManageUsers)
router.post('/moderation/user/:userId/mute', checkPermission('canManageUsers'), async (req, res) => {
  try {
    const { duration, reason } = req.body; // duration in minutes

    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Initialize moderation if it doesn't exist
    if (!user.moderation) {
      user.moderation = {};
    }

    user.moderation.isMuted = true;
    user.moderation.muteExpires = duration ? new Date(Date.now() + duration * 60 * 1000) : null;
    user.moderation.muteReason = reason || 'Muted by admin';
    user.moderationHistory = user.moderationHistory || [];
    user.moderationHistory.push({
      action: 'mute',
      reason: reason || 'Muted by admin',
      contentType: 'other',
      moderatorId: req.userId,
      automated: false,
      timestamp: new Date()
    });

    await user.save();

    logger.info(`User ${user.username} muted for ${duration || 'indefinite'} minutes by admin ${req.userId}`);
    res.json({
      message: 'User muted',
      user: {
        username: user.username,
        moderation: user.moderation
      }
    });
  } catch (error) {
    logger.error('Mute user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/moderation/user/:userId/reset-violations
// @desc    Reset a user's violation count
// @access  Admin (canManageUsers)
router.post('/moderation/user/:userId/reset-violations', checkPermission('canManageUsers'), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.moderation) {
      user.moderation = {};
    }

    const previousCount = user.moderation.violationCount || 0;
    user.moderation.violationCount = 0;
    user.moderation.lastViolation = null;
    user.moderationHistory = user.moderationHistory || [];
    user.moderationHistory.push({
      action: 'warning',
      reason: `Violation count reset from ${previousCount} to 0 by admin`,
      automated: false,
      timestamp: new Date()
    });

    await user.save();

    logger.info(`User ${user.username} violation count reset by admin ${req.userId}`);
    res.json({
      message: 'Violations reset',
      user: {
        username: user.username,
        moderation: user.moderation
      }
    });
  } catch (error) {
    logger.error('Reset violations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================================================
// PHASE D: Admin Action Logs
// ============================================================================

// @route   GET /api/admin/action-logs
// @desc    Get admin action logs (audit trail)
// @access  Admin (canViewAnalytics)
router.get('/action-logs', checkPermission('canViewAnalytics'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      action = null,
      actorId = null,
      targetId = null,
      asUserId = null
    } = req.query;

    const query = {};

    if (action) {
      query.action = action;
    }

    if (actorId) {
      query.actorId = actorId;
    }

    if (targetId) {
      query.targetId = targetId;
    }

    if (asUserId) {
      query.asUserId = asUserId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const logs = await AdminActionLog.find(query)
      .populate('actorId', 'username displayName profilePhoto')
      .populate('asUserId', 'username displayName isSystemAccount systemRole')
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await AdminActionLog.countDocuments(query);

    res.json({
      success: true,
      logs: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Get admin action logs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/action-logs/stats
// @desc    Get admin action log statistics
// @access  Admin (canViewAnalytics)
router.get('/action-logs/stats', checkPermission('canViewAnalytics'), async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const totalActions = await AdminActionLog.countDocuments({
      timestamp: { $gte: startDate }
    });

    const actionsByType = await AdminActionLog.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const actionsByActor = await AdminActionLog.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      { $group: { _id: '$actorId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Populate actor details
    const actorIds = actionsByActor.map(a => a._id);
    const actors = await User.find({ _id: { $in: actorIds } })
      .select('username displayName profilePhoto');

    const actorMap = {};
    actors.forEach(actor => {
      actorMap[actor._id.toString()] = actor;
    });

    const actionsByActorWithDetails = actionsByActor.map(a => ({
      actor: actorMap[a._id.toString()],
      count: a.count
    }));

    res.json({
      success: true,
      stats: {
        totalActions: totalActions,
        actionsByType: actionsByType,
        actionsByActor: actionsByActorWithDetails,
        period: `Last ${days} days`
      }
    });
  } catch (error) {
    logger.error('Get admin action log stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================================================
// PHASE G: System Account Management (with God-Mode Protection)
// ============================================================================

// @route   PUT /api/admin/system-accounts/:id/activate
// @desc    Activate a system account
// @access  Admin (canManageUsers)
router.put('/system-accounts/:id/activate', checkPermission('canManageUsers'), async (req, res) => {
  try {
    const systemAccount = await User.findById(req.params.id);

    if (!systemAccount) {
      return res.status(404).json({ message: 'System account not found' });
    }

    if (!systemAccount.isSystemAccount) {
      return res.status(400).json({ message: 'This is not a system account' });
    }

    systemAccount.isActive = true;
    await systemAccount.save();

    // Log the action
    await AdminActionLog.logAction({
      actorId: req.user.id,
      action: 'ACTIVATE_SYSTEM_ACCOUNT',
      targetType: 'SYSTEM_ACCOUNT',
      targetId: systemAccount._id,
      details: {
        username: systemAccount.username,
        systemRole: systemAccount.systemRole
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    logger.info(`Admin ${req.user.username} activated system account ${systemAccount.username}`);

    res.json({
      success: true,
      message: `System account ${systemAccount.username} activated`,
      systemAccount: {
        _id: systemAccount._id,
        username: systemAccount.username,
        displayName: systemAccount.displayName,
        systemRole: systemAccount.systemRole,
        isActive: systemAccount.isActive
      }
    });
  } catch (error) {
    logger.error('Activate system account error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/system-accounts/:id/deactivate
// @desc    Deactivate a system account
// @access  Admin (canManageUsers)
router.put('/system-accounts/:id/deactivate', checkPermission('canManageUsers'), async (req, res) => {
  try {
    const systemAccount = await User.findById(req.params.id);

    if (!systemAccount) {
      return res.status(404).json({ message: 'System account not found' });
    }

    if (!systemAccount.isSystemAccount) {
      return res.status(400).json({ message: 'This is not a system account' });
    }

    systemAccount.isActive = false;
    await systemAccount.save();

    // Log the action
    await AdminActionLog.logAction({
      actorId: req.user.id,
      action: 'DEACTIVATE_SYSTEM_ACCOUNT',
      targetType: 'SYSTEM_ACCOUNT',
      targetId: systemAccount._id,
      details: {
        username: systemAccount.username,
        systemRole: systemAccount.systemRole
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    logger.info(`Admin ${req.user.username} deactivated system account ${systemAccount.username}`);

    res.json({
      success: true,
      message: `System account ${systemAccount.username} deactivated`,
      systemAccount: {
        _id: systemAccount._id,
        username: systemAccount.username,
        displayName: systemAccount.displayName,
        systemRole: systemAccount.systemRole,
        isActive: systemAccount.isActive
      }
    });
  } catch (error) {
    logger.error('Deactivate system account error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/system-accounts
// @desc    Get all system accounts
// @access  Admin (canViewAnalytics)
router.get('/system-accounts', checkPermission('canViewAnalytics'), async (req, res) => {
  try {
    const systemAccounts = await User.find({ isSystemAccount: true })
      .select('username displayName systemRole isActive systemDescription systemCreatedBy createdAt');

    res.json({
      success: true,
      systemAccounts: systemAccounts
    });
  } catch (error) {
    logger.error('Get system accounts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

