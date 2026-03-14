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
// @desc    Global search for users, posts, and hashtags
// @access  Private
// Supports: q, type, from, to, author, sort, page, limit
router.get('/', auth, searchLimiter, async (req, res) => {
  try {
    const {
      q,
      type,
      from,
      to,
      author,
      sort = 'recent',  // 'recent' | 'popular'
      page = 1,
      limit = 20
    } = req.query;

    if (!q || q.trim().length === 0) {
      return res.json({ users: [], posts: [], hashtags: [], total: 0 });
    }

    const searchQuery = escapeRegex(q.trim());
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const results = { users: [], posts: [], hashtags: [] };

    const blockedUserIds = await getBlockedUserIds(req.userId);

    // ── Users ─────────────────────────────────────────────────────────────
    if (!type || type === 'all' || type === 'users') {
      results.users = await User.find({
        $or: [
          { username: { $regex: searchQuery, $options: 'i' } },
          { displayName: { $regex: searchQuery, $options: 'i' } }
        ],
        _id: { $nin: blockedUserIds },
        isActive: true,
        isBanned: { $ne: true },
        'privacy.hideProfileFromSearch': { $ne: true }
      })
      .select('username displayName profilePhoto bio')
      .limit(10);
    }

    // ── Posts ─────────────────────────────────────────────────────────────
    if (!type || type === 'all' || type === 'posts') {
      const postQuery = {
        content: { $regex: searchQuery, $options: 'i' },
        groupId: null
      };

      // Date range filters
      if (from || to) {
        postQuery.createdAt = {};
        if (from) postQuery.createdAt.$gte = new Date(from);
        if (to)   postQuery.createdAt.$lte = new Date(to);
      }

      // Author filter — resolve username to userId
      if (author) {
        const authorUser = await User.findOne({
          username: { $regex: `^${escapeRegex(author)}$`, $options: 'i' }
        }).select('_id');
        if (authorUser) {
          postQuery.author = authorUser._id;
        } else {
          // Author not found — return no posts
          postQuery.author = null;
        }
      }

      if (req.user.role !== 'super_admin') {
        postQuery.visibility = 'public';
        postQuery.hiddenFrom = { $ne: req.userId };
        if (!postQuery.author) postQuery.author = { $nin: blockedUserIds };
        if (!['moderator', 'admin', 'super_admin'].includes(req.user.role)) {
          postQuery.isAnonymous = { $ne: true };
        }
      }

      const sortOrder = sort === 'popular'
        ? { 'likes': -1, createdAt: -1 }
        : { createdAt: -1 };

      results.posts = await Post.find(postQuery)
        .populate('author', 'username displayName profilePhoto')
        .sort(sortOrder)
        .skip(skip)
        .limit(parseInt(limit));
    }

    // ── Hashtags (content-based) ───────────────────────────────────────────
    if (!type || type === 'all' || type === 'hashtags') {
      // Extract hashtag from query (strip leading # if present)
      const tagWord = q.trim().replace(/^#/, '');
      const hashtagRegex = new RegExp(`#${escapeRegex(tagWord)}\\b`, 'i');

      const hashtagPostQuery = {
        content: { $regex: hashtagRegex },
        groupId: null,
        visibility: 'public',
        isAnonymous: { $ne: true },
        author: { $nin: blockedUserIds }
      };

      if (from || to) {
        hashtagPostQuery.createdAt = {};
        if (from) hashtagPostQuery.createdAt.$gte = new Date(from);
        if (to)   hashtagPostQuery.createdAt.$lte = new Date(to);
      }

      results.hashtags = await Post.find(hashtagPostQuery)
        .populate('author', 'username displayName profilePhoto')
        .sort({ createdAt: -1 })
        .limit(20);
    }

    res.json(results);
  } catch (error) {
    logger.error('Search error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/search/hashtag/:tag
// @desc    Posts containing a specific hashtag
// @access  Private
router.get('/hashtag/:tag', auth, searchLimiter, async (req, res) => {
  try {
    const tag = req.params.tag.replace(/^#/, '');
    if (!tag) return res.status(400).json({ message: 'Tag is required' });

    const blockedUserIds = await getBlockedUserIds(req.userId);
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {
      content: { $regex: new RegExp(`#${escapeRegex(tag)}\\b`, 'i') },
      groupId: null,
      visibility: 'public',
      isAnonymous: { $ne: true },
      author: { $nin: blockedUserIds }
    };

    const [posts, total] = await Promise.all([
      Post.find(query)
        .populate('author', 'username displayName profilePhoto')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Post.countDocuments(query)
    ]);

    res.json({
      tag,
      posts,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    logger.error('Hashtag search error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/search/trending
// @desc    Top hashtags (by post count) in the last 7 days
// @access  Private
router.get('/trending', auth, searchLimiter, async (req, res) => {
  try {
    const blockedUserIds = await getBlockedUserIds(req.userId);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const posts = await Post.find({
      createdAt: { $gte: since },
      visibility: 'public',
      isAnonymous: { $ne: true },
      groupId: null,
      author: { $nin: blockedUserIds },
      content: { $regex: /#\w+/, $options: 'i' }
    }).select('content').lean();

    // Extract and count hashtags from content
    const tagCount = {};
    const hashtagPattern = /#(\w+)/gi;
    for (const post of posts) {
      let match;
      while ((match = hashtagPattern.exec(post.content)) !== null) {
        const tag = match[1].toLowerCase();
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      }
    }

    const trending = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, count }));

    res.json({ trending, since });
  } catch (error) {
    logger.error('Trending hashtags error:', error);
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
    // First, get the decrypted content for filtering (handle both encrypted and plain text)
    const decryptedMessages = messages.map(msg => {
      // Get the message object
      const msgObj = msg.toObject ? msg.toObject() : msg;
      let content = msgObj.content;
      
      // Try to decrypt if it looks encrypted
      try {
        if (content && typeof content === 'object' && content.iv && content.authTag && content.encryptedData) {
          content = decryptMessage(content);
        } else if (content && typeof content === 'string') {
          // Try to parse as JSON for backward compatibility
          try {
            const parsed = JSON.parse(content);
            if (parsed && typeof parsed === 'object' && parsed.iv && parsed.authTag && parsed.encryptedData) {
              content = decryptMessage(parsed);
            }
          } catch (parseErr) {
            // Not JSON, leave as is (plain text)
          }
        }
      } catch (decryptErr) {
        // Decryption failed, keep original content
        console.log('⚠️ Decryption failed for message:', decryptErr.message);
      }
      
      return {
        ...msgObj,
        content
      };
    });
    
    // Now filter by search query on decrypted content
    const matchingMessages = decryptedMessages.filter(msg => {
      return msg.content && msg.content.toLowerCase().includes(q.toLowerCase());
    });

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
