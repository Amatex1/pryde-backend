/**
 * Version endpoint for update detection
 * Returns current build version and timestamp
 */

import express from 'express';

const router = express.Router();

// @route   GET /api/version
// @desc    Get current build version and timestamp
// @access  Public
router.get('/', (req, res) => {
  res.json({
    version: process.env.BUILD_VERSION || 'dev',
    timestamp: process.env.BUILD_TIME || Date.now(),
    environment: process.env.NODE_ENV || 'development'
  });
});

export default router;

