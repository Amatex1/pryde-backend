import express from 'express';
const router = express.Router();
import auth from '../middleware/auth.js';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Message from '../models/Message.js';
import Journal from '../models/Journal.js';
import Longform from '../models/Longform.js';
import { searchLimiter } from '../middleware/rateLimiter.js';
import { decryptMessage } from '../utils/encryption.js';
import logger from '../utils/logger.js';

/**
 * Escape special regex characters to prevent ReDoS attacks
 * @param {string} str - String to escape
 * @returns {string} - Escaped string safe for regex
 */
const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

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

    const searchQuery = escapeRegex(q.trim()); // Escape regex special characters
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
      // Note: searchQuery is already escaped, but hashtags are exact matches so no additional escaping needed
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
    logger.error('Search error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/search/hashtag/:tag
// @desc    Get posts by hashtag
// @access  Private
router.get('/hashtag/:tag', auth, async (req, res) => {
  try {
    const hashtag = escapeRegex(req.params.tag.toLowerCase()); // Escape special characters
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
    logger.error('Hashtag search error:', error);
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
    logger.error('Trending error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/search/messages
// @desc    Search inside DMs
// @access  Private
router.get('/messages', auth, searchLimiter, async (req, res) => {
  try {
    const { q, conversationWith, limit = 50 } = req.query;

    if (!q || q.trim() === '') {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const searchQuery = {
      $or: [
        { sender: req.userId },
        { recipient: req.userId }
      ]
    };

    // Filter by conversation partner if specified
    if (conversationWith) {
      searchQuery.$or = [
        { sender: req.userId, recipient: conversationWith },
        { sender: conversationWith, recipient: req.userId }
      ];
    }

    // Get all messages in the conversation(s)
    const messages = await Message.find(searchQuery)
      .populate('sender', 'username displayName profilePhoto')
      .populate('recipient', 'username displayName profilePhoto')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Decrypt and filter messages that match the search query
    const matchingMessages = messages.filter(msg => {
      const decryptedContent = decryptMessage(msg.content);
      return decryptedContent.toLowerCase().includes(q.toLowerCase());
    }).map(msg => ({
      ...msg.toObject(),
      content: decryptMessage(msg.content)
    }));

    res.json({ messages: matchingMessages, count: matchingMessages.length });
  } catch (error) {
    logger.error('Search messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/search/my-posts
// @desc    Search user's own posts
// @access  Private
router.get('/my-posts', auth, searchLimiter, async (req, res) => {
  try {
    const { q, type = 'all', limit = 50 } = req.query;

    if (!q || q.trim() === '') {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const searchRegex = new RegExp(escapeRegex(q), 'i'); // Escape special characters
    const results = {
      posts: [],
      journals: [],
      longforms: []
    };

    // Search posts
    if (type === 'all' || type === 'posts') {
      results.posts = await Post.find({
        author: req.userId,
        content: searchRegex
      })
        .populate('author', 'username displayName profilePhoto isVerified pronouns')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));
    }

    // Search journals
    if (type === 'all' || type === 'journals') {
      results.journals = await Journal.find({
        user: req.userId,
        $or: [
          { title: searchRegex },
          { body: searchRegex }
        ]
      })
        .populate('user', 'username displayName profilePhoto')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));
    }

    // Search longforms
    if (type === 'all' || type === 'longforms') {
      results.longforms = await Longform.find({
        author: req.userId,
        $or: [
          { title: searchRegex },
          { body: searchRegex }
        ]
      })
        .populate('author', 'username displayName profilePhoto isVerified pronouns')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));
    }

    const totalCount = results.posts.length + results.journals.length + results.longforms.length;

    res.json({
      results,
      count: totalCount,
      query: q
    });
  } catch (error) {
    logger.error('Search my posts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

