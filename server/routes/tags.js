/**
 * PHASE 4: Tag Routes
 * Community tags for discovery and browsing
 */

import express from 'express';
import Tag from '../models/Tag.js';
import Post from '../models/Post.js';
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

// @route   POST /api/tags
// @desc    Create a new tag (admin only or allow users to create)
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

