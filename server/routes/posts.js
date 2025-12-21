import express from 'express';
const router = express.Router();
import mongoose from 'mongoose';
import Post from '../models/Post.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import auth from '../middleware/auth.js';
import { postLimiter, commentLimiter, reactionLimiter } from '../middleware/rateLimiter.js';
import { checkMuted, moderateContent } from '../middleware/moderation.js';
import { sanitizeFields } from '../utils/sanitize.js';
import { sendPushNotification } from './pushNotifications.js';
import logger from '../utils/logger.js';
import { getBlockedUserIds } from '../utils/blockHelper.js';

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

  // Handle originalPost (shared posts)
  if (postObj.originalPost) {
    // CRITICAL: Also convert nested originalPost to plain object
    const originalPostObj = postObj.originalPost.toObject ? postObj.originalPost.toObject() : { ...postObj.originalPost };
    const originalHasLiked = originalPostObj.likes?.some(like =>
      (like._id || like).toString() === currentUserId.toString()
    );
    originalPostObj.hasLiked = originalHasLiked;
    delete originalPostObj.likes;
    postObj.originalPost = originalPostObj;
  }

  return postObj;
};

// @route   GET /api/posts
// @desc    Get all posts (feed)
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, filter = 'followers' } = req.query;

    const userId = req.userId || req.user._id;
    const currentUser = await User.findById(userId);
    const followingIds = currentUser.following || [];

    // Get blocked user IDs to filter them out
    const blockedUserIds = await getBlockedUserIds(userId);

    let query = {};

    if (filter === 'public') {
      // Public feed: All public posts from everyone (not hidden from user, excluding blocked users)
      query = {
        visibility: 'public',
        hiddenFrom: { $ne: userId },
        author: { $nin: blockedUserIds },
        tagOnly: { $ne: true } // Exclude tag-only posts from main feed
      };
    } else if (filter === 'followers') {
      // Followers feed: Posts from people you follow + your own posts (excluding blocked users)
      query = {
        $or: [
          { author: userId, tagOnly: { $ne: true } }, // User's own posts (always visible, except tag-only)
          {
            author: { $in: followingIds, $nin: blockedUserIds },
            visibility: 'public',
            hiddenFrom: { $ne: userId },
            tagOnly: { $ne: true }
          },
          {
            author: { $in: followingIds, $nin: blockedUserIds },
            visibility: 'followers',
            hiddenFrom: { $ne: userId },
            tagOnly: { $ne: true }
          },
          {
            visibility: 'custom',
            sharedWith: userId,
            hiddenFrom: { $ne: userId },
            author: { $nin: blockedUserIds },
            tagOnly: { $ne: true }
          }
        ]
      };
    } else {
      // Default: Followers feed (same as 'followers' filter)
      query = {
        $or: [
          { author: userId },
          {
            author: { $in: followingIds },
            visibility: 'public',
            hiddenFrom: { $ne: userId }
          },
          {
            author: { $in: followingIds },
            visibility: 'followers',
            hiddenFrom: { $ne: userId }
          },
          {
            visibility: 'custom',
            sharedWith: userId,
            hiddenFrom: { $ne: userId }
          }
        ]
      };
    }

    // PHASE 1 REFACTOR: Don't populate likes (keep private)
    const posts = await Post.find(query)
      .populate('author', 'username displayName profilePhoto isVerified pronouns')
      .populate('comments.user', 'username displayName profilePhoto isVerified pronouns')
      // .populate('likes', 'username displayName profilePhoto') // REMOVED - private likes
      .populate('reactions.user', 'username displayName profilePhoto')
      .populate('comments.reactions.user', 'username displayName profilePhoto')
      .populate('tags', 'slug label icon') // PHASE 4: Populate tags for display
      .populate('commentCount') // Populate virtual comment count from Comment collection
      .populate({
        path: 'originalPost',
        populate: [
          { path: 'author', select: 'username displayName profilePhoto' },
          // { path: 'likes', select: 'username displayName profilePhoto' }, // REMOVED - private likes
          { path: 'reactions.user', select: 'username displayName profilePhoto' }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Post.countDocuments(query);

    // PHASE 1 REFACTOR: Sanitize posts to hide like counts
    const sanitizedPosts = posts.map(post => sanitizePostForPrivateLikes(post, userId));

    res.json({
      posts: sanitizedPosts,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (error) {
    logger.error('Get posts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/posts/user/:identifier
// @desc    Get posts by user (by ID or username)
// @access  Private
router.get('/user/:identifier', auth, async (req, res) => {
  try {
    const currentUserId = req.userId || req.user._id;
    const { identifier } = req.params;
    let profileUserId;

    // Check if identifier is a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(identifier) && identifier.length === 24) {
      profileUserId = identifier;
    } else {
      // Try to find user by username
      const profileUser = await User.findOne({ username: identifier });
      if (!profileUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      profileUserId = profileUser._id;
    }

    // Get current user to check following relationship
    const currentUser = await User.findById(currentUserId);
    const isFollowing = currentUser.following && currentUser.following.some(followId => followId.toString() === profileUserId.toString());
    const isOwnProfile = currentUserId.toString() === profileUserId.toString();

    // Build query based on relationship
    let query = { author: profileUserId, tagOnly: { $ne: true } }; // Exclude tag-only posts from profile

    if (!isOwnProfile) {
      // Not viewing own profile - apply privacy filters
      query = {
        author: profileUserId,
        tagOnly: { $ne: true }, // Exclude tag-only posts from profile
        $or: [
          { visibility: 'public', hiddenFrom: { $ne: currentUserId } },
          { visibility: 'followers', hiddenFrom: { $ne: currentUserId }, ...(isFollowing ? {} : { _id: null }) }, // Only if following
          { visibility: 'custom', sharedWith: currentUserId, hiddenFrom: { $ne: currentUserId } }
        ]
      };
    }

    // PHASE 1 REFACTOR: Don't populate likes (keep private)
    const posts = await Post.find(query)
      .populate('author', 'username displayName profilePhoto isVerified pronouns')
      .populate('comments.user', 'username displayName profilePhoto isVerified pronouns')
      // .populate('likes', 'username displayName profilePhoto') // REMOVED - private likes
      .populate('reactions.user', 'username displayName profilePhoto')
      .populate('comments.reactions.user', 'username displayName profilePhoto')
      .populate('commentCount') // Populate virtual comment count from Comment collection
      .populate({
        path: 'originalPost',
        populate: [
          { path: 'author', select: 'username displayName profilePhoto' },
          // { path: 'likes', select: 'username displayName profilePhoto' }, // REMOVED - private likes
          { path: 'reactions.user', select: 'username displayName profilePhoto' }
        ]
      })
      .sort({ createdAt: -1 });

    // PHASE 1 REFACTOR: Sanitize posts to hide like counts
    const sanitizedPosts = posts.map(post => sanitizePostForPrivateLikes(post, currentUserId));

    res.json(sanitizedPosts);
  } catch (error) {
    logger.error('Get user posts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/posts/:id
// @desc    Get single post
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    // PHASE 1 REFACTOR: Don't populate likes (keep private)
    const post = await Post.findById(req.params.id)
      .populate('author', 'username displayName profilePhoto isVerified pronouns')
      .populate('comments.user', 'username displayName profilePhoto isVerified pronouns')
      // .populate('likes', 'username displayName profilePhoto') // REMOVED - private likes
      .populate('reactions.user', 'username displayName profilePhoto')
      .populate('comments.reactions.user', 'username displayName profilePhoto');

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // PHASE 1 REFACTOR: Sanitize post to hide like counts
    const userId = req.userId || req.user._id;
    const sanitizedPost = sanitizePostForPrivateLikes(post, userId);

    res.json(sanitizedPost);
  } catch (error) {
    logger.error('Get post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts
// @desc    Create a new post
// @access  Private
router.post('/', auth, postLimiter, sanitizeFields(['content', 'contentWarning']), checkMuted, moderateContent, async (req, res) => {
  try {
    const { content, images, media, visibility, hiddenFrom, sharedWith, contentWarning, tags, hideMetrics, poll, tagOnly } = req.body;

    // Require either content, media, or poll
    if ((!content || content.trim() === '') && (!media || media.length === 0) && !poll) {
      return res.status(400).json({ message: 'Post must have content, media, or a poll' });
    }

    const userId = req.userId || req.user._id;

    // PHASE 4: Handle tags
    let tagIds = [];
    if (tags && Array.isArray(tags) && tags.length > 0) {
      const Tag = (await import('../models/Tag.js')).default;
      tagIds = await Promise.all(tags.map(async (tagSlug) => {
        const tag = await Tag.findOne({ slug: tagSlug.toLowerCase() });
        if (tag) {
          // Increment post count
          tag.postCount += 1;
          await tag.save();
          return tag._id;
        }
        return null;
      }));
      tagIds = tagIds.filter(id => id !== null);
    }

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
        showResultsBeforeVoting: poll.showResultsBeforeVoting || false
      };
    }

    const post = new Post({
      author: userId,
      content: content || '',
      images: images || [],
      media: media || [],
      visibility: visibility || 'public',
      hiddenFrom: hiddenFrom || [],
      sharedWith: sharedWith || [],
      contentWarning: contentWarning || '',
      tags: tagIds, // PHASE 4: Add tags
      hideMetrics: hideMetrics || false,
      poll: pollData || null,
      tagOnly: tagOnly || false // PHASE 4: Tag-only posts
    });

    await post.save();
    await post.populate('author', 'username displayName profilePhoto isVerified pronouns');
    await post.populate('tags', 'slug label icon'); // PHASE 4: Populate tags

    res.status(201).json(post);
  } catch (error) {
    logger.error('Create post error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/posts/:id
// @desc    Update a post
// @access  Private
router.put('/:id', auth, sanitizeFields(['content', 'contentWarning']), async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const userId = req.userId || req.user._id;

    // Check if user is the author
    if (post.author.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to edit this post' });
    }

    const { content, images, visibility, hiddenFrom, sharedWith } = req.body;

    // Save to edit history if content changed
    if (content !== undefined && content !== post.content) {
      if (!post.editHistory) {
        post.editHistory = [];
      }
      post.editHistory.push({
        content: post.content,
        editedAt: new Date(),
        editedBy: userId
      });
    }

    if (content !== undefined) post.content = content;
    if (images) post.images = images;
    if (visibility) post.visibility = visibility;
    if (hiddenFrom !== undefined) post.hiddenFrom = hiddenFrom;
    if (sharedWith !== undefined) post.sharedWith = sharedWith;

    await post.save();

    // PHASE 1 REFACTOR: Don't populate likes (keep private)
    await post.populate('author', 'username displayName profilePhoto isVerified pronouns');
    // await post.populate('likes', 'username displayName profilePhoto'); // REMOVED - private likes
    await post.populate('comments.user', 'username displayName profilePhoto isVerified pronouns');
    await post.populate({
      path: 'originalPost',
      populate: [
        { path: 'author', select: 'username displayName profilePhoto' },
        // { path: 'likes', select: 'username displayName profilePhoto' }, // REMOVED - private likes
        { path: 'comments.user', select: 'username displayName profilePhoto' }
      ]
    });

    // PHASE 1 REFACTOR: Sanitize post to hide like counts
    const sanitizedPost = sanitizePostForPrivateLikes(post, userId);

    res.json(sanitizedPost);
  } catch (error) {
    logger.error('Update post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/posts/:id
// @desc    Delete a post
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const userId = req.userId || req.user._id;

    // Check if user is the author
    if (post.author.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    await post.deleteOne();

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    logger.error('Delete post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/like
// @desc    Like/Unlike a post
// @access  Private
router.post('/:id/like', auth, reactionLimiter, async (req, res) => {
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
    await post.populate('author', 'username displayName profilePhoto isVerified pronouns');
    // await post.populate('likes', 'username displayName profilePhoto'); // REMOVED - private likes
    await post.populate('comments.user', 'username displayName profilePhoto isVerified pronouns');
    await post.populate({
      path: 'originalPost',
      populate: [
        { path: 'author', select: 'username displayName profilePhoto' },
        // { path: 'likes', select: 'username displayName profilePhoto' }, // REMOVED - private likes
        { path: 'comments.user', select: 'username displayName profilePhoto' }
      ]
    });

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
router.post('/:id/react', auth, reactionLimiter, async (req, res) => {
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
    await post.populate('author', 'username displayName profilePhoto isVerified pronouns');
    // await post.populate('likes', 'username displayName profilePhoto'); // REMOVED - private likes
    await post.populate('reactions.user', 'username displayName profilePhoto');
    await post.populate('comments.user', 'username displayName profilePhoto isVerified pronouns');
    await post.populate({
      path: 'originalPost',
      populate: [
        { path: 'author', select: 'username displayName profilePhoto' },
        // { path: 'likes', select: 'username displayName profilePhoto' }, // REMOVED - private likes
        { path: 'comments.user', select: 'username displayName profilePhoto' }
      ]
    });

    // PHASE 1 REFACTOR: Sanitize post to hide like counts
    const sanitizedPost = sanitizePostForPrivateLikes(post, userId);

    // Emit real-time event for post reaction
    if (req.io) {
      req.io.emit('post_reaction_added', {
        postId: post._id,
        post: sanitizedPost
      });
    }

    res.json(sanitizedPost);
  } catch (error) {
    logger.error('React to post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/comment/:commentId/react
// @desc    Add a reaction to a comment
// @access  Private
router.post('/:id/comment/:commentId/react', auth, reactionLimiter, async (req, res) => {
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
      }
    }

    await post.save();

    // PHASE 1 REFACTOR: Don't populate likes (keep private)
    await post.populate('author', 'username displayName profilePhoto isVerified pronouns');
    // await post.populate('likes', 'username displayName profilePhoto'); // REMOVED - private likes
    await post.populate('reactions.user', 'username displayName profilePhoto');
    await post.populate('comments.user', 'username displayName profilePhoto isVerified pronouns');
    await post.populate('comments.reactions.user', 'username displayName profilePhoto');
    await post.populate({
      path: 'originalPost',
      populate: [
        { path: 'author', select: 'username displayName profilePhoto' },
        // { path: 'likes', select: 'username displayName profilePhoto' }, // REMOVED - private likes
        { path: 'comments.user', select: 'username displayName profilePhoto' }
      ]
    });

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
// @desc    Share/Repost a post
// @access  Private
router.post('/:id/share', auth, postLimiter, checkMuted, async (req, res) => {
  try {
    const originalPost = await Post.findById(req.params.id);

    if (!originalPost) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const userId = req.userId || req.user._id;
    const { shareComment, shareToFriendProfile } = req.body;

    // Check if user already shared this post (only for own profile shares)
    if (!shareToFriendProfile) {
      const existingShare = await Post.findOne({
        author: userId,
        isShared: true,
        originalPost: originalPost._id
      });

      if (existingShare) {
        return res.status(400).json({ message: 'You have already shared this post' });
      }
    }

    // Determine the author of the shared post
    const shareAuthor = shareToFriendProfile || userId;

    // Create shared post
    const sharedPost = new Post({
      author: shareAuthor,
      isShared: true,
      originalPost: originalPost._id,
      shareComment: shareComment || '',
      visibility: 'public'
    });

    await sharedPost.save();

    // Add to original post's shares
    originalPost.shares.push({
      user: userId,
      sharedAt: new Date()
    });
    await originalPost.save();

    // Create notification for original post author (don't notify yourself)
    if (originalPost.author.toString() !== userId.toString()) {
      const notification = new Notification({
        recipient: originalPost.author,
        sender: userId,
        type: 'share',
        message: 'shared your post',
        postId: originalPost._id
      });
      await notification.save();
    }

    // Populate the shared post
    await sharedPost.populate('author', 'username displayName profilePhoto isVerified pronouns');
    await sharedPost.populate({
      path: 'originalPost',
      populate: [
        { path: 'author', select: 'username displayName profilePhoto' },
        { path: 'likes', select: 'username displayName profilePhoto' }
      ]
    });

    res.status(201).json(sharedPost);
  } catch (error) {
    logger.error('Share post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/posts/:id/share
// @desc    Unshare/Remove repost
// @access  Private
router.delete('/:id/share', auth, async (req, res) => {
  try {
    const userId = req.userId || req.user._id;

    // Find the shared post
    const sharedPost = await Post.findOne({
      author: userId,
      isShared: true,
      originalPost: req.params.id
    });

    if (!sharedPost) {
      return res.status(404).json({ message: 'Shared post not found' });
    }

    // Remove from original post's shares
    const originalPost = await Post.findById(req.params.id);
    if (originalPost) {
      originalPost.shares = originalPost.shares.filter(
        share => share.user.toString() !== userId.toString()
      );
      await originalPost.save();
    }

    // Delete the shared post
    await sharedPost.deleteOne();

    res.json({ message: 'Post unshared successfully' });
  } catch (error) {
    logger.error('Unshare post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/comment
// @desc    Add a comment to a post
// @access  Private
router.post('/:id/comment', auth, commentLimiter, sanitizeFields(['content']), checkMuted, moderateContent, async (req, res) => {
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
    await post.populate('author', 'username displayName profilePhoto isVerified pronouns');
    await post.populate('comments.user', 'username displayName profilePhoto isVerified pronouns');
    // await post.populate('likes', 'username displayName profilePhoto'); // REMOVED - private likes
    await post.populate({
      path: 'originalPost',
      populate: [
        { path: 'author', select: 'username displayName profilePhoto' },
        // { path: 'likes', select: 'username displayName profilePhoto' }, // REMOVED - private likes
        { path: 'comments.user', select: 'username displayName profilePhoto' }
      ]
    });

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

    res.json(sanitizedPost);
  } catch (error) {
    logger.error('Comment post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/comment/:commentId/reply
// @desc    Reply to a comment
// @access  Private
router.post('/:id/comment/:commentId/reply', auth, commentLimiter, sanitizeFields(['content']), checkMuted, moderateContent, async (req, res) => {
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

    // PHASE 1 REFACTOR: Don't populate likes (keep private)
    await post.populate('author', 'username displayName profilePhoto isVerified pronouns');
    await post.populate('comments.user', 'username displayName profilePhoto isVerified pronouns');
    // await post.populate('likes', 'username displayName profilePhoto'); // REMOVED - private likes
    await post.populate({
      path: 'originalPost',
      populate: [
        { path: 'author', select: 'username displayName profilePhoto' },
        // { path: 'likes', select: 'username displayName profilePhoto' }, // REMOVED - private likes
        { path: 'comments.user', select: 'username displayName profilePhoto' }
      ]
    });

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
router.put('/:id/comment/:commentId', auth, async (req, res) => {
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
    await post.populate('author', 'username displayName profilePhoto isVerified pronouns');
    await post.populate('comments.user', 'username displayName profilePhoto isVerified pronouns');
    // await post.populate('likes', 'username displayName profilePhoto'); // REMOVED - private likes
    await post.populate({
      path: 'originalPost',
      populate: [
        { path: 'author', select: 'username displayName profilePhoto' },
        // { path: 'likes', select: 'username displayName profilePhoto' }, // REMOVED - private likes
        { path: 'comments.user', select: 'username displayName profilePhoto' }
      ]
    });

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
router.delete('/:id/comment/:commentId', auth, async (req, res) => {
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
    await post.populate('author', 'username displayName profilePhoto isVerified pronouns');
    await post.populate('comments.user', 'username displayName profilePhoto isVerified pronouns');
    // await post.populate('likes', 'username displayName profilePhoto'); // REMOVED - private likes
    await post.populate({
      path: 'originalPost',
      populate: [
        { path: 'author', select: 'username displayName profilePhoto' },
        // { path: 'likes', select: 'username displayName profilePhoto' }, // REMOVED - private likes
        { path: 'comments.user', select: 'username displayName profilePhoto' }
      ]
    });

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
router.post('/:id/pin', auth, async (req, res) => {
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
router.post('/:id/poll/vote', auth, async (req, res) => {
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
    await post.populate('author', 'username displayName profilePhoto isVerified pronouns');

    const sanitizedPost = sanitizePostForPrivateLikes(post, userId);
    res.json(sanitizedPost);
  } catch (error) {
    logger.error('Poll vote error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/posts/:id/edit-history
// @desc    Get edit history for a post
// @access  Private
router.get('/:id/edit-history', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('editHistory.editedBy', 'username displayName profilePhoto');

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.json({ editHistory: post.editHistory || [] });
  } catch (error) {
    logger.error('Get edit history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
