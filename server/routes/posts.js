/**
 * Posts Routes
 * PHASE 2 SAFETY: All routes use guard clauses and optional chaining
 */

import express from 'express';
const router = express.Router();
import mongoose from 'mongoose';
import Post from '../models/Post.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import auth from '../middleware/auth.js';
import requireActiveUser from '../middleware/requireActiveUser.js';
import requireEmailVerification from '../middleware/requireEmailVerification.js';
import { cacheShort, cacheMedium } from '../middleware/caching.js';
import { postLimiter, commentLimiter, reactionLimiter } from '../middleware/rateLimiter.js';
import { checkMuted, moderateContent, checkProbation } from '../middleware/moderation.js';
import { guardComment, guardReply, guardReact } from '../middleware/systemAccountGuard.js';
import { sanitizeFields } from '../utils/sanitize.js';
import { sendPushNotification } from './pushNotifications.js';
import logger from '../utils/logger.js';
import { getBlockedUserIds } from '../utils/blockHelper.js';
import { emitNotificationCreated } from '../utils/notificationEmitter.js'; // ✅ Socket.IO notifications
import { deleteFromGridFS } from './upload.js'; // For deleting images from storage
import { MutationTrace, verifyWrite } from '../utils/mutationTrace.js';
import { isFeatureEnabled } from '../utils/featureFlags.js';
import { asyncHandler, requireAuth, requireValidId, sendError, HttpStatus } from '../utils/errorHandler.js';
import { processUserBadgesById } from '../services/autoBadgeService.js';
import { populatePostBadges, populateSinglePostBadges } from '../utils/populateBadges.js';

// CALM ONBOARDING: Helper to update lastActivityDate for quiet return detection
// Updates user's lastActivityDate when they post, react, or comment
const updateLastActivityDate = async (userId) => {
  try {
    await User.findByIdAndUpdate(userId, { lastActivityDate: new Date() });
  } catch (err) {
    // Non-blocking - don't fail the main operation if this fails
    logger.warn('Failed to update lastActivityDate:', err.message);
  }
};

// PHASE 1 REFACTOR: Helper function to sanitize post for private likes
// Removes like count and list of who liked, only shows if current user liked
const sanitizePostForPrivateLikes = (post, currentUserId) => {
  // CRITICAL: Convert Mongoose document to plain object to remove .on() and other methods
  const postObj = post.toObject ? post.toObject() : { ...post };

  // Check if current user liked this post
  const hasLiked = postObj.likes?.some(like =>
    (like._id || like).toString() === currentUserId.toString()
  );

  // Replace likes array with just a boolean
  postObj.hasLiked = hasLiked;
  delete postObj.likes;

  // Do the same for reactions - keep them but remove counts from UI later
  // For now, keep reactions as they show different emotions, not just counts

  // Poll results visibility: hide vote counts from non-authors when resultsVisibility is 'author'
  if (postObj.poll && postObj.poll.resultsVisibility === 'author') {
    const authorId = postObj.author?._id || postObj.author;
    const isAuthor = authorId && authorId.toString() === currentUserId.toString();

    if (!isAuthor) {
      // For non-authors, only show if they voted and what they voted for
      // Hide all vote counts by replacing votes arrays with boolean flags
      postObj.poll.options = postObj.poll.options.map(option => {
        const userVoted = option.votes?.some(vote =>
          (vote._id || vote).toString() === currentUserId.toString()
        );
        return {
          text: option.text,
          votes: userVoted ? [currentUserId] : [], // Only show user's own vote
          _hiddenResults: true // Flag for frontend to know results are hidden
        };
      });
      postObj.poll._resultsHidden = true;
    }
  }

  // REMOVED 2025-12-26: originalPost handling deleted (Phase 5 - share system removed)

  return postObj;
};

// @route   GET /api/posts
// @desc    Get all posts (feed)
// @access  Private
router.get('/', auth, requireActiveUser, asyncHandler(async (req, res) => {
  // SAFETY: Guard clause for auth
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { page = 1, limit = 20, filter = 'followers' } = req.query;

  // SAFETY: Validate pagination params
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

  const currentUser = await User.findById(userId);
  if (!currentUser) {
    return sendError(res, HttpStatus.NOT_FOUND, 'User not found');
  }
  const followingIds = currentUser.following || [];

  // Get blocked user IDs to filter them out
  const blockedUserIds = await getBlockedUserIds(userId);

  // Phase 2: All queries exclude group posts (groupId !== null)
  // Group posts are intentionally isolated from global feeds
  let query = {};

  if (filter === 'public') {
    // Public feed: All public posts from everyone (excluding blocked users and group posts)
    query = {
      visibility: 'public',
      author: { $nin: blockedUserIds },
      groupId: null // Phase 2: Exclude group posts
    };
  } else if (filter === 'followers') {
    // Followers feed: Posts from people you follow + your own posts (excluding blocked users and group posts)
    query = {
      groupId: null, // Phase 2: Exclude group posts
      $or: [
        { author: userId }, // User's own posts (always visible)
        {
          author: { $in: followingIds, $nin: blockedUserIds },
          visibility: 'public'
        },
        {
          author: { $in: followingIds, $nin: blockedUserIds },
          visibility: 'followers'
        }
      ]
    };
  } else {
    // Default: Followers feed (same as 'followers' filter)
    query = {
      groupId: null, // Phase 2: Exclude group posts
      $or: [
        { author: userId },
        {
          author: { $in: followingIds },
          visibility: 'public'
        },
        {
          author: { $in: followingIds },
          visibility: 'followers'
        }
      ]
    };
  }

  const posts = await Post.find(query)
    .populate('author', 'username displayName profilePhoto isVerified pronouns badges')
    .populate('comments.user', 'username displayName profilePhoto isVerified pronouns badges')
    .populate('reactions.user', 'username displayName profilePhoto')
    .populate('comments.reactions.user', 'username displayName profilePhoto')
    .populate('commentCount')
    .sort({ createdAt: -1 })
    .limit(limitNum)
    .skip((pageNum - 1) * limitNum);

  const count = await Post.countDocuments(query);

  // Populate badges for all posts
  await populatePostBadges(posts);

  // Sanitize posts to hide like counts
  const sanitizedPosts = posts.map(post => sanitizePostForPrivateLikes(post, userId));

  res.json({
    posts: sanitizedPosts,
    totalPages: Math.ceil(count / limitNum),
    currentPage: pageNum
  });
}));

