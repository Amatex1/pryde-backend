import express from 'express';
const router = express.Router();
import auth from '../middleware/auth.js';
import User from '../models/User.js';
import Post from '../models/Post.js';
import { searchLimiter } from '../middleware/rateLimiter.js';

// @route   GET /api/search
// @desc    Global search for users, posts, and hashtags
// @access  Private
router.get('/', auth, searchLimiter, async (req, res) => {
  try {
    const { q, type } = req.query;

    if (!q || q.trim().length === 0) {
      return res.json({
        users: [],
        posts: [],
        hashtags: []
      });
    }

    const searchQuery = q.trim();
    const results = {
      users: [],
      posts: [],
      hashtags: []
    };

    // Search users (if type is 'all' or 'users')
    if (!type || type === 'all' || type === 'users') {
      results.users = await User.find({
        $or: [
          { username: { $regex: searchQuery, $options: 'i' } },
          { displayName: { $regex: searchQuery, $options: 'i' } }
        ],
        isActive: true, // Only show active accounts
        isBanned: { $ne: true } // Exclude banned users
      })
      .select('username displayName profilePhoto bio')
      .limit(10);
    }

    // Search posts by content (if type is 'all' or 'posts')
    if (!type || type === 'all' || type === 'posts') {
      // Build query - super_admin can see all posts
      const postQuery = {
        content: { $regex: searchQuery, $options: 'i' }
      };

      // Apply privacy filters only for non-admin users
      if (req.user.role !== 'super_admin') {
        postQuery.visibility = 'public';
        postQuery.hiddenFrom = { $ne: req.userId };
      }

      results.posts = await Post.find(postQuery)
      .populate('author', 'username displayName profilePhoto')
      .sort({ createdAt: -1 })
      .limit(20);
    }

    // Search hashtags (if type is 'all' or 'hashtags')
    if (!type || type === 'all' || type === 'hashtags') {
      const hashtagQuery = searchQuery.startsWith('#') ? searchQuery.toLowerCase() : `#${searchQuery.toLowerCase()}`;

      // Build match query - super_admin can see all hashtags
      const hashtagMatchQuery = {
        hashtags: { $regex: hashtagQuery, $options: 'i' }
      };

      // Apply privacy filters only for non-admin users
      if (req.user.role !== 'super_admin') {
        hashtagMatchQuery.visibility = 'public';
        hashtagMatchQuery.hiddenFrom = { $ne: req.userId };
      }

      results.hashtags = await Post.aggregate([
        { $match: hashtagMatchQuery },
        { $unwind: '$hashtags' },
        { $match: { hashtags: { $regex: hashtagQuery, $options: 'i' } } },
        { $group: { _id: '$hashtags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { hashtag: '$_id', count: 1, _id: 0 } }
      ]);
    }

    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/search/hashtag/:tag
// @desc    Get posts by hashtag
// @access  Private
router.get('/hashtag/:tag', auth, async (req, res) => {
  try {
    const hashtag = req.params.tag.toLowerCase();
    const hashtagQuery = hashtag.startsWith('#') ? hashtag : `#${hashtag}`;

    // Build query - super_admin can see all posts
    const query = {
      hashtags: hashtagQuery
    };

    // Apply privacy filters only for non-admin users
    if (req.user.role !== 'super_admin') {
      query.visibility = 'public';
      query.hiddenFrom = { $ne: req.userId };
    }

    const posts = await Post.find(query)
    .populate('author', 'username displayName profilePhoto')
    .populate('comments.user', 'username displayName profilePhoto')
    .sort({ createdAt: -1 })
    .limit(50);

    res.json({ posts, hashtag: hashtagQuery });
  } catch (error) {
    console.error('Hashtag search error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/search/trending
// @desc    Get trending hashtags
// @access  Private
router.get('/trending', auth, async (req, res) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Build match query - super_admin can see all trending
    const trendingMatchQuery = {
      createdAt: { $gte: oneDayAgo }
    };

    // Apply privacy filters only for non-admin users
    if (req.user.role !== 'super_admin') {
      trendingMatchQuery.visibility = 'public';
      trendingMatchQuery.hiddenFrom = { $ne: req.userId };
    }

    const trending = await Post.aggregate([
      { $match: trendingMatchQuery },
      { $unwind: '$hashtags' },
      { $group: { _id: '$hashtags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { hashtag: '$_id', count: 1, _id: 0 } }
    ]);

    res.json(trending);
  } catch (error) {
    console.error('Trending error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

