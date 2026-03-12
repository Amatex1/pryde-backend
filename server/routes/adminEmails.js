import express from 'express';
import InboundEmail from '../models/InboundEmail.js';
import adminAuth, { checkPermission } from '../middleware/adminAuth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Apply auth to all routes
router.use(adminAuth);

// @route   GET /api/admin/emails
// @desc    Get inbound emails with pagination/filtering (noreply/support)
// @access  Admin (canViewAnalytics)
router.get('/', checkPermission('canViewAnalytics'), async (req, res) => {
  try {
    const {
      mailbox, // 'noreply' | 'support'
      status,  // 'new' | 'read' | etc.
      search,  // sender/subject
      page = 1,
      limit = 20
    } = req.query;

    const filter = {};

    // Mailbox filter (noreply@prydeapp.com or support@prydeapp.com)
    if (mailbox === 'noreply' || mailbox === 'support') {
      filter.mailbox = mailbox;
    }

    // Status filter
    if (status && ['new', 'read', 'replied', 'archived', 'spam'].includes(status)) {
      filter.status = status;
    }

    // Search filter (sender email/name or subject)
    if (search) {
      filter.$or = [
        { 'sender.email': { $regex: search, $options: 'i' } },
        { 'sender.name': { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get emails + count in parallel
    const [emails, total] = await Promise.all([
      InboundEmail.find(filter)
        .populate('readBy.userId', 'username displayName profilePhoto')
        .populate('repliedBy.userId', 'username displayName')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .lean(),
      
      InboundEmail.countDocuments(filter)
    ]);

    // Stats for UI
    const unreadCount = await InboundEmail.countDocuments({ 
      ...filter, 
      status: 'new' 
    });

    res.json({
      emails,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
        unreadCount
      },
      filters: {
        mailbox: mailbox || 'all',
        status: status || 'all'
      }
    });
  } catch (error) {
    logger.error('Get admin emails error:', { error: error.message, requestId: req.requestId });
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/emails/:id
// @desc    Get single inbound email details
// @access  Admin (canViewAnalytics)
router.get('/:id', checkPermission('canViewAnalytics'), async (req, res) => {
  try {
    const email = await InboundEmail.findById(req.params.id)
      .populate('readBy.userId', 'username displayName profilePhoto')
      .populate('repliedBy.userId', 'username displayName');

    if (!email) {
      return res.status(404).json({ message: 'Email not found' });
    }

    // Mark as read if new
    if (email.status === 'new') {
      email.status = 'read';
      email.readBy.push({
        userId: req.user._id,
        readAt: new Date()
      });
      await email.save();
    }

    res.json(email);
  } catch (error) {
    logger.error('Get single email error:', { error: error.message, requestId: req.requestId });
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PATCH /api/admin/emails/:id
// @desc    Update email status (mark replied, add notes, archive)
// @access  Admin (canViewAnalytics)
router.patch('/:id', checkPermission('canViewAnalytics'), async (req, res) => {
  try {
    const { status, adminNotes, replied } = req.body;
    const updates = {};

    if (status && ['read', 'replied', 'archived', 'spam'].includes(status)) {
      updates.status = status;
    }

    if (adminNotes !== undefined) {
      updates.adminNotes = adminNotes;
    }

    if (replied) {
      updates.repliedBy = {
        userId: req.user._id,
        repliedAt: new Date()
      };
      updates.status = 'replied';
    }

    const email = await InboundEmail.findByIdAndUpdate(
      req.params.id,
      { ...updates, updatedAt: new Date() },
      { new: true }
    ).populate('readBy.userId repliedBy.userId', 'username displayName');

    if (!email) {
      return res.status(404).json({ message: 'Email not found' });
    }

    logger.info(`Admin ${req.user.username} updated email ${req.params.id}: ${status}`);
    res.json({ message: 'Email updated', email });
  } catch (error) {
    logger.error('Update email error:', { error: error.message, requestId: req.requestId });
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