// @route   GET /api/posts/user/:identifier
// @desc    Get posts by user (by ID or username)
// @access  Private
router.get('/user/:identifier', auth, requireActiveUser, asyncHandler(async (req, res) => {
  // SAFETY: Guard clause for auth
  const currentUserId = requireAuth(req, res);
  if (!currentUserId) return;

  const { identifier } = req.params;
  let profileUserId;

  // Check if identifier is a valid MongoDB ObjectId
  if (mongoose.Types.ObjectId.isValid(identifier) && identifier.length === 24) {
    profileUserId = identifier;
  } else {
    // Try to find user by username
    const profileUser = await User.findOne({ username: identifier });
    if (!profileUser) {
      return sendError(res, HttpStatus.NOT_FOUND, 'User not found');
    }
    profileUserId = profileUser._id;
  }

  // Get current user to check following relationship
  const currentUser = await User.findById(currentUserId);
  if (!currentUser) {
    return sendError(res, HttpStatus.NOT_FOUND, 'Current user not found');
  }

  // SAFETY: Optional chaining for following array
  const isFollowing = currentUser.following?.some(followId => followId?.toString() === profileUserId?.toString()) ?? false;
  const isOwnProfile = currentUserId === profileUserId?.toString();

  // Build query based on relationship
  // Phase 2: Exclude group posts (groupId !== null) from profile view
  // Group posts are intentionally isolated from global feeds
  let query = {
    author: profileUserId,
    groupId: null // Phase 2: Exclude group posts
  };

  if (!isOwnProfile) {
    // Not viewing own profile - apply privacy filters
    // Build $or conditions explicitly to avoid fragile { _id: null } hack
    const visibilityConditions = [{ visibility: 'public' }];
    if (isFollowing) {
      visibilityConditions.push({ visibility: 'followers' });
    }
    query = {
      author: profileUserId,
      groupId: null, // Phase 2: Exclude group posts
      $or: visibilityConditions
    };
  }

  const posts = await Post.find(query)
    .populate('author', 'username displayName profilePhoto isVerified pronouns badges')
    .populate('comments.user', 'username displayName profilePhoto isVerified pronouns badges')
    .populate('reactions.user', 'username displayName profilePhoto')
    .populate('comments.reactions.user', 'username displayName profilePhoto')
    .populate('commentCount')
    .sort({ createdAt: -1 });

  // Populate badges for all posts
  await populatePostBadges(posts);

  // Sanitize posts to hide like counts
  const sanitizedPosts = posts.map(post => sanitizePostForPrivateLikes(post, currentUserId));

  res.json(sanitizedPosts);
}));

// @route   GET /api/posts/:id
// @desc    Get single post
// @access  Private
router.get('/:id', auth, requireActiveUser, cacheShort, asyncHandler(async (req, res) => {
  // SAFETY: Guard clause for auth
  const userId = requireAuth(req, res);
  if (!userId) return;

  const postId = req.params.id;

  // SAFETY: Validate ObjectId
  if (!requireValidId(postId, 'post ID', res)) return;

  const post = await Post.findById(postId)
    .populate('author', 'username displayName profilePhoto isVerified pronouns badges')
    .populate('comments.user', 'username displayName profilePhoto isVerified pronouns badges')
    .populate('reactions.user', 'username displayName profilePhoto')
    .populate('comments.reactions.user', 'username displayName profilePhoto');

  if (!post) {
    return sendError(res, HttpStatus.NOT_FOUND, 'Post not found');
  }

  // Populate badges for the post
  await populateSinglePostBadges(post);

  // Sanitize post to hide like counts
  const sanitizedPost = sanitizePostForPrivateLikes(post, userId);

  res.json(sanitizedPost);
}));

