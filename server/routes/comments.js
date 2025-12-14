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

    // Verify post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Get top-level comments (parentCommentId === null)
    const comments = await Comment.find({
      postId,
      parentCommentId: null
    })
      .populate('authorId', 'username displayName profilePhoto isVerified pronouns')
      .populate('reactions.user', 'username displayName profilePhoto')
      .sort({ createdAt: 1 }) // Oldest first (Facebook style)
      .lean();

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
      parentCommentId: commentId
    })
      .populate('authorId', 'username displayName profilePhoto isVerified pronouns')
      .populate('reactions.user', 'username displayName profilePhoto')
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

    await comment.save();

    // Populate author and reactions
    await comment.populate('authorId', 'username displayName profilePhoto isVerified pronouns');
    await comment.populate('reactions.user', 'username displayName profilePhoto');

    // Emit real-time event
    if (req.io) {
      req.io.emit('comment_added', {
        postId,
        comment: comment.toObject()
      });
    }

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
    await comment.populate('reactions.user', 'username displayName profilePhoto');

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

    // If this is a top-level comment, also delete all its replies
    if (comment.parentCommentId === null) {
      await Comment.deleteMany({ parentCommentId: commentId });
    }

    await comment.deleteOne();

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

    // Initialize reactions array if it doesn't exist
    if (!comment.reactions) {
      comment.reactions = [];
    }

    // Check if user already reacted with this emoji
    const existingReaction = comment.reactions.find(
      r => r.user.toString() === userId.toString() && r.emoji === emoji
    );

    if (existingReaction) {
      // Remove the reaction (toggle off)
      comment.reactions = comment.reactions.filter(
        r => !(r.user.toString() === userId.toString() && r.emoji === emoji)
      );
    } else {
      // Remove any other reaction from this user first (only one reaction per user)
      comment.reactions = comment.reactions.filter(
        r => r.user.toString() !== userId.toString()
      );

      // Add new reaction
      comment.reactions.push({
        user: userId,
        emoji,
        createdAt: new Date()
      });
    }

    await comment.save();
    await comment.populate('authorId', 'username displayName profilePhoto isVerified pronouns');
    await comment.populate('reactions.user', 'username displayName profilePhoto');

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

