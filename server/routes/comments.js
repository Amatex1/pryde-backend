/**
 * Comment Routes
 * PHASE 2 SAFETY: All routes use guard clauses and optional chaining
 */

import express from 'express';
import mongoose from 'mongoose';
import Comment from '../models/Comment.js';
import Post from '../models/Post.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import auth from '../middleware/auth.js';
import requireActiveUser from '../middleware/requireActiveUser.js';
import requireEmailVerification from '../middleware/requireEmailVerification.js';
import { reactionLimiter, commentWriteLimiter } from '../middleware/rateLimiter.js';
import logger from '../utils/logger.js';
import {
  trackMutation,
  confirmMutation,
  failMutation,
  MutationType
} from '../utils/mutationTracker.js';
import { asyncHandler, requireAuth, requireValidId, requireParams, sendError, HttpStatus } from '../utils/errorHandler.js';
import { notifyMentionsInComment } from '../services/mentionNotificationService.js';
import { emitNotificationCreated } from '../utils/notificationEmitter.js';
import { sendPushNotification } from './pushNotifications.js';

const router = express.Router();

// ── Anonymous comment sanitization ──────────────────────────────────────
const STAFF_ROLES = ['moderator', 'admin', 'super_admin'];

function sanitizeAnonymousComment(commentObj, viewerRole) {
  if (!commentObj?.isAnonymous) return commentObj;
  if (STAFF_ROLES.includes(viewerRole)) {
    commentObj._staffAnonymousView = true;
    return commentObj;
  }
  // Regular user: hide real author info
  commentObj.authorId = {
    _id: null,
    username: 'anonymous',
    displayName: commentObj.anonymousDisplayName || 'Anonymous Member',
    profilePhoto: '',
    isVerified: false,
    pronouns: null,
    badges: []
  };
  return commentObj;
}

function sanitizeAnonymousComments(comments, viewerRole) {
  return comments.map(c => sanitizeAnonymousComment({ ...c }, viewerRole));
}

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

  // PERFORMANCE: Use aggregation to get comments with reply counts in ONE query
  // This replaces N+1 queries (1 query + N countDocuments) with a single aggregation
  const commentsWithReplyCounts = await Comment.aggregate([
    // Match top-level comments for this post
    {
      $match: {
        postId: new mongoose.Types.ObjectId(postId),
        parentCommentId: null,
        isDeleted: false
      }
    },
    // Sort by pinned first, then oldest first
    { $sort: { isPinned: -1, createdAt: 1 } },
    // Lookup reply counts in a single operation
    {
      $lookup: {
        from: 'comments',
        let: { commentId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$parentCommentId', '$$commentId'] },
              isDeleted: false
            }
          },
          { $count: 'count' }
        ],
        as: 'replyData'
      }
    },
    // Add replyCount field
    {
      $addFields: {
        replyCount: {
          $ifNull: [{ $arrayElemAt: ['$replyData.count', 0] }, 0]
        }
      }
    },
    // Remove the temporary replyData array
    { $project: { replyData: 0 } },
    // Lookup author details
    {
      $lookup: {
        from: 'users',
        localField: 'authorId',
        foreignField: '_id',
        pipeline: [
          { $project: { username: 1, displayName: 1, profilePhoto: 1, isVerified: 1, pronouns: 1 } }
        ],
        as: 'authorId'
      }
    },
    // Unwind author (convert array to object)
    { $unwind: { path: '$authorId', preserveNullAndEmptyArrays: true } }
  ]);

  logger.debug(`✅ Found ${commentsWithReplyCounts.length} comments for post ${postId}`);

  // Sanitize anonymous comments for non-staff viewers
  const viewerRole = req.user?.role;
  const sanitized = sanitizeAnonymousComments(commentsWithReplyCounts, viewerRole);
  res.json(sanitized);
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

  // Sanitize anonymous replies for non-staff viewers
  const viewerRole = req.user?.role;
  const sanitizedReplies = sanitizeAnonymousComments(replies, viewerRole);
  res.json(sanitizedReplies);
}));