// @route   POST /api/posts
// @desc    Create a new post
// @access  Private (requires email verification)
router.post('/', auth, requireActiveUser, requireEmailVerification, postLimiter, sanitizeFields(['content', 'contentWarning']), checkMuted, checkProbation, moderateContent, async (req, res) => {
  // Initialize mutation trace for end-to-end tracking
  const mutationId = req.headers['x-mutation-id'] || req.body?._mutationId;
  const userId = req.userId || req.user._id;
  const mutation = new MutationTrace(mutationId, 'CREATE', 'post', userId);
  mutation.addStep('REQUEST_RECEIVED', { method: 'POST', path: '/api/posts' });
  res.setHeader('X-Mutation-Id', mutation.mutationId);

  try {
    // ── EMERGENCY CONTAINMENT CHECK ──────────────────────────────────────────
    if (isFeatureEnabled('EMERGENCY_CONTAINMENT')) {
      const user = await User.findById(userId).select('createdAt');
      if (user) {
        const accountAgeMs = Date.now() - new Date(user.createdAt).getTime();
        const twentyFourHoursMs = 24 * 60 * 60 * 1000;
        if (accountAgeMs < twentyFourHoursMs) {
          return res.status(403).json({
            message: 'New accounts cannot post during emergency containment. Please try again later.',
            code: 'EMERGENCY_CONTAINMENT'
          });
        }
      }
    }
    // ── END EMERGENCY CONTAINMENT CHECK ─────────────────────────────────────

    // REMOVED 2025-12-26: hiddenFrom, sharedWith, tags, tagOnly deleted (Phase 5)
    const { content, images, media, visibility, contentWarning, hideMetrics, poll, gifUrl } = req.body;

    // Require either content, media, poll, or GIF
    if ((!content || content.trim() === '') && (!media || media.length === 0) && !poll && !gifUrl) {
      mutation.fail('Validation failed: missing content/media/poll/gif', 400);
      return res.status(400).json({ message: 'Post must have content, media, GIF, or a poll', _mutationId: mutation.mutationId });
    }

    mutation.addStep('VALIDATION_PASSED');

    // REMOVED 2025-12-26: Tag handling deleted (Phase 5)

    // If poll is present, transform options and use post content as poll question
    let pollData = null;
    if (poll) {
      // Transform poll options from array of strings to array of objects
      const transformedOptions = poll.options
        ? poll.options
            .filter(opt => typeof opt === 'string' ? opt.trim() !== '' : opt.text && opt.text.trim() !== '')
            .map(opt => {
              // If option is already an object with text property, use it
              if (typeof opt === 'object' && opt.text) {
                return { text: opt.text, votes: opt.votes || [] };
              }
              // If option is a string, convert to object
              return { text: opt, votes: [] };
            })
        : [];

      pollData = {
        question: content ? content.trim() : '',
        options: transformedOptions,
        endsAt: poll.endsAt || null,
        allowMultipleVotes: poll.allowMultipleVotes || false,
        showResultsBeforeVoting: poll.showResultsBeforeVoting || false,
        resultsVisibility: poll.resultsVisibility || 'public'
      };
      mutation.addStep('POLL_PREPARED', { optionCount: transformedOptions.length });
    }

    const postData = {
      author: userId,
      content: content || '',
      images: images || [],
      media: media || [],
      gifUrl: gifUrl || null, // Include GIF URL if provided
      visibility: visibility || 'followers',
      // REMOVED 2025-12-26: hiddenFrom, sharedWith, tags, tagOnly deleted (Phase 5)
      contentWarning: contentWarning || '',
      hideMetrics: hideMetrics || false
    };

    // Only add poll field if there's actual poll data (avoids validation error for null poll)
    if (pollData) {
      postData.poll = pollData;
    }

    const post = new Post(postData);

    mutation.addStep('DOCUMENT_CREATED', { postId: post._id.toString() });

    await post.save();
    mutation.addStep('DOCUMENT_SAVED');

    // CRITICAL: Verify write succeeded - never assume MongoDB write worked silently
    await verifyWrite(Post, post._id, mutation, { author: userId });

    await post.populate('author', 'username displayName profilePhoto isVerified pronouns badges');
    // REMOVED 2025-12-28: tags populate deleted (Phase 5 - tags removed from Post schema)

    // ⚡ PHASE 2C FIX: Populate badges before socket emit (badges are stored as IDs, need full objects)
    await populateSinglePostBadges(post);

    // ✅ Emit real-time event for new post
    if (req.io) {
      const sanitizedPost = sanitizePostForPrivateLikes(post, userId);
      req.io.emit('post_created', {
        post: sanitizedPost,
        _mutationId: mutation.mutationId
      });
      mutation.addStep('SOCKET_EMITTED', { event: 'post_created' });
    }

    mutation.success({ postId: post._id.toString() });

    // BADGE SYSTEM: Process automatic badges after post creation (non-blocking)
    // This checks for active_this_month badge
    setImmediate(async () => {
      try {
        await processUserBadgesById(userId.toString());
      } catch (err) {
        logger.warn('Failed to process badges on post creation:', err.message);
      }
    });

    // CALM ONBOARDING: Track activity for quiet return detection (non-blocking)
    setImmediate(() => updateLastActivityDate(userId));

    // @EVERYONE BROADCAST: If a super_admin used @everyone, notify all active users (fire-and-forget)
    if (content && /@everyone\b/i.test(content)) {
      setImmediate(async () => {
        try {
          const author = await User.findById(userId).select('username displayName role').lean();
          if (!author || author.role !== 'super_admin') return;

          const recipients = await User.find({
            isActive: true,
            isBanned: { $ne: true },
            _id: { $ne: userId }
          }).select('_id').lean();

          if (recipients.length === 0) return;

          const now = new Date();
          const notifDocs = recipients.map(r => ({
            recipient: r._id,
            sender: userId,
            type: 'announcement',
            message: `${author.displayName || author.username} (@everyone) posted an important announcement`,
            link: `/feed?post=${post._id}`,
            postId: post._id,
            read: false,
            batchCount: 1,
            createdAt: now,
            updatedAt: now
          }));

          const CHUNK = 500;
          const saved = [];
          for (let i = 0; i < notifDocs.length; i += CHUNK) {
            const chunk = await Notification.insertMany(notifDocs.slice(i, i + CHUNK), { ordered: false });
            chunk.forEach(n => saved.push(n));
          }

          if (req.io) {
            const senderInfo = {
              _id: author._id || userId,
              username: author.username,
              displayName: author.displayName
            };
            for (const notif of saved) {
              req.io.to(`user_${notif.recipient.toString()}`).emit('notification:new', {
                notification: {
                  _id: notif._id,
                  recipient: notif.recipient,
                  sender: senderInfo,
                  type: 'announcement',
                  message: notif.message,
                  read: false,
                  link: notif.link,
                  postId: post._id,
                  createdAt: notif.createdAt
                }
              });
            }
          }

          logger.info(`[Post @everyone] Broadcast sent to ${saved.length} users by ${author.username}`);

          // Send push notifications to all recipients (chunked, fire-and-forget)
          const pushPayload = {
            title: 'Announcement',
            body: `${author.displayName || author.username}: ${(content || '').substring(0, 80)}`,
            data: { type: 'announcement', url: `/feed?post=${post._id}` }
          };
          const PUSH_CHUNK = 50;
          for (let i = 0; i < recipients.length; i += PUSH_CHUNK) {
            const chunk = recipients.slice(i, i + PUSH_CHUNK);
            await Promise.all(chunk.map(r => sendPushNotification(r._id, pushPayload).catch(() => {})));
          }
        } catch (err) {
          logger.error('[Post @everyone] Broadcast failed:', err.message);
        }
      });
    }

    res.status(201).json({ ...post.toObject(), _mutationId: mutation.mutationId });
  } catch (error) {
    // Return 400 for Mongoose validation errors instead of 500
    const isValidationError = error.name === 'ValidationError';
    const statusCode = isValidationError ? 400 : 500;
    mutation.fail(error.message, statusCode);
    logger.error('Create post error:', error);
    res.status(statusCode).json({ message: isValidationError ? 'Validation error' : 'Server error', error: error.message, _mutationId: mutation.mutationId });
  }
});

