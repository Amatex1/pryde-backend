/**
 * adminPlatformBrain.js
 *
 * Endpoint:  GET /api/admin/platform-brain
 * Mounted via routeRegistry.js (after requireAdmin2FA).
 *
 * Access:
 *   - admin / super_admin  → pass through checkPermission automatically
 *   - moderator            → requires canViewReports permission
 */

import express from 'express';
import { checkPermission } from '../middleware/adminAuth.js';
import { getPlatformBrainStats } from '../services/platformBrainService.js';
import logger from '../utils/logger.js';

const router = express.Router();

// GET /api/admin/platform-brain
router.get('/', checkPermission('canViewReports'), async (req, res) => {
  try {
    const stats = await getPlatformBrainStats();
    res.json(stats);
  } catch (err) {
    logger.error('[AdminPlatformBrain] Failed to fetch stats:', err);
    res.status(500).json({ message: 'Failed to load Platform Brain stats' });
  }
});

export default router;
