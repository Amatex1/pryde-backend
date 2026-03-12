/**
 * Discovery Routes
 *
 * GET /api/discovery/heat
 *   Returns the top 20 hottest public posts from the last 7 days,
 *   ranked by the heat score (likes + comments + unique participants + recency).
 *
 * Only public/followers posts are surfaced (no group-only or private posts).
 * Blocked users are excluded from results.
 */

import express from 'express';
import auth from '../middleware/auth.js';
import { searchLimiter } from '../middleware/rateLimiter.js';
import Post from '../models/Post.js';
import { rankPostsByHeat } from '../services/heatmapService.js';
import { getBlockedUserIds } from '../utils/blockHelper.js';
import logger from '../utils/logger.js';

const router = express.Router();

// STEP 5 — 7-day cooldown window
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * @route   GET /api/discovery/heat
 * @desc    Return top 20 hot posts from the last 7 days
 * @access  Private (authenticated)
 */
router.get('/heat', auth, searchLimiter, async (req, res) => {
  try {
    const since = new Date(Date.now() - SEVEN_DAYS_MS);

    // Exclude authors the requesting user has blocked (or who blocked them)
    const blockedUserIds = await getBlockedUserIds(req.userId);

    // Fetch up to 100 candidate posts from the last 7 days.
    // Exclude:
    //   - group-only posts  (groupId != null)
    //   - private posts     (visibility = 'private')
    //   - posts by blocked users
    const posts = await Post.find({
      createdAt:  { $gte: since },
      groupId:    null,                          // no group-gated posts
      visibility: { $in: ['public', 'followers'] },
      author:     { $nin: blockedUserIds },
      isBanned:   { $ne: true },
    })
      .limit(100)
      .populate('author', 'username displayName profilePhoto')
      .lean();

    // Rank by heat score and return the top 20
    const ranked = rankPostsByHeat(posts).slice(0, 20);

    return res.json({ posts: ranked });
  } catch (err) {
    logger.error({ err }, 'discovery/heat error');
    return res.status(500).json({ message: 'Failed to load discovery feed' });
  }
});

export default router;
