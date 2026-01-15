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
import { getBlockedUserIds } from '../utils/blockHelper.js';
import { escapeRegex } from '../utils/sanitize.js';

// @route   GET /api/search
// @desc    Global search for users and posts
// @access  Private
// REMOVED 2025-12-26: Hashtag search removed (Phase 5)
router.get('/', auth, searchLimiter, async (req, res) => {
  try {
    const { q, type } = req.query;

    if (!q || q.trim().length === 0) {
      return res.json({
        users: [],
        posts: []
        // REMOVED 2025-12-26: hashtags removed (Phase 5)
      });
    }

    const searchQuery = escapeRegex(q.trim()); // Escape regex special characters
    const results = {
      users: [],
      posts: []
      // REMOVED 2025-12-26: hashtags removed (Phase 5)
    };

    // Get blocked user IDs to filter them out
    const blockedUserIds = await getBlockedUserIds(req.userId);

    // Search users (if type is 'all' or 'users')
    if (!type || type === 'all' || type === 'users') {
      results.users = await User.find({
        $or: [
          { username: { $regex: searchQuery, $options: 'i' } },
          { displayName: { $regex: searchQuery, $options: 'i' } }
        ],
        _id: { $nin: blockedUserIds }, // Exclude blocked users
        isActive: true, // Only show active accounts
        isBanned: { $ne: true } // Exclude banned users
      })
      .select('username displayName profilePhoto bio')
      .limit(10);
    }

    // Search posts by content (if type is 'all' or 'posts')
    if (!type || type === 'all' || type === 'posts') {
      // Build query - super_admin can see all posts
      // Phase 2: Always exclude group posts from search
      const postQuery = {
        content: { $regex: searchQuery, $options: 'i' },
        groupId: null // Phase 2: Exclude group posts from search
      };

      // Apply privacy filters only for non-admin users
      if (req.user.role !== 'super_admin') {
        postQuery.visibility = 'public';
        postQuery.hiddenFrom = { $ne: req.userId };
        postQuery.author = { $nin: blockedUserIds }; // Exclude blocked users
      }

      results.posts = await Post.find(postQuery)
      .populate('author', 'username displayName profilePhoto')
      .sort({ createdAt: -1 })
      .limit(20);
    }

    // REMOVED 2025-12-26: Hashtag search removed (Phase 5)
    // Hashtags field no longer exists in Post model

    res.json(results);
  } catch (error) {
    logger.error('Search error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/search/hashtag/:tag
// @desc    DEPRECATED - Hashtag search removed 2025-12-26 (Phase 5)
// @access  Private
router.get('/hashtag/:tag', auth, (req, res) => {
  res.status(410).json({
    message: 'Hashtag search has been removed.',
    deprecated: true,
    removedDate: '2025-12-26',
    posts: []
  });
});

// @route   GET /api/search/trending
// @desc    DEPRECATED - Trending hashtags removed 2025-12-26 (Phase 5)
// @access  Private
router.get('/trending', auth, (req, res) => {
  res.status(410).json({
    message: 'Trending hashtags feature has been removed.',
    deprecated: true,
    removedDate: '2025-12-26'
  });
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
    // Phase 2: Exclude group posts from my-posts search (they have their own context)
    if (type === 'all' || type === 'posts') {
      results.posts = await Post.find({
        author: req.userId,
        content: searchRegex,
        groupId: null // Phase 2: Exclude group posts
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

