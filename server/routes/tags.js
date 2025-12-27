/**
 * Phase 2B: Tags → Groups Migration (DEPRECATED)
 *
 * All tag routes now return 410 Gone.
 * Tags have been migrated to Groups.
 *
 * Frontend redirects:
 * - /tags → /groups
 * - /tags/:slug → /groups/:slug
 * - /hashtag/:tag → /groups/:tag
 *
 * This file is kept for backwards compatibility with any external links
 * or cached API calls. It will be removed in a future cleanup phase.
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * Phase 2B: Deprecated - Tags have been migrated to Groups
 * Export empty function for backwards compatibility with server.js
 */
export const initializeTags = async () => {
  console.log('ℹ️ Tags deprecated - now using Groups');
};

/**
 * Phase 2B: All tag routes deprecated - return 410 Gone
 * Tags have been migrated to Groups.
 */
const deprecatedResponse = (req, res) => {
  const slug = req.params?.slug || '';
  res.status(410).json({
    message: 'Tags have been migrated to Groups.',
    deprecated: true,
    migratedAt: '2025-12-27',
    redirect: slug ? `/groups/${slug}` : '/groups'
  });
};

// @route   GET /api/tags
router.get('/', authenticateToken, deprecatedResponse);

// @route   GET /api/tags/trending
router.get('/trending', authenticateToken, deprecatedResponse);

// @route   GET /api/tags/:slug/group-mapping
router.get('/:slug/group-mapping', authenticateToken, deprecatedResponse);

// @route   GET /api/tags/:slug
router.get('/:slug', authenticateToken, deprecatedResponse);

// @route   GET /api/tags/:slug/posts
router.get('/:slug/posts', authenticateToken, deprecatedResponse);

// @route   POST /api/tags/create
router.post('/create', authenticateToken, deprecatedResponse);

// @route   POST /api/tags
router.post('/', authenticateToken, deprecatedResponse);

export default router;

