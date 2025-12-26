/**
 * PHASE 4: Tag Routes
 * Community tags for discovery and browsing
 *
 * Migration Phase: TAGS → GROUPS (Phase 0 - Foundation)
 * NOTE: Tags are still legacy-active. This file is NOT being modified for migration
 * except to add a lookup endpoint for tag→group mapping detection.
 */

import express from 'express';
import Tag from '../models/Tag.js';
import Post from '../models/Post.js';
import User from '../models/User.js';
import TagGroupMapping from '../models/TagGroupMapping.js'; // Migration Phase: TAGS → GROUPS
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Predefined core tags
const CORE_TAGS = [
  { slug: 'deepthoughts', label: 'Deep Thoughts', description: 'Philosophical musings and introspective reflections', icon: '🤔' },
  { slug: 'introvertslounge', label: 'Introverts Lounge', description: 'A quiet space for introverts to connect', icon: '🧘' },
  { slug: 'queerlife', label: 'Queer Life', description: 'LGBTQ+ experiences, stories, and community', icon: '🏳️‍🌈' },
  { slug: 'creativehub', label: 'Creative Hub', description: 'Art, writing, music, and creative expression', icon: '🎨' },
  { slug: 'photography', label: 'Photography', description: 'Visual storytelling through photos', icon: '📸' },
  { slug: 'mentalhealthcorner', label: 'Mental Health Corner', description: 'Support and discussion about mental wellness', icon: '💚' },
  { slug: 'bookclub', label: 'Book Club', description: 'Book recommendations and literary discussions', icon: '📚' },
  { slug: 'musiclovers', label: 'Music Lovers', description: 'Share and discover music', icon: '🎵' },
  { slug: 'selflove', label: 'Self Love', description: 'Positivity, self-care, and personal growth', icon: '💖' },
  { slug: 'poetry', label: 'Poetry', description: 'Original poems and poetic expression', icon: '✍️' }
];

// Initialize core tags (run once on server start)
export const initializeTags = async () => {
  try {
    for (const tagData of CORE_TAGS) {
      await Tag.findOneAndUpdate(
        { slug: tagData.slug },
        tagData,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Core tags initialized');
  } catch (error) {
    console.error('Failed to initialize tags:', error);
  }
};

// @route   GET /api/tags
// @desc    Get all tags
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const tags = await Tag.find().sort({ postCount: -1, label: 1 });
    res.json(tags);
  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({ message: 'Failed to fetch tags' });
  }
});

// @route   GET /api/tags/trending
// @desc    Get trending hashtags (alias to /api/search/trending)
// @access  Private
router.get('/trending', authenticateToken, async (req, res) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Build match query - only public posts from last 24 hours
    const trendingMatchQuery = {
      createdAt: { $gte: oneDayAgo },
      visibility: 'public'
    };

    // Aggregate hashtags by count
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
    console.error('Trending tags error:', error);
    res.status(500).json({ message: 'Failed to fetch trending tags' });
  }
});

// @route   GET /api/tags/:slug/group-mapping
// @desc    Check if this tag has been migrated to a group
// @access  Private
// Migration Phase: TAGS → GROUPS (Phase 0 - Foundation)
router.get('/:slug/group-mapping', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;

    // Check if mapping exists
    const mapping = await TagGroupMapping.findOne({ legacyTag: slug })
      .populate('groupId', 'slug name');

    if (!mapping) {
      return res.json({
        hasMigrated: false,
        group: null
      });
    }

    return res.json({
      hasMigrated: true,
      group: {
        slug: mapping.groupId.slug,
        name: mapping.groupId.name
      }
    });
  } catch (error) {
    console.error('Check tag mapping error:', error);
    res.status(500).json({ message: 'Failed to check tag mapping' });
  }
});

// @route   GET /api/tags/:slug
// @desc    Get a single tag by slug
// @access  Private
router.get('/:slug', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const tag = await Tag.findOne({ slug });

    if (!tag) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    res.json(tag);
  } catch (error) {
    console.error('Get tag error:', error);
    res.status(500).json({ message: 'Failed to fetch tag' });
  }
});

// @route   GET /api/tags/:slug/posts
// @desc    Get posts with a specific tag
// @access  Private
router.get('/:slug/posts', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const { before, limit = 20 } = req.query;

    // Find the tag
    const tag = await Tag.findOne({ slug });

    if (!tag) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    // Build query
    let query = {
      tags: tag._id,
      visibility: 'public' // Only show public posts in tag feeds
    };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    // Fetch posts
    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('author', 'username displayName profilePhoto isVerified')
      .populate('tags', 'slug label icon')
      .select('-comments'); // Don't include comments in list view

    // Sanitize likes (hide counts, show only hasLiked)
    const sanitizedPosts = posts.map(post => {
      const obj = post.toObject();
      const hasLiked = obj.likes?.some(like => like.toString() === req.user.id);
      obj.hasLiked = hasLiked;
      delete obj.likes;
      return obj;
    });

    res.json(sanitizedPosts);
  } catch (error) {
    console.error('Get tag posts error:', error);
    res.status(500).json({ message: 'Failed to fetch posts' });
  }
});

// @route   POST /api/tags/create
// @desc    Create a new tag (admin and super_admin only)
// @access  Private (Admin only)
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { name, description, icon } = req.body;

    // Check if user is admin or super_admin
    const user = await User.findById(req.user.id);
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    if (!name) {
      return res.status(400).json({ message: 'Tag name is required' });
    }

    // Validate name length
    if (name.length > 40) {
      return res.status(400).json({ message: 'Tag name must be 40 characters or less' });
    }

    // Validate description length
    if (description && description.length > 200) {
      return res.status(400).json({ message: 'Tag description must be 200 characters or less' });
    }

    // Validate name format (only letters, numbers, spaces, and hyphens)
    const nameRegex = /^[a-zA-Z0-9\s-]+$/;
    if (!nameRegex.test(name)) {
      return res.status(400).json({ message: 'Tag name can only contain letters, numbers, spaces, and hyphens' });
    }

    // Generate slug from name
    const slug = name.toLowerCase().replace(/\s+/g, '').replace(/-+/g, '');

    // Check if tag already exists
    const existingTag = await Tag.findOne({ slug });
    if (existingTag) {
      return res.status(400).json({ message: 'A tag with this name already exists' });
    }

    // Create new tag
    const tag = new Tag({
      slug,
      label: name,
      description: description || '',
      icon: icon || '🏷️',
      createdBy: req.user.id
    });

    await tag.save();
    res.status(201).json({ success: true, tag });
  } catch (error) {
    console.error('Create tag error:', error);
    res.status(500).json({ message: 'Failed to create tag' });
  }
});

// @route   POST /api/tags
// @desc    Create a new tag (legacy endpoint - kept for backward compatibility)
// @access  Private
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { slug, label, description, icon } = req.body;

    if (!slug || !label) {
      return res.status(400).json({ message: 'Slug and label are required' });
    }

    // Check if tag already exists
    const existingTag = await Tag.findOne({ slug: slug.toLowerCase() });
    if (existingTag) {
      return res.json(existingTag); // Return existing tag
    }

    // Create new tag
    const tag = new Tag({
      slug: slug.toLowerCase(),
      label,
      description: description || '',
      icon: icon || '🏷️',
      createdBy: req.user.id
    });

    await tag.save();
    res.status(201).json(tag);
  } catch (error) {
    console.error('Create tag error:', error);
    res.status(500).json({ message: 'Failed to create tag' });
  }
});

export default router;

