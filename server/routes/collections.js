/**
 * Life-Signal Feature 2: Personal Collections Routes
 * 
 * Expanded bookmarks with named collections.
 * - Private by default
 * - No public counts, no discovery, no notifications to authors
 */

import express from 'express';
import Collection from '../models/Collection.js';
import CollectionItem from '../models/CollectionItem.js';
import Post from '../models/Post.js';
import { authenticateToken } from '../middleware/auth.js';
import { sanitizeFields } from '../middleware/sanitize.js';

const router = express.Router();

// @route   GET /api/collections
// @desc    Get all collections for current user
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const collections = await Collection.find({ user: req.user.id })
      .sort({ updatedAt: -1 });
    
    // Get item counts for each collection
    const collectionsWithCounts = await Promise.all(
      collections.map(async (collection) => {
        const itemCount = await CollectionItem.countDocuments({ collection: collection._id });
        return {
          ...collection.toObject(),
          itemCount
        };
      })
    );
    
    res.json(collectionsWithCounts);
  } catch (error) {
    console.error('Get collections error:', error);
    res.status(500).json({ message: 'Failed to fetch collections' });
  }
});

// @route   POST /api/collections
// @desc    Create a new collection
// @access  Private
router.post('/', authenticateToken, sanitizeFields(['title', 'description']), async (req, res) => {
  try {
    const { title, description, isPrivate } = req.body;
    
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ message: 'Collection title is required' });
    }
    
    const collection = new Collection({
      user: req.user.id,
      title: title.trim(),
      description: description?.trim() || '',
      isPrivate: isPrivate !== false // Default to private
    });
    
    await collection.save();
    
    res.status(201).json({ ...collection.toObject(), itemCount: 0 });
  } catch (error) {
    console.error('Create collection error:', error);
    res.status(500).json({ message: 'Failed to create collection' });
  }
});

// @route   GET /api/collections/:id
// @desc    Get a collection with its items
// @access  Private (owner only, or public if shared)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const collection = await Collection.findById(id);
    
    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }
    
    // Check access
    if (collection.user.toString() !== req.user.id && collection.isPrivate) {
      return res.status(403).json({ message: 'This collection is private' });
    }
    
    // Get items with populated posts
    const items = await CollectionItem.find({ collection: id })
      .sort({ addedAt: -1 })
      .populate({
        path: 'post',
        populate: {
          path: 'author',
          select: 'username displayName profilePhoto'
        }
      });
    
    res.json({
      collection,
      items: items.filter(item => item.post) // Filter out deleted posts
    });
  } catch (error) {
    console.error('Get collection error:', error);
    res.status(500).json({ message: 'Failed to fetch collection' });
  }
});

// @route   PATCH /api/collections/:id
// @desc    Update a collection
// @access  Private (owner only)
router.patch('/:id', authenticateToken, sanitizeFields(['title', 'description']), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, isPrivate } = req.body;
    
    const collection = await Collection.findById(id);
    
    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }
    
    if (collection.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    if (title !== undefined) collection.title = title.trim();
    if (description !== undefined) collection.description = description.trim();
    if (isPrivate !== undefined) collection.isPrivate = isPrivate;
    
    await collection.save();
    
    res.json(collection);
  } catch (error) {
    console.error('Update collection error:', error);
    res.status(500).json({ message: 'Failed to update collection' });
  }
});

// @route   DELETE /api/collections/:id
// @desc    Delete a collection and all its items
// @access  Private (owner only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const collection = await Collection.findById(id);

    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    if (collection.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Delete all items in collection
    await CollectionItem.deleteMany({ collection: id });
    await Collection.findByIdAndDelete(id);

    res.json({ message: 'Collection deleted' });
  } catch (error) {
    console.error('Delete collection error:', error);
    res.status(500).json({ message: 'Failed to delete collection' });
  }
});

// ============================================================================
// Collection Items
// ============================================================================

// @route   POST /api/collections/:id/items
// @desc    Add a post to a collection
// @access  Private (owner only)
router.post('/:id/items', authenticateToken, sanitizeFields(['note']), async (req, res) => {
  try {
    const { id } = req.params;
    const { postId, note } = req.body;

    if (!postId) {
      return res.status(400).json({ message: 'Post ID is required' });
    }

    const collection = await Collection.findById(id);

    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    if (collection.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if already in collection
    const existing = await CollectionItem.findOne({ collection: id, post: postId });
    if (existing) {
      return res.status(400).json({ message: 'Post already in collection' });
    }

    const item = new CollectionItem({
      collection: id,
      post: postId,
      note: note?.trim() || ''
    });

    await item.save();

    // Update collection timestamp
    collection.updatedAt = Date.now();
    await collection.save();

    res.status(201).json(item);
  } catch (error) {
    console.error('Add to collection error:', error);
    res.status(500).json({ message: 'Failed to add to collection' });
  }
});

// @route   DELETE /api/collections/:id/items/:postId
// @desc    Remove a post from a collection
// @access  Private (owner only)
router.delete('/:id/items/:postId', authenticateToken, async (req, res) => {
  try {
    const { id, postId } = req.params;

    const collection = await Collection.findById(id);

    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    if (collection.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await CollectionItem.findOneAndDelete({ collection: id, post: postId });

    res.json({ message: 'Removed from collection' });
  } catch (error) {
    console.error('Remove from collection error:', error);
    res.status(500).json({ message: 'Failed to remove from collection' });
  }
});

// @route   GET /api/collections/post/:postId
// @desc    Get which collections a post is in (for the save modal)
// @access  Private
router.get('/post/:postId', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;

    // Get user's collections
    const collections = await Collection.find({ user: req.user.id });

    // Get which collections contain this post
    const items = await CollectionItem.find({
      collection: { $in: collections.map(c => c._id) },
      post: postId
    });

    const savedInCollections = items.map(item => item.collection.toString());

    res.json({
      collections: collections.map(c => ({
        ...c.toObject(),
        hasSavedPost: savedInCollections.includes(c._id.toString())
      }))
    });
  } catch (error) {
    console.error('Get post collections error:', error);
    res.status(500).json({ message: 'Failed to fetch collections' });
  }
});

export default router;