// @route   POST /api/posts/:postId/comments
// @desc    Add a comment to a post (or reply to a comment)
// @access  Private
router.post('/posts/:postId/comments', auth, requireActiveUser, requireEmailVerification, commentWriteLimiter, asyncHandler(async (req, res) => {
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
    const { content, gifUrl, parentCommentId, isAnonymous } = req.body;

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

    // Phase 6A: Check if post is locked (replies disabled)
    if (post.isLocked) {
      failMutation(mutationId, new Error('Post is locked'));
      return sendError(res, HttpStatus.FORBIDDEN, 'This post is locked and cannot receive new comments');
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

    // ── Anonymous comment handling ──────────────────────────────────────
    let commentIsAnonymous = false;
    let anonymousDisplayName = null;
    let authorHiddenFromPublic = false;

    if (isAnonymous === true) {
      const ANONYMOUS_POSTING_ENABLED = process.env.ANONYMOUS_POSTING_ENABLED !== 'false';
      if (!ANONYMOUS_POSTING_ENABLED) {
        failMutation(mutationId, new Error('Anonymous posting is disabled'));
        return sendError(res, HttpStatus.FORBIDDEN, 'Anonymous posting is currently disabled');
      }

      const user = await User.findById(userId).select('privacy role');
      if (user?.role === 'banned') {
        failMutation(mutationId, new Error('Banned users cannot post anonymously'));
        return sendError(res, HttpStatus.FORBIDDEN, 'You cannot post anonymously');
      }
      if (!user?.privacy?.allowAnonymousPosts) {
        failMutation(mutationId, new Error('Anonymous posting not enabled in user settings'));
        return sendError(res, HttpStatus.FORBIDDEN, 'Enable anonymous posting in your Safety & Privacy settings first');
      }

      commentIsAnonymous = true;
      anonymousDisplayName = 'Anonymous Member';
      authorHiddenFromPublic = true;

      logger.info('🕵️ Anonymous comment created', {
        postId,
        authorId: userId,
        parentCommentId: parentCommentId || null,
        isAnonymous: true
      });
    }

    // Create comment
    const comment = new Comment({
      postId,
      authorId: userId,
      content: content || '',
      gifUrl: gifUrl || null,
      parentCommentId: parentCommentId || null,
      isAnonymous: commentIsAnonymous,
      anonymousDisplayName,
      authorHiddenFromPublic
    });

    logger.debug('💬 Creating comment:', {
      postId,
      authorId: userId,
      content: content?.substring(0, 50),
      parentCommentId,
      isAnonymous: commentIsAnonymous
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

    // 🔔 Create notification for post author or parent comment author
    try {
      if (parentCommentId) {
        // This is a reply to a comment
        const parentComment = await Comment.findById(parentCommentId).select('authorId');

        // Notify parent comment author (don't notify yourself)
        if (parentComment && parentComment.authorId.toString() !== userId.toString()) {
          const notification = new Notification({
            recipient: parentComment.authorId,
            sender: userId,
            type: 'comment',
            message: 'replied to your comment',
            postId,
            commentId: comment._id
          });
          await notification.save();
          await notification.populate('sender', 'username displayName profilePhoto');

          // ✅ Emit real-time notification
          emitNotificationCreated(req.io, parentComment.authorId.toString(), notification);

          // Send push notification
          const replier = await User.findById(userId).select('username displayName');
          const replierName = replier.displayName || replier.username;

          sendPushNotification(parentComment.authorId, {
            title: `💬 New Reply`,
            body: `${replierName} replied to your comment`,
            data: {
              type: 'reply',
              postId: postId.toString(),
              commentId: comment._id.toString(),
              url: `/post/${postId}?comment=${comment._id}`
            },
            tag: `reply-${comment._id}`
          }).catch(err => logger.error('Push notification error:', err));
        }
      } else {
        // This is a comment on a post
        const post = await Post.findById(postId).select('author');

        // Notify post author (don't notify yourself)
        if (post && post.author.toString() !== userId.toString()) {
          const notification = new Notification({
            recipient: post.author,
            sender: userId,
            type: 'comment',
            message: 'commented on your post',
            postId,
            commentId: comment._id
          });
          await notification.save();
          await notification.populate('sender', 'username displayName profilePhoto');

          // ✅ Emit real-time notification
          emitNotificationCreated(req.io, post.author.toString(), notification);

          // Send push notification
          const commenter = await User.findById(userId).select('username displayName');
          const commenterName = commenter.displayName || commenter.username;

          sendPushNotification(post.author, {
            title: `💬 New Comment`,
            body: `${commenterName} commented on your post`,
            data: {
              type: 'comment',
              postId: postId.toString(),
              commentId: comment._id.toString(),
              url: `/post/${postId}?comment=${comment._id}`
            },
            tag: `comment-${postId}`
          }).catch(err => logger.error('Push notification error:', err));
        }
      }
    } catch (notificationError) {
      // Don't fail the request if notification creation fails
      logger.error('Failed to create comment notification:', notificationError);
    }

    // Process @mention notifications (fire-and-forget, don't block response)
    if (content) {
      const author = await User.findById(userId).select('username displayName').lean();
      const surface = parentCommentId ? 'reply' : 'comment';
      notifyMentionsInComment({
        content,
        authorId: userId,
        author,
        commentId: comment._id.toString(),
        postId,
        surface
      }).catch(err => logger.error('[Mention] Notification error', { error: err.message }));
    }

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

