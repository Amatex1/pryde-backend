import express from 'express';
import Comment from '../models/Comment.js';
import Post from '../models/Post.js';
import auth from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// @route   GET /api/posts/:postId/comments
// @desc    Get all comments for a post (top-level only, sorted oldest first)
// @access  Private
router.get('/posts/:postId/comments', auth, async (req, res) => {
  try {
    const { postId } = req.params;

    logger.debug('📥 Fetching comments for post:', postId);

    // Verify post exists
    const post = await Post.findById(postId);
    if (!post) {
      logger.error('❌ Post not found:', postId);
      return res.status(404).json({ message: 'Post not found' });
    }

    // Get top-level comments (parentCommentId === null)
    const comments = await Comment.find({
      postId,
      parentCommentId: null,
      isDeleted: false // Don't show deleted comments
    })
      .populate('authorId', 'username displayName profilePhoto isVerified pronouns')
      .sort({ isPinned: -1, createdAt: 1 }) // Pinned first, then oldest first
      .lean();

    logger.debug(`✅ Found ${comments.length} comments for post ${postId}`);

    // For each top-level comment, get reply count
    const commentsWithReplyCounts = await Promise.all(
      comments.map(async (comment) => {
        const replyCount = await Comment.countDocuments({
          parentCommentId: comment._id
        });
        return {
          ...comment,
          replyCount
        };
      })
    );

    res.json(commentsWithReplyCounts);
  } catch (error) {
    logger.error('Get comments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/comments/:commentId/replies
// @desc    Get all replies for a comment
// @access  Private
router.get('/comments/:commentId/replies', auth, async (req, res) => {
  try {
    const { commentId } = req.params;

    // Verify parent comment exists
    const parentComment = await Comment.findById(commentId);
    if (!parentComment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Get replies (sorted oldest first)
    const replies = await Comment.find({
      parentCommentId: commentId,
      isDeleted: false // Don't show deleted replies
    })
      .populate('authorId', 'username displayName profilePhoto isVerified pronouns')
      .sort({ createdAt: 1 })
      .lean();

    res.json(replies);
  } catch (error) {
    logger.error('Get replies error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts/:postId/comments
// @desc    Add a comment to a post (or reply to a comment)
// @access  Private
router.post('/posts/:postId/comments', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { content, gifUrl, parentCommentId } = req.body;
    const userId = req.userId || req.user._id;

    // Either content or gifUrl must be provided
    if ((!content || content.trim() === '') && !gifUrl) {
      return res.status(400).json({ message: 'Comment content or GIF is required' });
    }

    // Verify post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // If replying to a comment, verify it exists and is a top-level comment
    if (parentCommentId) {
      const parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        return res.status(404).json({ message: 'Parent comment not found' });
      }
      // Enforce 1-level nesting: replies cannot have replies
      if (parentComment.parentCommentId !== null) {
        return res.status(400).json({ message: 'Cannot reply to a reply. Only one level of nesting allowed.' });
      }
    }

    // Create comment
    const comment = new Comment({
      postId,
      authorId: userId,
      content: content || '',
      gifUrl: gifUrl || null,
      parentCommentId: parentCommentId || null
    });

    logger.debug('💬 Creating comment:', {
      postId,
      authorId: userId,
      content: content?.substring(0, 50),
      parentCommentId
    });

    await comment.save();

    logger.debug('✅ Comment saved to database:', {
      commentId: comment._id,
      postId: comment.postId,
      authorId: comment.authorId
    });

    // Populate author
    await comment.populate('authorId', 'username displayName profilePhoto isVerified pronouns');

    // Emit real-time event
    if (req.io) {
      req.io.emit('comment_added', {
        postId,
        comment: comment.toObject()
      });
    }

    logger.debug('📤 Sending comment response to client');

    res.status(201).json(comment);
  } catch (error) {
    logger.error('Create comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/comments/:commentId
// @desc    Edit a comment
// @access  Private
router.put('/comments/:commentId', auth, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.userId || req.user._id;

    if (!content || content.trim() === '') {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user is the comment author
    if (comment.authorId.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to edit this comment' });
    }

    comment.content = content;
    comment.isEdited = true;
    comment.editedAt = new Date();

    await comment.save();
    await comment.populate('authorId', 'username displayName profilePhoto isVerified pronouns');

    // Emit real-time event
    if (req.io) {
      req.io.emit('comment_updated', {
        postId: comment.postId,
        comment: comment.toObject()
      });
    }

    res.json(comment);
  } catch (error) {
    logger.error('Edit comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/comments/:commentId
// @desc    Delete a comment
// @access  Private
router.delete('/comments/:commentId', auth, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.userId || req.user._id;

    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user is the comment author or post author
    const post = await Post.findById(comment.postId);
    if (comment.authorId.toString() !== userId.toString() && post.author.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    // Soft delete: mark as deleted instead of removing
    comment.isDeleted = true;
    comment.content = ''; // Clear content for privacy
    comment.gifUrl = null; // Clear GIF
    await comment.save();

    // If this is a top-level comment, also soft delete all its replies
    if (comment.parentCommentId === null) {
      await Comment.updateMany(
        { parentCommentId: commentId },
        { isDeleted: true, content: '', gifUrl: null }
      );
    }

    // Emit real-time event
    if (req.io) {
      req.io.emit('comment_deleted', {
        postId: comment.postId,
        commentId
      });
    }

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    logger.error('Delete comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/comments/:commentId/react
// @desc    Add a reaction to a comment
// @access  Private
router.post('/comments/:commentId/react', auth, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { emoji } = req.body;
    const userId = req.userId || req.user._id;

    if (!emoji) {
      return res.status(400).json({ message: 'Emoji is required' });
    }

    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Initialize reactions Map if it doesn't exist
    if (!comment.reactions) {
      comment.reactions = new Map();
    }

    // Convert to plain object for easier manipulation
    const reactions = comment.reactions.toObject ? comment.reactions.toObject() : comment.reactions;
    const userIdStr = userId.toString();

    // Remove user from all emoji arrays (user can only have one reaction)
    Object.keys(reactions).forEach(key => {
      reactions[key] = reactions[key].filter(id => id !== userIdStr);
    });

    // Check if user is toggling off the same emoji
    const hadThisReaction = comment.reactions.get(emoji)?.includes(userIdStr);

    if (!hadThisReaction) {
      // Add user to the selected emoji array
      if (!reactions[emoji]) {
        reactions[emoji] = [];
      }
      reactions[emoji].push(userIdStr);
    }

    // Clean up empty arrays
    Object.keys(reactions).forEach(key => {
      if (reactions[key].length === 0) {
        delete reactions[key];
      }
    });

    comment.reactions = reactions;
    await comment.save();
    await comment.populate('authorId', 'username displayName profilePhoto isVerified pronouns');

    // Emit real-time event
    if (req.io) {
      req.io.emit('comment_reaction_added', {
        postId: comment.postId,
        commentId,
        comment: comment.toObject()
      });
    }

    res.json(comment);
  } catch (error) {
    logger.error('React to comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

