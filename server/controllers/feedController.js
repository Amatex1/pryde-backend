/**
 * Feed Controller
 * 
 * Handles personalized feed requests using the FeedEntry system.
 * This is a NEW endpoint that uses fan-out-on-write architecture.
 * 
 * Existing feed endpoints remain unchanged for backward compatibility.
 */

import { getUserFeed } from '../services/feedService.js';
import { asyncHandler, requireAuth } from '../utils/errorHandler.js';
import logger from '../utils/logger.js';

/**
 * GET /api/feed/personal
 * 
 * Get personalized feed using FeedEntry system.
 * Falls back to original feed system if FeedEntry data unavailable.
 * 
 * Query params:
 * - limit: Maximum posts to return (default: 50, max: 100)
 * 
 * Response:
 * {
 *   posts: Array<Post>,
 *   source: 'feedEntry' | 'fallback'
 * }
 */
export const getPersonalFeed = asyncHandler(async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { limit } = req.query;
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));

  try {
    const posts = await getUserFeed(userId, { limit: limitNum });

    logger.debug(`[FeedController] Personal feed for user ${userId}: ${posts.length} posts`);

    res.json({
      posts: posts,
      count: posts.length,
      source: 'feedEntry' // Could be enhanced to track source
    });
  } catch (error) {
    logger.error('[FeedController] Error fetching personal feed:', error.message);
    res.status(500).json({ message: 'Failed to fetch feed' });
  }
});

export default {
  getPersonalFeed
};

