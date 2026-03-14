import express from 'express';
const router = express.Router();
import auth from '../middleware/auth.js';
import SecurityLog from '../models/SecurityLog.js';
import logger from '../utils/logger.js';

/**
 * GET /api/user/security-logs
 * Get user's own security activity logs (Phase 2 - user-facing)
 * @access Private (user only)
 */
router.get('/security-logs', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      SecurityLog.find({ 
        userId: req.user.id, 
        resolved: false // Show only unresolved by default
      })
      .populate('resolvedBy', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
      SecurityLog.countDocuments({ userId: req.user.id })
    ]);

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('User security logs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