// @route   PUT /api/posts/:id
// @desc    Update a post
// @access  Private
router.put('/:id', auth, requireActiveUser, sanitizeFields(['content', 'contentWarning']), async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const userId = req.userId || req.user._id;

    // Get user to check role
    const user = await User.findById(userId);
    const isAdmin = user && ['moderator', 'admin', 'super_admin'].includes(user.role);

    // Check if user is the author OR admin
    if (post.author.toString() !== userId.toString() && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to edit this post' });
    }

    const { content, images, media, visibility, hiddenFrom, sharedWith, deletedImages, deletedMedia } = req.body;

    // DEPRECATED 2025-12-26: Edit history tracking removed (UI no longer exposed)
    // Posts will still be marked as edited, but history is not tracked

    // Handle deleted images - remove from storage and post.images array
    if (deletedImages && Array.isArray(deletedImages) && deletedImages.length > 0) {
      logger.info(`🗑️ Processing ${deletedImages.length} deleted images for post ${post._id}`);

      for (const imageUrl of deletedImages) {
        // Safety check: only delete if image belongs to this post
        if (post.images && post.images.includes(imageUrl)) {
          try {
            await deleteFromGridFS(imageUrl);
            // Remove from post.images array
            post.images = post.images.filter(img => img !== imageUrl);
            logger.info(`✅ Deleted image: ${imageUrl}`);
          } catch (deleteError) {
            logger.error(`❌ Failed to delete image: ${imageUrl}`, deleteError);
            // Continue with other deletions even if one fails
          }
        } else {
          logger.warn(`⚠️ Attempted to delete image not owned by post: ${imageUrl}`);
        }
      }
    }

    // Handle deleted media - remove from storage and post.media array
    if (deletedMedia && Array.isArray(deletedMedia) && deletedMedia.length > 0) {
      logger.info(`🗑️ Processing ${deletedMedia.length} deleted media for post ${post._id}`);

      for (const mediaUrl of deletedMedia) {
        // Safety check: only delete if media belongs to this post
        const existingMedia = post.media && post.media.find(m => m.url === mediaUrl);
        if (existingMedia) {
          try {
            // Delete main file
            await deleteFromGridFS(mediaUrl);

            // Delete responsive sizes if they exist
            if (existingMedia.sizes) {
              if (existingMedia.sizes.thumbnail) await deleteFromGridFS(existingMedia.sizes.thumbnail);
              if (existingMedia.sizes.small) await deleteFromGridFS(existingMedia.sizes.small);
              if (existingMedia.sizes.medium) await deleteFromGridFS(existingMedia.sizes.medium);
            }

            // Remove from post.media array
            post.media = post.media.filter(m => m.url !== mediaUrl);
            logger.info(`✅ Deleted media: ${mediaUrl}`);
          } catch (deleteError) {
            logger.error(`❌ Failed to delete media: ${mediaUrl}`, deleteError);
          }
        } else {
          logger.warn(`⚠️ Attempted to delete media not owned by post: ${mediaUrl}`);
        }
      }
    }

    if (content !== undefined) post.content = content;
    // Only update images/media if explicitly provided (after deletions processed above)
    if (images !== undefined) post.images = images;
    if (media !== undefined) post.media = media;
    if (visibility) post.visibility = visibility;
    if (hiddenFrom !== undefined) post.hiddenFrom = hiddenFrom;
    if (sharedWith !== undefined) post.sharedWith = sharedWith;

    await post.save();

    // PHASE 1 REFACTOR: Don't populate likes (keep private)
    await post.populate('author', 'username displayName profilePhoto isVerified pronouns badges');
    // await post.populate('likes', 'username displayName profilePhoto'); // REMOVED - private likes
    await post.populate('comments.user', 'username displayName profilePhoto isVerified pronouns badges');
    // REMOVED 2025-12-26: originalPost population deleted (Phase 5)

    // ⚡ PHASE 2C FIX: Populate badges before socket emit
    await populateSinglePostBadges(post);

    // PHASE 1 REFACTOR: Sanitize post to hide like counts
    const sanitizedPost = sanitizePostForPrivateLikes(post, userId);

    // ✅ Emit real-time event for post update
    if (req.io) {
      req.io.emit('post_updated', {
        postId: post._id,
        post: sanitizedPost
      });
      logger.debug('📡 Emitted post_updated event:', post._id);
    }

    res.json(sanitizedPost);
  } catch (error) {
    logger.error('Update post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/posts/:id
// @desc    Delete a post
// @access  Private
router.delete('/:id', auth, requireActiveUser, async (req, res) => {
  // Initialize mutation trace for end-to-end tracking
  const mutationId = req.headers['x-mutation-id'] || req.body?._mutationId;
  const userId = req.userId || req.user._id;
  const mutation = new MutationTrace(mutationId, 'DELETE', 'post', userId);
  mutation.addStep('REQUEST_RECEIVED', { method: 'DELETE', postId: req.params.id });
  res.setHeader('X-Mutation-Id', mutation.mutationId);

  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      mutation.fail('Post not found', 404);
      return res.status(404).json({ message: 'Post not found', _mutationId: mutation.mutationId });
    }

    mutation.addStep('DOCUMENT_FOUND', { authorId: post.author.toString() });

    // Get user to check role
    const user = await User.findById(userId);
    const isAdmin = user && ['moderator', 'admin', 'super_admin'].includes(user.role);

    // Check if user is the author OR admin
    if (post.author.toString() !== userId.toString() && !isAdmin) {
      mutation.fail('Not authorized', 403);
      return res.status(403).json({ message: 'Not authorized to delete this post', _mutationId: mutation.mutationId });
    }

    mutation.addStep('AUTHORIZATION_PASSED', { isAdmin });

    const postId = post._id; // Store ID before deletion
    const postTags = post.tags; // Store tags before deletion

    // Decrement post count for all associated tags
    if (postTags && postTags.length > 0) {
      const Tag = (await import('../models/Tag.js')).default;
      await Promise.all(postTags.map(async (tagId) => {
        const tag = await Tag.findById(tagId);
        if (tag && tag.postCount > 0) {
          tag.postCount -= 1;
          await tag.save();
        }
      }));
      mutation.addStep('TAGS_UPDATED', { tagCount: postTags.length });
    }

    await post.deleteOne();
    mutation.addStep('DOCUMENT_DELETED');

    // CRITICAL: Verify delete succeeded - document should NOT exist
    const verifyDeleted = await Post.findById(postId).lean();
    if (verifyDeleted) {
      mutation.addStep('VERIFY_DELETE_FAILED', { reason: 'Document still exists after deleteOne' });
      throw new Error(`Delete verification failed: Post ${postId} still exists after delete`);
    }
    mutation.addStep('VERIFY_DELETE_SUCCESS');

    // ✅ Emit real-time event for post deletion
    if (req.io) {
      req.io.emit('post_deleted', {
        postId: postId,
        _mutationId: mutation.mutationId
      });
      mutation.addStep('SOCKET_EMITTED', { event: 'post_deleted' });
    }

    mutation.success({ postId: postId.toString() });
    res.json({ message: 'Post deleted successfully', _mutationId: mutation.mutationId });
  } catch (error) {
    mutation.fail(error.message, 500);
    logger.error('Delete post error:', error);
    res.status(500).json({ message: 'Server error', _mutationId: mutation.mutationId });
  }
});

