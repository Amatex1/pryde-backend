/**
 * Comment Routes
 * PHASE 2 SAFETY: All routes use guard clauses and optional chaining
 */

import express from 'express';
import Comment from '../models/Comment.js';
import Post from '../models/Post.js';
import auth from '../middleware/auth.js';
import requireActiveUser from '../middleware/requireActiveUser.js';
import { reactionLimiter } from '../middleware/rateLimiter.js';
import logger from '../utils/logger.js';
import {
  trackMutation,
  confirmMutation,
  failMutation,
  MutationType
} from '../utils/mutationTracker.js';
import { asyncHandler, requireAuth, requireValidId, requireParams, sendError, HttpStatus } from '../utils/errorHandler.js';

const router = express.Router();

// @route   GET /api/posts/:postId/comments
// @desc    Get all comments for a post (top-level only, sorted oldest first)
// @access  Private
router.get('/posts/:postId/comments', auth, requireActiveUser, asyncHandler(async (req, res) => {
  // SAFETY: Guard clause for auth
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { postId } = req.params;

  // SAFETY: Validate ObjectId
  if (!requireValidId(postId, 'post ID', res)) return;

  logger.debug('📥 Fetching comments for post:', postId);

  // Verify post exists
  const post = await Post.findById(postId);
  if (!post) {
    logger.error('❌ Post not found:', postId);
    return sendError(res, HttpStatus.NOT_FOUND, 'Post not found');
  }

  // Get top-level comments with reply counts in ONE aggregation (OPTIMIZED)
  const comments = await Comment.aggregate([
    {
      $match: {
        postId: post._id,
        parentCommentId: null,
        isDeleted: false
      }
    },
    {
      $lookup: {
        from: 'comments',
        localField: '_id',
        foreignField: 'parentCommentId',
        as: 'replies'
      }
    },
    {
      $addFields: {
        replyCount: { $size: '$replies' }
      }
    },
    {
      $project: {
        replies: 0 // Don't include the actual replies array
      }
    },
    {
      $sort: { isPinned: -1, createdAt: 1 }
    }
  ]);

  // Populate author info
  await Comment.populate(comments, {
    path: 'authorId',
    select: 'username displayName profilePhoto isVerified pronouns'
  });

  logger.debug(`✅ Found ${comments.length} comments for post ${postId}`);

  res.json(comments);
}));

