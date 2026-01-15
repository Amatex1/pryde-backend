import express from 'express';
const router = express.Router();
import Report from '../models/Report.js';
import auth from '../middleware/auth.js';
import { reportLimiter } from '../middleware/rateLimiter.js';
import { sanitizeFields } from '../utils/sanitize.js';
import { validateParamId } from '../middleware/validation.js';

// @route   POST /api/reports
// @desc    Create a new report
// @access  Private
// 🔥 FIX: Added sanitizeFields to prevent XSS via description field
router.post('/', auth, reportLimiter, sanitizeFields(['description', 'reason']), async (req, res) => {
  try {
    const { reportType, reportedContent, reportedUser, reason, description } = req.body;
    const userId = req.userId || req.user._id;

    // Validate required fields
    if (!reportType || !reason) {
      return res.status(400).json({ message: 'Report type and reason are required' });
    }

    // Determine the model based on report type
    let onModel;
    switch (reportType) {
      case 'post':
        onModel = 'Post';
        break;
      case 'comment':
        onModel = 'Comment';
        break;
      case 'message':
        onModel = 'Message';
        break;
      case 'user':
        onModel = 'User';
        break;
      default:
        return res.status(400).json({ message: 'Invalid report type' });
    }

    const report = new Report({
      reporter: userId,
      reportedUser: reportedUser || null,
      reportType,
      reportedContent: reportedContent || null,
      onModel,
      reason,
      description: description || '',
      status: 'pending'
    });

    await report.save();

    res.status(201).json({ 
      message: 'Report submitted successfully. We will review it shortly.',
      report 
    });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/my-reports
// @desc    Get current user's reports
// @access  Private
router.get('/my-reports', auth, async (req, res) => {
  try {
    const userId = req.userId || req.user._id;

    const reports = await Report.find({ reporter: userId })
      .populate('reportedUser', 'username displayName profilePhoto')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(reports);
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/:id
// @desc    Get single report
// @access  Private
router.get('/:id', auth, validateParamId('id'), async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    const report = await Report.findById(req.params.id)
      .populate('reporter', 'username displayName')
      .populate('reportedUser', 'username displayName profilePhoto');

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Only reporter can view their own report
    if (report.reporter._id.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(report);
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/reports/:id
// @desc    Delete/cancel a report
// @access  Private
router.delete('/:id', auth, validateParamId('id'), async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Only reporter can delete their own report if it's still pending
    if (report.reporter.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (report.status !== 'pending') {
      return res.status(400).json({ message: 'Cannot delete a report that is being reviewed or resolved' });
    }

    await report.deleteOne();

    res.json({ message: 'Report cancelled successfully' });
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

