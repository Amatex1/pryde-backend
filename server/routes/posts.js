import express from 'express';
const router = express.Router();
import mongoose from 'mongoose';
import Post from '../models/Post.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import auth from '../middleware/auth.js';
import { postLimiter, commentLimiter } from '../middleware/rateLimiter.js';
import { checkMuted, moderateContent } from '../middleware/moderation.js';
import { sanitizeFields } from '../utils/sanitize.js';

// @route   GET /api/posts
// @desc    Get all posts (feed)
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, filter = 'followers' } = req.query;

    const userId = req.userId || req.user._id;
    const currentUser = await User.findById(userId);
    const friendIds = currentUser.friends || [];
    const followingIds = currentUser.following || [];

    let query = {};

    if (filter === 'public') {
      // Public feed: All public posts from everyone (not hidden from user)
      query = {
        visibility: 'public',
        hiddenFrom: { $ne: userId }
      };
    } else if (filter === 'followers') {
      // Followers feed: Posts from people you follow + your own posts
      query = {
        $or: [
          { author: userId }, // User's own posts (always visible)
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
    } else {
      // Default: Friends feed (backward compatibility)
      query = {
        $or: [
          { author: userId },
          {
            author: { $in: friendIds },
            visibility: 'public',
            hiddenFrom: { $ne: userId }
          },
          {
            author: { $in: friendIds },
            visibility: 'friends',
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

    const posts = await Post.find(query)
      .populate('author', 'username displayName profilePhoto isVerified pronouns')
      .populate('comments.user', 'username displayName profilePhoto isVerified pronouns')
      .populate('likes', 'username displayName profilePhoto')
      .populate('reactions.user', 'username displayName profilePhoto')
      .populate('comments.reactions.user', 'username displayName profilePhoto')
      .populate({
        path: 'originalPost',
        populate: [
          { path: 'author', select: 'username displayName profilePhoto' },
          { path: 'likes', select: 'username displayName profilePhoto' },
          { path: 'reactions.user', select: 'username displayName profilePhoto' }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Post.countDocuments(query);

    res.json({
      posts,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (error) {
    console.error('Get posts error:', error);
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

    // Get current user to check friendship
    const currentUser = await User.findById(currentUserId);
    const isFriend = currentUser.friends.some(friendId => friendId.toString() === profileUserId.toString());
    const isOwnProfile = currentUserId.toString() === profileUserId.toString();

    // Build query based on relationship
    let query = { author: profileUserId };

    if (!isOwnProfile) {
      // Not viewing own profile - apply privacy filters
      query = {
        author: profileUserId,
        $or: [
          { visibility: 'public', hiddenFrom: { $ne: currentUserId } },
          { visibility: 'friends', hiddenFrom: { $ne: currentUserId }, ...(isFriend ? {} : { _id: null }) }, // Only if friends
          { visibility: 'custom', sharedWith: currentUserId, hiddenFrom: { $ne: currentUserId } }
        ]
      };
    }

    const posts = await Post.find(query)
      .populate('author', 'username displayName profilePhoto isVerified pronouns')
      .populate('comments.user', 'username displayName profilePhoto isVerified pronouns')
      .populate('likes', 'username displayName profilePhoto')
      .populate('reactions.user', 'username displayName profilePhoto')
      .populate('comments.reactions.user', 'username displayName profilePhoto')
      .populate({
        path: 'originalPost',
        populate: [
          { path: 'author', select: 'username displayName profilePhoto' },
          { path: 'likes', select: 'username displayName profilePhoto' },
          { path: 'reactions.user', select: 'username displayName profilePhoto' }
        ]
      })
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/posts/:id
// @desc    Get single post
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'username displayName profilePhoto isVerified pronouns')
      .populate('comments.user', 'username displayName profilePhoto isVerified pronouns')
      .populate('likes', 'username displayName profilePhoto')
      .populate('reactions.user', 'username displayName profilePhoto')
      .populate('comments.reactions.user', 'username displayName profilePhoto');

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.json(post);
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts
// @desc    Create a new post
// @access  Private
router.post('/', auth, postLimiter, sanitizeFields(['content', 'contentWarning']), checkMuted, moderateContent, async (req, res) => {
  try {
    const { content, images, media, visibility, hiddenFrom, sharedWith, contentWarning } = req.body;

    // Require either content or media
    if ((!content || content.trim() === '') && (!media || media.length === 0)) {
      return res.status(400).json({ message: 'Post must have content or media' });
    }

    const userId = req.userId || req.user._id;

    const post = new Post({
      author: userId,
      content: content || '',
      images: images || [],
      media: media || [],
      visibility: visibility || 'public',
      hiddenFrom: hiddenFrom || [],
      sharedWith: sharedWith || [],
      contentWarning: contentWarning || ''
    });

    await post.save();
    await post.populate('author', 'username displayName profilePhoto isVerified pronouns');

    res.status(201).json(post);
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/posts/:id
// @desc    Update a post
// @access  Private
router.put('/:id', auth, async (req, res) => {
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

    if (content !== undefined) post.content = content;
    if (images) post.images = images;
    if (visibility) post.visibility = visibility;
    if (hiddenFrom !== undefined) post.hiddenFrom = hiddenFrom;
    if (sharedWith !== undefined) post.sharedWith = sharedWith;

    await post.save();
    await post.populate('author', 'username displayName profilePhoto isVerified pronouns');
    await post.populate('likes', 'username displayName profilePhoto');
    await post.populate('comments.user', 'username displayName profilePhoto isVerified pronouns');
    await post.populate({
      path: 'originalPost',
      populate: [
        { path: 'author', select: 'username displayName profilePhoto' },
        { path: 'likes', select: 'username displayName profilePhoto' },
        { path: 'comments.user', select: 'username displayName profilePhoto' }
      ]
    });

    res.json(post);
  } catch (error) {
    console.error('Update post error:', error);
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
    console.error('Delete post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/like
// @desc    Like/Unlike a post
// @access  Private
router.post('/:id/like', auth, async (req, res) => {
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
      }
    }

    await post.save();
    await post.populate('author', 'username displayName profilePhoto isVerified pronouns');
    await post.populate('likes', 'username displayName profilePhoto');
    await post.populate('comments.user', 'username displayName profilePhoto isVerified pronouns');
    await post.populate({
      path: 'originalPost',
      populate: [
        { path: 'author', select: 'username displayName profilePhoto' },
        { path: 'likes', select: 'username displayName profilePhoto' },
        { path: 'comments.user', select: 'username displayName profilePhoto' }
      ]
    });

    res.json(post);
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/react
// @desc    Add a reaction to a post
// @access  Private
router.post('/:id/react', auth, async (req, res) => {
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
      }
    }

    await post.save();
    await post.populate('author', 'username displayName profilePhoto isVerified pronouns');
    await post.populate('likes', 'username displayName profilePhoto');
    await post.populate('reactions.user', 'username displayName profilePhoto');
    await post.populate('comments.user', 'username displayName profilePhoto isVerified pronouns');
    await post.populate({
      path: 'originalPost',
      populate: [
        { path: 'author', select: 'username displayName profilePhoto' },
        { path: 'likes', select: 'username displayName profilePhoto' },
        { path: 'comments.user', select: 'username displayName profilePhoto' }
      ]
    });

    res.json(post);
  } catch (error) {
    console.error('React to post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/comment/:commentId/react
// @desc    Add a reaction to a comment
// @access  Private
router.post('/:id/comment/:commentId/react', auth, async (req, res) => {
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
    await post.populate('author', 'username displayName profilePhoto isVerified pronouns');
    await post.populate('likes', 'username displayName profilePhoto');
    await post.populate('reactions.user', 'username displayName profilePhoto');
    await post.populate('comments.user', 'username displayName profilePhoto isVerified pronouns');
    await post.populate('comments.reactions.user', 'username displayName profilePhoto');
    await post.populate({
      path: 'originalPost',
      populate: [
        { path: 'author', select: 'username displayName profilePhoto' },
        { path: 'likes', select: 'username displayName profilePhoto' },
        { path: 'comments.user', select: 'username displayName profilePhoto' }
      ]
    });

    res.json(post);
  } catch (error) {
    console.error('React to comment error:', error);
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
    console.error('Share post error:', error);
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
    console.error('Unshare post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/comment
// @desc    Add a comment to a post
// @access  Private
router.post('/:id/comment', auth, commentLimiter, sanitizeFields(['content']), checkMuted, moderateContent, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const userId = req.userId || req.user._id;

    const comment = {
      user: userId,
      content,
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
    }

    await post.populate('author', 'username displayName profilePhoto isVerified pronouns');
    await post.populate('comments.user', 'username displayName profilePhoto isVerified pronouns');
    await post.populate('likes', 'username displayName profilePhoto');
    await post.populate({
      path: 'originalPost',
      populate: [
        { path: 'author', select: 'username displayName profilePhoto' },
        { path: 'likes', select: 'username displayName profilePhoto' },
        { path: 'comments.user', select: 'username displayName profilePhoto' }
      ]
    });

    res.json(post);
  } catch (error) {
    console.error('Comment post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/comment/:commentId/reply
// @desc    Reply to a comment
// @access  Private
router.post('/:id/comment/:commentId/reply', auth, commentLimiter, checkMuted, moderateContent, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({ message: 'Reply content is required' });
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
      content,
      parentComment: req.params.commentId,
      createdAt: new Date()
    };

    post.comments.push(reply);

    // Add reply ID to parent comment's replies array
    const savedPost = await post.save();
    const newReply = savedPost.comments[savedPost.comments.length - 1];
    parentComment.replies.push(newReply._id);

    await post.save();

    await post.populate('author', 'username displayName profilePhoto isVerified pronouns');
    await post.populate('comments.user', 'username displayName profilePhoto isVerified pronouns');
    await post.populate('likes', 'username displayName profilePhoto');
    await post.populate({
      path: 'originalPost',
      populate: [
        { path: 'author', select: 'username displayName profilePhoto' },
        { path: 'likes', select: 'username displayName profilePhoto' },
        { path: 'comments.user', select: 'username displayName profilePhoto' }
      ]
    });

    res.json(post);
  } catch (error) {
    console.error('Reply to comment error:', error);
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

    await post.populate('author', 'username displayName profilePhoto isVerified pronouns');
    await post.populate('comments.user', 'username displayName profilePhoto isVerified pronouns');
    await post.populate('likes', 'username displayName profilePhoto');
    await post.populate({
      path: 'originalPost',
      populate: [
        { path: 'author', select: 'username displayName profilePhoto' },
        { path: 'likes', select: 'username displayName profilePhoto' },
        { path: 'comments.user', select: 'username displayName profilePhoto' }
      ]
    });

    res.json(post);
  } catch (error) {
    console.error('Edit comment error:', error);
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

    await post.populate('author', 'username displayName profilePhoto isVerified pronouns');
    await post.populate('comments.user', 'username displayName profilePhoto isVerified pronouns');
    await post.populate('likes', 'username displayName profilePhoto');
    await post.populate({
      path: 'originalPost',
      populate: [
        { path: 'author', select: 'username displayName profilePhoto' },
        { path: 'likes', select: 'username displayName profilePhoto' },
        { path: 'comments.user', select: 'username displayName profilePhoto' }
      ]
    });

    res.json(post);
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