// @route   POST /api/posts/:id/like
// @desc    Like/Unlike a post
// @access  Private (System accounts with PROMPTS/ANNOUNCEMENTS roles cannot react)
router.post('/:id/like', auth, requireActiveUser, reactionLimiter, guardReact, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const userId = req.userId || req.user._id;
    const likeIndex = post.likes.indexOf(userId);

    if (likeIndex > -1) {
      // Unlike the post
      post.likes.splice(likeIndex, 1);
    } else {
      // Like the post
      post.likes.push(userId);

      // Create notification for post author (don't notify yourself)
      if (post.author.toString() !== userId.toString()) {
        const notification = new Notification({
          recipient: post.author,
          sender: userId,
          type: 'like',
          message: 'liked your post',
          postId: post._id
        });
        await notification.save();

        // Populate sender for Socket.IO emission
        await notification.populate('sender', 'username displayName profilePhoto');

        // ✅ Emit real-time notification
        emitNotificationCreated(req.io, post.author.toString(), notification);

        // Send push notification
        const liker = await User.findById(userId).select('username displayName');
        const likerName = liker.displayName || liker.username;

        sendPushNotification(post.author, {
          title: `❤️ New Like`,
          body: `${likerName} liked your post`,
          data: {
            type: 'like',
            postId: post._id.toString(),
            url: `/feed?post=${post._id}`
          },
          tag: `like-${post._id}`
        }).catch(err => logger.error('Push notification error:', err));
      }
    }

    await post.save();

    // PHASE 1 REFACTOR: Don't populate likes (keep private)
    await post.populate('author', 'username displayName profilePhoto isVerified pronouns badges');
    // await post.populate('likes', 'username displayName profilePhoto'); // REMOVED - private likes
    await post.populate('comments.user', 'username displayName profilePhoto isVerified pronouns badges');
    // REMOVED 2025-12-26: originalPost population deleted (Phase 5)

    // PHASE 1 REFACTOR: Sanitize post to hide like counts
    const sanitizedPost = sanitizePostForPrivateLikes(post, userId);

    res.json(sanitizedPost);
  } catch (error) {
    logger.error('Like post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/react
// @desc    Add a reaction to a post
// @access  Private
router.post('/:id/react', auth, requireActiveUser, reactionLimiter, async (req, res) => {
  try {
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ message: 'Emoji is required' });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const userId = req.userId || req.user._id;

    // Check if user already reacted with this emoji
    const existingReaction = post.reactions.find(
      r => r.user.toString() === userId.toString() && r.emoji === emoji
    );

    if (existingReaction) {
      // Remove the reaction (toggle off)
      post.reactions = post.reactions.filter(
        r => !(r.user.toString() === userId.toString() && r.emoji === emoji)
      );
    } else {
      // Remove any other reaction from this user first (only one reaction per user)
      post.reactions = post.reactions.filter(
        r => r.user.toString() !== userId.toString()
      );

      // Add new reaction
      post.reactions.push({
        user: userId,
        emoji,
        createdAt: new Date()
      });

      // Create notification for post author (don't notify yourself)
      if (post.author.toString() !== userId.toString()) {
        const notification = new Notification({
          recipient: post.author,
          sender: userId,
          type: 'like',
          message: `reacted ${emoji} to your post`,
          postId: post._id
        });
        await notification.save();

        // Populate sender for Socket.IO emission
        await notification.populate('sender', 'username displayName profilePhoto');

        // ✅ Emit real-time notification
        emitNotificationCreated(req.io, post.author.toString(), notification);

        // Send push notification
        const reactor = await User.findById(userId).select('username displayName');
        const reactorName = reactor.displayName || reactor.username;

        sendPushNotification(post.author, {
          title: `${emoji} New Reaction`,
          body: `${reactorName} reacted ${emoji} to your post`,
          data: {
            type: 'reaction',
            postId: post._id.toString(),
            url: `/feed?post=${post._id}`
          },
          tag: `reaction-${post._id}`
        }).catch(err => logger.error('Push notification error:', err));
      }
    }

    await post.save();

    // PHASE 1 REFACTOR: Don't populate likes (keep private)
    await post.populate('author', 'username displayName profilePhoto isVerified pronouns badges');
    // await post.populate('likes', 'username displayName profilePhoto'); // REMOVED - private likes
    await post.populate('reactions.user', 'username displayName profilePhoto');
    await post.populate('comments.user', 'username displayName profilePhoto isVerified pronouns badges');
    // REMOVED 2025-12-26: originalPost population deleted (Phase 5)

    // ⚡ PHASE 2C FIX: Populate badges before socket emit
    await populateSinglePostBadges(post);

    // PHASE 1 REFACTOR: Sanitize post to hide like counts
    const sanitizedPost = sanitizePostForPrivateLikes(post, userId);

    // Emit real-time event for post reaction
    if (req.io) {
      req.io.emit('post_reaction_added', {
        postId: post._id,
        post: sanitizedPost
      });
    }

    // CALM ONBOARDING: Track activity for quiet return detection (non-blocking)
    setImmediate(() => updateLastActivityDate(userId));

    res.json(sanitizedPost);
  } catch (error) {
    logger.error('React to post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/comment/:commentId/react
// @desc    Add a reaction to a comment
// @access  Private
router.post('/:id/comment/:commentId/react', auth, requireActiveUser, reactionLimiter, async (req, res) => {
  try {
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ message: 'Emoji is required' });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = post.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const userId = req.userId || req.user._id;

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

      // Create notification for comment author (don't notify yourself)
      if (comment.user.toString() !== userId.toString()) {
        const notification = new Notification({
          recipient: comment.user,
          sender: userId,
          type: 'like',
          message: `reacted ${emoji} to your comment`,
          postId: post._id,
          commentId: comment._id
        });
        await notification.save();

        // Populate sender for Socket.IO emission
        await notification.populate('sender', 'username displayName profilePhoto');

        // ✅ Emit real-time notification
        emitNotificationCreated(req.io, comment.user.toString(), notification);

        // Send push notification
        const reactor = await User.findById(userId).select('username displayName');
        const reactorName = reactor.displayName || reactor.username;

        sendPushNotification(comment.user, {
          title: `${emoji} New Reaction`,
          body: `${reactorName} reacted ${emoji} to your comment`,
          data: {
            type: 'reaction',
            postId: post._id.toString(),
            commentId: comment._id.toString(),
            url: `/feed?post=${post._id}&comment=${comment._id}`
          },
          tag: `reaction-comment-${comment._id}`
        }).catch(err => logger.error('Push notification error:', err));
      }
    }

    await post.save();

    // PHASE 1 REFACTOR: Don't populate likes (keep private)
    await post.populate('author', 'username displayName profilePhoto isVerified pronouns badges');
    // await post.populate('likes', 'username displayName profilePhoto'); // REMOVED - private likes
    await post.populate('reactions.user', 'username displayName profilePhoto');
    await post.populate('comments.user', 'username displayName profilePhoto isVerified pronouns badges');
    await post.populate('comments.reactions.user', 'username displayName profilePhoto');
    // REMOVED 2025-12-26: originalPost population deleted (Phase 5)

    // ⚡ PHASE 2C FIX: Populate badges before socket emit
    await populateSinglePostBadges(post);

    // PHASE 1 REFACTOR: Sanitize post to hide like counts
    const sanitizedPost = sanitizePostForPrivateLikes(post, userId);

    // Emit real-time event for comment reaction
    if (req.io) {
      req.io.emit('comment_reaction_added', {
        postId: post._id,
        commentId: req.params.commentId,
        post: sanitizedPost
      });
    }

    res.json(sanitizedPost);
  } catch (error) {
    logger.error('React to comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/share
// @desc    DEPRECATED - Share/Repost system removed 2025-12-26 (Phase 5)
// @access  Private
router.post('/:id/share', auth, requireActiveUser, (req, res) => {
  res.status(410).json({
    message: 'Share/Repost feature has been removed.',
    deprecated: true,
    removedDate: '2025-12-26'
  });
});

// @route   DELETE /api/posts/:id/share
// @desc    DEPRECATED - Share/Repost system removed 2025-12-26 (Phase 5)
// @access  Private
router.delete('/:id/share', auth, requireActiveUser, (req, res) => {
  res.status(410).json({
    message: 'Share/Repost feature has been removed.',
    deprecated: true,
    removedDate: '2025-12-26'
  });
});

// @route   POST /api/posts/:id/comment
// @desc    Add a comment to a post
// @access  Private (System accounts with PROMPTS/ANNOUNCEMENTS roles cannot comment, requires email verification)
router.post('/:id/comment', auth, requireActiveUser, requireEmailVerification, commentLimiter, guardComment, sanitizeFields(['content']), checkMuted, checkProbation, moderateContent, async (req, res) => {
  try {
    const { content, gifUrl } = req.body;

    // Either content or gifUrl must be provided
    if ((!content || content.trim() === '') && !gifUrl) {
      return res.status(400).json({ message: 'Comment content or GIF is required' });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const userId = req.userId || req.user._id;

    const comment = {
      user: userId,
      content: content || '',
      gifUrl: gifUrl || null,
      createdAt: new Date()
    };

    post.comments.push(comment);
    const savedPost = await post.save();

    // Get the newly created comment ID
    const newComment = savedPost.comments[savedPost.comments.length - 1];

    // Create notification for post author (don't notify yourself)
    if (post.author.toString() !== userId.toString()) {
      const notification = new Notification({
        recipient: post.author,
        sender: userId,
        type: 'comment',
        message: 'commented on your post',
        postId: post._id,
        commentId: newComment._id
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
          postId: post._id.toString(),
          commentId: newComment._id.toString(),
          url: `/feed?post=${post._id}&comment=${newComment._id}`
        },
        tag: `comment-${post._id}`
      }).catch(err => logger.error('Push notification error:', err));
    }

    // PHASE 1 REFACTOR: Don't populate likes (keep private)
    await post.populate('author', 'username displayName profilePhoto isVerified pronouns badges');
    await post.populate('comments.user', 'username displayName profilePhoto isVerified pronouns badges');
    // await post.populate('likes', 'username displayName profilePhoto'); // REMOVED - private likes
    // REMOVED 2025-12-26: originalPost population deleted (Phase 5)

    // ⚡ PHASE 2C FIX: Populate badges before socket emit
    await populateSinglePostBadges(post);

    // PHASE 1 REFACTOR: Sanitize post to hide like counts
    const sanitizedPost = sanitizePostForPrivateLikes(post, userId);

    // Emit real-time event for new comment
    if (req.io) {
      req.io.emit('comment_added', {
        postId: post._id,
        commentId: newComment._id,
        post: sanitizedPost
      });
    }

    // CALM ONBOARDING: Track activity for quiet return detection (non-blocking)
    setImmediate(() => updateLastActivityDate(userId));

    res.json(sanitizedPost);
  } catch (error) {
    logger.error('Comment post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/comment/:commentId/reply
// @desc    Reply to a comment
// @access  Private (System accounts with PROMPTS/MODERATION/ANNOUNCEMENTS roles cannot reply)
router.post('/:id/comment/:commentId/reply', auth, requireActiveUser, commentLimiter, guardReply, sanitizeFields(['content']), checkMuted, checkProbation, moderateContent, async (req, res) => {
  try {
    const { content, gifUrl } = req.body;

    // Either content or gifUrl must be provided
    if ((!content || content.trim() === '') && !gifUrl) {
      return res.status(400).json({ message: 'Reply content or GIF is required' });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const parentComment = post.comments.id(req.params.commentId);

    if (!parentComment) {
      return res.status(404).json({ message: 'Parent comment not found' });
    }

    const userId = req.userId || req.user._id;

    const reply = {
      user: userId,
      content: content || '',
      gifUrl: gifUrl || null,
      parentComment: req.params.commentId,
      createdAt: new Date()
    };

    post.comments.push(reply);

    // Add reply ID to parent comment's replies array
    const savedPost = await post.save();
    const newReply = savedPost.comments[savedPost.comments.length - 1];
    parentComment.replies.push(newReply._id);

    await post.save();

    // Create notification for parent comment author (don't notify yourself)
    if (parentComment.user.toString() !== userId.toString()) {
      const notification = new Notification({
        recipient: parentComment.user,
        sender: userId,
        type: 'comment',
        message: 'replied to your comment',
        postId: post._id,
        commentId: newReply._id
      });
      await notification.save();
      await notification.populate('sender', 'username displayName profilePhoto');

      // ✅ Emit real-time notification
      emitNotificationCreated(req.io, parentComment.user.toString(), notification);

      // Send push notification
      const replier = await User.findById(userId).select('username displayName');
      const replierName = replier.displayName || replier.username;

      sendPushNotification(parentComment.user, {
        title: `💬 New Reply`,
        body: `${replierName} replied to your comment`,
        data: {
          type: 'reply',
          postId: post._id.toString(),
          commentId: newReply._id.toString(),
          url: `/feed?post=${post._id}&comment=${newReply._id}`
        },
        tag: `reply-${newReply._id}`
      }).catch(err => logger.error('Push notification error:', err));
    }

    // PHASE 1 REFACTOR: Don't populate likes (keep private)
    await post.populate('author', 'username displayName profilePhoto isVerified pronouns badges');
    await post.populate('comments.user', 'username displayName profilePhoto isVerified pronouns badges');
    // await post.populate('likes', 'username displayName profilePhoto'); // REMOVED - private likes
    // REMOVED 2025-12-26: originalPost population deleted (Phase 5)

    // PHASE 1 REFACTOR: Sanitize post to hide like counts
    const sanitizedPost = sanitizePostForPrivateLikes(post, userId);

    res.json(sanitizedPost);
  } catch (error) {
    logger.error('Reply to comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/posts/:id/comment/:commentId
// @desc    Edit a comment on a post
// @access  Private
router.put('/:id/comment/:commentId', auth, requireActiveUser, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = post.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const userId = req.userId || req.user._id;

    // Check if user is the comment author
    if (comment.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to edit this comment' });
    }

    comment.content = content;
    comment.edited = true;
    comment.editedAt = new Date();
    await post.save();

    // PHASE 1 REFACTOR: Don't populate likes (keep private)
    await post.populate('author', 'username displayName profilePhoto isVerified pronouns badges');
    await post.populate('comments.user', 'username displayName profilePhoto isVerified pronouns badges');
    // await post.populate('likes', 'username displayName profilePhoto'); // REMOVED - private likes
    // REMOVED 2025-12-26: originalPost population deleted (Phase 5)

    // PHASE 1 REFACTOR: Sanitize post to hide like counts
    const sanitizedPost = sanitizePostForPrivateLikes(post, userId);

    res.json(sanitizedPost);
  } catch (error) {
    logger.error('Edit comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/posts/:id/comment/:commentId
// @desc    Delete a comment from a post
// @access  Private
router.delete('/:id/comment/:commentId', auth, requireActiveUser, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = post.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const userId = req.userId || req.user._id;

    // Check if user is the comment author or post author
    if (comment.user.toString() !== userId.toString() && post.author.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    comment.deleteOne();
    await post.save();

    // PHASE 1 REFACTOR: Don't populate likes (keep private)
    await post.populate('author', 'username displayName profilePhoto isVerified pronouns badges');
    await post.populate('comments.user', 'username displayName profilePhoto isVerified pronouns badges');
    // await post.populate('likes', 'username displayName profilePhoto'); // REMOVED - private likes
    // REMOVED 2025-12-26: originalPost population deleted (Phase 5)

    // PHASE 1 REFACTOR: Sanitize post to hide like counts
    const sanitizedPost = sanitizePostForPrivateLikes(post, userId);

    res.json(sanitizedPost);
  } catch (error) {
    logger.error('Delete comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/pin
// @desc    Pin/unpin a post (OPTIONAL FEATURES)
// @access  Private
router.post('/:id/pin', auth, requireActiveUser, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Only author can pin their own posts
    if (post.author.toString() !== userId) {
      return res.status(403).json({ message: 'You can only pin your own posts' });
    }

    // Toggle pin status
    post.isPinned = !post.isPinned;
    post.pinnedAt = post.isPinned ? new Date() : null;

    await post.save();

    // PHASE 1 REFACTOR: Sanitize post to hide like counts
    const sanitizedPost = sanitizePostForPrivateLikes(post, userId);

    res.json(sanitizedPost);
  } catch (error) {
    logger.error('Pin post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/poll/vote
// @desc    Vote on a poll
// @access  Private
router.post('/:id/poll/vote', auth, requireActiveUser, async (req, res) => {
  try {
    const { optionIndex } = req.body;
    const userId = req.userId;

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (!post.poll || !post.poll.question) {
      return res.status(400).json({ message: 'This post does not have a poll' });
    }

    // Check if poll has ended
    if (post.poll.endsAt && new Date() > post.poll.endsAt) {
      return res.status(400).json({ message: 'This poll has ended' });
    }

    if (optionIndex === undefined || optionIndex < 0 || optionIndex >= post.poll.options.length) {
      return res.status(400).json({ message: 'Invalid option index' });
    }

    // Check if user already voted
    const hasVoted = post.poll.options.some(option =>
      option.votes.some(vote => vote.toString() === userId.toString())
    );

    if (hasVoted && !post.poll.allowMultipleVotes) {
      // Remove previous vote if not allowing multiple votes
      post.poll.options.forEach(option => {
        option.votes = option.votes.filter(vote => vote.toString() !== userId.toString());
      });
    }

    // Add vote
    post.poll.options[optionIndex].votes.push(userId);

    await post.save();
    await post.populate('author', 'username displayName profilePhoto isVerified pronouns badges');

    const sanitizedPost = sanitizePostForPrivateLikes(post, userId);
    res.json(sanitizedPost);
  } catch (error) {
    logger.error('Poll vote error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/posts/:id/poll/vote
// @desc    Remove user's vote from a poll
// @access  Private
router.delete('/:id/poll/vote', auth, requireActiveUser, async (req, res) => {
  try {
    const userId = req.userId;

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (!post.poll || !post.poll.question) {
      return res.status(400).json({ message: 'This post does not have a poll' });
    }

    // Check if poll has ended
    if (post.poll.endsAt && new Date() > post.poll.endsAt) {
      return res.status(400).json({ message: 'This poll has ended' });
    }

    // Check if user has voted
    const hasVoted = post.poll.options.some(option =>
      option.votes.some(vote => vote.toString() === userId.toString())
    );

    // Idempotent: if no vote exists, return success (no-op)
    if (!hasVoted) {
      logger.debug('noop.poll_vote.not_voted', {
        userId: userId,
        targetId: req.params.id,
        endpoint: 'DELETE /posts/:id/poll/vote'
      });
      await post.populate('author', 'username displayName profilePhoto isVerified pronouns badges');
      const sanitizedPost = sanitizePostForPrivateLikes(post, userId);
      return res.json(sanitizedPost);
    }

    // Remove user's vote from all options
    post.poll.options.forEach(option => {
      option.votes = option.votes.filter(vote => vote.toString() !== userId.toString());
    });

    await post.save();
    await post.populate('author', 'username displayName profilePhoto isVerified pronouns badges');

    const sanitizedPost = sanitizePostForPrivateLikes(post, userId);
    res.json(sanitizedPost);
  } catch (error) {
    logger.error('Poll remove vote error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/posts/:id/poll/voters
// @desc    Get list of voters for a poll with user details
// @access  Private
router.get('/:id/poll/voters', auth, requireActiveUser, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('poll.options.votes', 'username displayName profilePhoto');

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (!post.poll || !post.poll.question) {
      return res.status(400).json({ message: 'This post does not have a poll' });
    }

    // Check if results are hidden (author-only visibility)
    if (post.poll.resultsVisibility === 'author' && post.author.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: 'Poll results are hidden by the author' });
    }

    // Build voter list grouped by option
    const votersByOption = post.poll.options.map((option, index) => ({
      optionIndex: index,
      optionText: option.text,
      voters: option.votes.map(voter => ({
        _id: voter._id,
        username: voter.username,
        displayName: voter.displayName,
        profilePhoto: voter.profilePhoto
      }))
    }));

    res.json({
      question: post.poll.question,
      totalVotes: post.poll.options.reduce((sum, opt) => sum + opt.votes.length, 0),
      options: votersByOption
    });
  } catch (error) {
    logger.error('Get poll voters error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/posts/:id/edit-history
// @desc    DEPRECATED - Edit history UI removed 2025-12-26
// @access  Private
router.get('/:id/edit-history', auth, (req, res) => {
  res.status(410).json({
    message: 'Edit history viewing has been removed.',
    deprecated: true,
    removedDate: '2025-12-26'
  });
});

export default router;