// @route   GET /api/comments/:commentId/replies
// @desc    Get all replies for a comment
// @access  Private
router.get('/comments/:commentId/replies', auth, requireActiveUser, asyncHandler(async (req, res) => {
  // SAFETY: Guard clause for auth
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { commentId } = req.params;

  // SAFETY: Validate ObjectId
  if (!requireValidId(commentId, 'comment ID', res)) return;

  // Verify parent comment exists
  const parentComment = await Comment.findById(commentId);
  if (!parentComment) {
    return sendError(res, HttpStatus.NOT_FOUND, 'Comment not found');
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
}));

// @route   POST /api/posts/:postId/comments
// @desc    Add a comment to a post (or reply to a comment)
// @access  Private
router.post('/posts/:postId/comments', auth, requireActiveUser, asyncHandler(async (req, res) => {
  // SAFETY: Guard clause for auth
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { postId } = req.params;

  // SAFETY: Validate ObjectId
  if (!requireValidId(postId, 'post ID', res)) return;

  // Track mutation
  const mutationId = trackMutation(MutationType.CREATE, 'Comment', {
    postId,
    parentCommentId: req.body.parentCommentId
  });

  try {
    const { content, gifUrl, parentCommentId } = req.body;

    // Either content or gifUrl must be provided
    if ((!content || content.trim() === '') && !gifUrl) {
      failMutation(mutationId, new Error('Comment content or GIF is required'));
      return sendError(res, HttpStatus.BAD_REQUEST, 'Comment content or GIF is required');
    }

    // Verify post exists
    const post = await Post.findById(postId);
    if (!post) {
      failMutation(mutationId, new Error('Post not found'));
      return sendError(res, HttpStatus.NOT_FOUND, 'Post not found');
    }

    // If replying to a comment, verify it exists and is a top-level comment
    if (parentCommentId) {
      // SAFETY: Validate parent comment ID
      if (!requireValidId(parentCommentId, 'parent comment ID', res)) {
        failMutation(mutationId, new Error('Invalid parent comment ID'));
        return;
      }

      const parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        failMutation(mutationId, new Error('Parent comment not found'));
        return sendError(res, HttpStatus.NOT_FOUND, 'Parent comment not found');
      }
      // Enforce 1-level nesting: replies cannot have replies
      if (parentComment.parentCommentId !== null) {
        failMutation(mutationId, new Error('Cannot reply to a reply'));
        return sendError(res, HttpStatus.BAD_REQUEST, 'Cannot reply to a reply. Only one level of nesting allowed.');
      }
      // Ensure reply belongs to the same post
      if (parentComment.postId?.toString() !== postId) {
        failMutation(mutationId, new Error('Reply must belong to same post'));
        return sendError(res, HttpStatus.BAD_REQUEST, 'Reply must belong to the same post as the parent comment.');
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
    confirmMutation(mutationId);

    logger.debug('✅ Comment saved to database:', {
      commentId: comment._id,
      postId: comment.postId,
      authorId: comment.authorId
    });

    // Populate author
    await comment.populate('authorId', 'username displayName profilePhoto isVerified pronouns');

    // SAFETY: Optional chaining for io
    req.io?.emit('comment_added', {
      postId,
      comment: comment.toObject()
    });

    logger.debug('📤 Sending comment response to client');

    res.status(201).json(comment);
  } catch (error) {
    failMutation(mutationId, error);
    throw error; // Let asyncHandler catch it
  }
}));

// @route   PUT /api/comments/:commentId
// @desc    Edit a comment
// @access  Private
router.put('/comments/:commentId', auth, requireActiveUser, asyncHandler(async (req, res) => {
  // SAFETY: Guard clause for auth
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { commentId } = req.params;

  // SAFETY: Validate ObjectId
  if (!requireValidId(commentId, 'comment ID', res)) return;

  const { content } = req.body;

  if (!content || content.trim() === '') {
    return sendError(res, HttpStatus.BAD_REQUEST, 'Comment content is required');
  }

  const comment = await Comment.findById(commentId);

  if (!comment) {
    return sendError(res, HttpStatus.NOT_FOUND, 'Comment not found');
  }

  // Check if user is the comment author
  if (comment.authorId?.toString() !== userId) {
    return sendError(res, HttpStatus.FORBIDDEN, 'Not authorized to edit this comment');
  }

  comment.content = content;
  comment.isEdited = true;
  comment.editedAt = new Date();

  await comment.save();
  await comment.populate('authorId', 'username displayName profilePhoto isVerified pronouns');

  // SAFETY: Optional chaining for io
  req.io?.emit('comment_updated', {
    postId: comment.postId,
    comment: comment.toObject()
  });

  res.json(comment);
}));

// @route   DELETE /api/comments/:commentId
// @desc    Delete a comment
// @access  Private
router.delete('/comments/:commentId', auth, requireActiveUser, asyncHandler(async (req, res) => {
  // SAFETY: Guard clause for auth
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { commentId } = req.params;

  // SAFETY: Validate ObjectId
  if (!requireValidId(commentId, 'comment ID', res)) return;

  // Track mutation
  const mutationId = trackMutation(MutationType.DELETE, 'Comment', { commentId });

  try {
    const comment = await Comment.findById(commentId);

    if (!comment) {
      failMutation(mutationId, new Error('Comment not found'));
      return sendError(res, HttpStatus.NOT_FOUND, 'Comment not found');
    }

    // Check if user is the comment author or post author
    const post = await Post.findById(comment.postId);
    const isAuthor = comment.authorId?.toString() === userId;
    const isPostAuthor = post?.author?.toString() === userId;

    if (!isAuthor && !isPostAuthor) {
      failMutation(mutationId, new Error('Not authorized'));
      return sendError(res, HttpStatus.FORBIDDEN, 'Not authorized to delete this comment');
    }

    // Check if comment has replies (only for parent comments)
    let hasReplies = false;
    if (comment.parentCommentId === null) {
      const replyCount = await Comment.countDocuments({
        parentCommentId: commentId,
        isDeleted: false
      });
      hasReplies = replyCount > 0;
    }

    // If comment has replies, soft delete (keep replies intact)
    // If comment is a reply or has no replies, hard delete
    if (hasReplies) {
      // Soft delete: mark as deleted, clear content, keep replies
      comment.isDeleted = true;
      comment.content = ''; // Clear content for privacy
      comment.gifUrl = null; // Clear GIF
      await comment.save();

      logger.info(`Soft deleted comment ${commentId} (has replies)`);
    } else {
      // Hard delete: remove comment completely
      await Comment.findByIdAndDelete(commentId);

      logger.info(`Hard deleted comment ${commentId} (no replies)`);
    }

    confirmMutation(mutationId);

    // SAFETY: Optional chaining for io
    req.io?.emit('comment_deleted', {
      postId: comment.postId,
      commentId,
      hardDelete: !hasReplies
    });

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    failMutation(mutationId, error);
    throw error; // Let asyncHandler catch it
  }
}));

// @route   POST /api/comments/:commentId/react
// @desc    Add a reaction to a comment
// @access  Private
router.post('/comments/:commentId/react', auth, requireActiveUser, reactionLimiter, asyncHandler(async (req, res) => {
  // SAFETY: Guard clause for auth
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { commentId } = req.params;

  // SAFETY: Validate ObjectId
  if (!requireValidId(commentId, 'comment ID', res)) return;

  const { emoji } = req.body;

  if (!emoji) {
    return sendError(res, HttpStatus.BAD_REQUEST, 'Emoji is required');
  }

  const comment = await Comment.findById(commentId);

  if (!comment) {
    return sendError(res, HttpStatus.NOT_FOUND, 'Comment not found');
  }

  // Initialize reactions Map if it doesn't exist
  if (!comment.reactions) {
    comment.reactions = new Map();
  }

  // Convert to plain object for easier manipulation
  const reactions = comment.reactions?.toObject ? comment.reactions.toObject() : (comment.reactions || {});

  // Remove user from all emoji arrays (user can only have one reaction)
  Object.keys(reactions).forEach(key => {
    if (Array.isArray(reactions[key])) {
      reactions[key] = reactions[key].filter(id => id !== userId);
    }
  });

  // Check if user is toggling off the same emoji
  const hadThisReaction = comment.reactions?.get?.(emoji)?.includes(userId);

  if (!hadThisReaction) {
    // Add user to the selected emoji array
    if (!reactions[emoji]) {
      reactions[emoji] = [];
    }
    reactions[emoji].push(userId);
  }

  // Clean up empty arrays
  Object.keys(reactions).forEach(key => {
    if (Array.isArray(reactions[key]) && reactions[key].length === 0) {
      delete reactions[key];
    }
  });

  comment.reactions = reactions;
  await comment.save();
  await comment.populate('authorId', 'username displayName profilePhoto isVerified pronouns');

  // SAFETY: Optional chaining for io
  req.io?.emit('comment_reaction_added', {
    postId: comment.postId,
    commentId,
    comment: comment.toObject()
  });

  res.json(comment);
}));

export default router;

