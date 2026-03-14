/**
 * Stories routes — ephemeral content (24-hour posts)
 *
 * POST   /api/stories              Create a story
 * GET    /api/stories/feed         Feed: active stories from followed users
 * GET    /api/stories/me           Current user's own stories
 * GET    /api/stories/:userId      Public stories for a specific user
 * POST   /api/stories/:id/view     Mark story as viewed
 * DELETE /api/stories/:id          Delete own story
 */

import express from 'express';
const router = express.Router();
import auth from '../middleware/auth.js';
import requireActiveUser from '../middleware/requireActiveUser.js';
import requireEmailVerification from '../middleware/requireEmailVerification.js';
import Story from '../models/Story.js';
import Follow from '../models/Follow.js';
import User from '../models/User.js';
import { writeLimiter } from '../middleware/rateLimiter.js';
import { getBlockedUserIds } from '../utils/blockHelper.js';
import logger from '../utils/logger.js';

// Max 20 stories per day per user
const DAILY_STORY_LIMIT = parseInt(process.env.STORY_DAILY_LIMIT || '20', 10);

/**
 * POST /api/stories
 * Create a new story (24-hour ephemeral post)
 */
router.post('/', auth, requireActiveUser, requireEmailVerification, writeLimiter, async (req, res) => {
  try {
    const { mediaUrl, mediaType, caption, contentWarning, visibility } = req.body;

    if (!mediaUrl || !mediaType) {
      return res.status(400).json({ message: 'mediaUrl and mediaType are required' });
    }

    if (!['image', 'video'].includes(mediaType)) {
      return res.status(400).json({ message: 'mediaType must be image or video' });
    }

    // Daily story limit
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const todayCount = await Story.countDocuments({
      author: req.userId,
      createdAt: { $gte: startOfDay }
    });

    if (todayCount >= DAILY_STORY_LIMIT) {
      return res.status(429).json({
        message: `Story limit reached. You can post up to ${DAILY_STORY_LIMIT} stories per day.`
      });
    }

    const story = new Story({
      author: req.userId,
      mediaUrl,
      mediaType,
      caption: caption?.trim().slice(0, 150) || '',
      contentWarning: contentWarning?.trim().slice(0, 100) || '',
      visibility: ['public', 'followers'].includes(visibility) ? visibility : 'followers'
    });

    await story.save();
    await story.populate('author', 'username displayName profilePhoto');

    res.status(201).json({ story });
  } catch (error) {
    logger.error('Create story error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/stories/feed
 * Active stories from users the current user follows, grouped by author
 */
router.get('/feed', auth, requireActiveUser, async (req, res) => {
  try {
    const blockedUserIds = await getBlockedUserIds(req.userId);

    // Get IDs of users the current user follows
    const followEdges = await Follow.find({ follower: req.userId }).select('following');
    const followingIds = followEdges.map(e => e.following);

    // Include own stories in the feed
    followingIds.push(req.userId);

    const stories = await Story.find({
      author: { $in: followingIds, $nin: blockedUserIds },
      expiresAt: { $gt: new Date() },
      $or: [
        { visibility: 'public' },
        { visibility: 'followers', author: { $in: followingIds } }
      ]
    })
    .sort({ createdAt: -1 })
    .populate('author', 'username displayName profilePhoto')
    .lean();

    // Group by author for the stories tray UI
    const grouped = {};
    for (const story of stories) {
      const authorId = story.author._id.toString();
      if (!grouped[authorId]) {
        grouped[authorId] = {
          author: story.author,
          stories: [],
          hasUnviewed: false
        };
      }
      const viewed = story.viewedBy?.some(v => v.user?.toString() === req.userId);
      if (!viewed) grouped[authorId].hasUnviewed = true;
      grouped[authorId].stories.push({
        ...story,
        viewed: !!viewed
      });
    }

    const feed = Object.values(grouped).sort((a, b) => {
      // Unviewed authors float to the top
      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;
      return 0;
    });

    res.json({ feed });
  } catch (error) {
    logger.error('Stories feed error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/stories/me
 * Current user's own active stories
 */
router.get('/me', auth, requireActiveUser, async (req, res) => {
  try {
    const stories = await Story.find({
      author: req.userId,
      expiresAt: { $gt: new Date() }
    })
    .sort({ createdAt: -1 })
    .lean();

    res.json({ stories });
  } catch (error) {
    logger.error('My stories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/stories/:userId
 * Active stories for a specific user (respects privacy)
 */
router.get('/:userId', auth, requireActiveUser, async (req, res) => {
  try {
    const { userId } = req.params;
    const blockedUserIds = await getBlockedUserIds(req.userId);

    if (blockedUserIds.map(String).includes(userId)) {
      return res.json({ stories: [] });
    }

    // Check if the current user follows this person (for followers-only stories)
    const isFollowing = await Follow.exists({ follower: req.userId, following: userId });
    const isSelf = userId === req.userId;

    const query = {
      author: userId,
      expiresAt: { $gt: new Date() }
    };

    if (!isSelf && !isFollowing) {
      query.visibility = 'public';
    }

    const stories = await Story.find(query)
      .sort({ createdAt: -1 })
      .populate('author', 'username displayName profilePhoto')
      .lean();

    const storiesWithViewStatus = stories.map(s => ({
      ...s,
      viewed: s.viewedBy?.some(v => v.user?.toString() === req.userId) ?? false
    }));

    res.json({ stories: storiesWithViewStatus });
  } catch (error) {
    logger.error('Get user stories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/stories/:id/view
 * Mark a story as viewed by the current user
 */
router.post('/:id/view', auth, requireActiveUser, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story || story.expiresAt < new Date()) {
      return res.status(404).json({ message: 'Story not found or expired' });
    }

    // Idempotent — only add if not already viewed
    const alreadyViewed = story.viewedBy.some(v => v.user?.toString() === req.userId);
    if (!alreadyViewed) {
      story.viewedBy.push({ user: req.userId, viewedAt: new Date() });
      await story.save();
    }

    res.json({ viewed: true });
  } catch (error) {
    logger.error('Mark story viewed error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * DELETE /api/stories/:id
 * Delete own story before it expires
 */
router.delete('/:id', auth, requireActiveUser, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ message: 'Story not found' });

    if (story.author.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await story.deleteOne();
    res.json({ message: 'Story deleted' });
  } catch (error) {
    logger.error('Delete story error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
