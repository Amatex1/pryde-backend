import express from 'express';
const router = express.Router();
import User from '../models/User.js';
import Post from '../models/Post.js';
import auth from '../middleware/auth.js';

// @route   GET /api/bookmarks
// @desc    Get all bookmarked posts
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate({
        path: 'bookmarkedPosts',
        populate: [
          { path: 'author', select: 'username displayName profilePhoto' },
          { path: 'comments.user', select: 'username displayName profilePhoto' },
          { path: 'likes', select: 'username displayName profilePhoto' },
          { path: 'reactions.user', select: 'username displayName profilePhoto' },
          { path: 'comments.reactions.user', select: 'username displayName profilePhoto' }
        ],
        options: { sort: { createdAt: -1 } }
      });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ bookmarks: user.bookmarkedPosts });
  } catch (error) {
    console.error('Get bookmarks error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/bookmarks/:postId
// @desc    Bookmark a post
// @access  Private
router.post('/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const user = await User.findById(req.userId);

    // Check if already bookmarked
    if (user.bookmarkedPosts.includes(postId)) {
      return res.status(400).json({ message: 'Post already bookmarked' });
    }

    // Add to bookmarks
    user.bookmarkedPosts.push(postId);
    await user.save();

    res.json({ 
      message: 'Post bookmarked successfully',
      bookmarkedPosts: user.bookmarkedPosts
    });
  } catch (error) {
    console.error('Bookmark post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/bookmarks/:postId
// @desc    Remove bookmark from a post
// @access  Private
router.delete('/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;

    const user = await User.findById(req.userId);

    // Check if bookmarked
    if (!user.bookmarkedPosts.includes(postId)) {
      return res.status(400).json({ message: 'Post not bookmarked' });
    }

    // Remove from bookmarks
    user.bookmarkedPosts = user.bookmarkedPosts.filter(
      id => id.toString() !== postId
    );
    await user.save();

    res.json({ 
      message: 'Bookmark removed successfully',
      bookmarkedPosts: user.bookmarkedPosts
    });
  } catch (error) {
    console.error('Remove bookmark error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/bookmarks/check/:postId
// @desc    Check if a post is bookmarked
// @access  Private
router.get('/check/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;

    const user = await User.findById(req.userId).select('bookmarkedPosts');

    const isBookmarked = user.bookmarkedPosts.includes(postId);

    res.json({ isBookmarked });
  } catch (error) {
    console.error('Check bookmark error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

