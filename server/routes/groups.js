/**
 * Phase 2: Group-only posting
 *
 * Group Routes - Private, join-gated community groups
 *
 * ENDPOINTS:
 * - GET  /api/groups             - List all groups
 * - GET  /api/groups/:slug       - Get group (metadata for all, posts only for members)
 * - POST /api/groups/:slug/join  - Join a group (idempotent)
 * - POST /api/groups/:slug/leave - Leave a group
 * - POST /api/groups/:slug/posts - Create a post in this group (members only)
 * - GET  /api/groups/:slug/posts - Get posts in this group (members only)
 *
 * ISOLATION:
 * - Group posts are intentionally isolated from global feeds
 * - Group posts NEVER appear in /feed, /profile, bookmarks, search, or notifications
 * - All read/write operations verify membership on backend
 *
 * Tags are legacy entry points only.
 */

import express from 'express';
import Group from '../models/Group.js';
import Post from '../models/Post.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   GET /api/groups
 * @desc    List all groups (public listing)
 *          Shows approved groups + user's own pending groups
 * @access  Private (authenticated)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get approved groups (excluding hidden) OR user's own pending groups
    const groups = await Group.find({
      $and: [
        { visibility: { $ne: 'hidden' } },
        {
          $or: [
            { status: 'approved' },
            { status: 'pending', owner: userId } // Show user's own pending groups
          ]
        }
      ]
    })
      .populate('owner', 'username displayName profilePhoto')
      .sort({ name: 1 });

    // Map groups to include membership status and member count
    const groupsWithStatus = groups.map(group => ({
      _id: group._id,
      slug: group.slug,
      name: group.name,
      description: group.description,
      visibility: group.visibility,
      status: group.status,
      owner: group.owner,
      memberCount: group.members.length + group.moderators.length + 1,
      isMember: group.isMember(userId),
      isOwner: group.owner._id.toString() === userId,
      createdAt: group.createdAt
    }));

    res.json({ groups: groupsWithStatus });
  } catch (error) {
    console.error('List groups error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/groups
 * @desc    Create a new group (requires admin approval)
 * @access  Private (authenticated)
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description } = req.body;

    // Validate input
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 100) {
      return res.status(400).json({ message: 'Group name must be 100 characters or less' });
    }

    // Generate slug from name
    const slug = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .substring(0, 50);

    if (!slug) {
      return res.status(400).json({ message: 'Invalid group name' });
    }

    // Check if slug already exists
    const existing = await Group.findOne({ slug });
    if (existing) {
      return res.status(409).json({ message: 'A group with a similar name already exists' });
    }

    // Create group with pending status
    const group = new Group({
      slug,
      name: trimmedName,
      description: description?.trim().substring(0, 500) || '',
      visibility: 'private',
      status: 'pending', // Requires admin approval
      owner: userId,
      members: [],
      moderators: []
    });

    await group.save();

    res.status(201).json({
      success: true,
      message: 'Group submitted for approval',
      group: {
        _id: group._id,
        slug: group.slug,
        name: group.name,
        description: group.description,
        status: group.status
      }
    });

  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/groups/:slug
 * @desc    Get group by slug
 *          - Non-members: metadata only (name, description)
 *          - Members: metadata + posts scoped to group
 * @access  Private (authenticated)
 */
router.get('/:slug', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user.id;

    // Find group by slug (normalize to lowercase for consistency)
    const group = await Group.findOne({ slug: slug.toLowerCase() })
      .populate('owner', 'username displayName profilePhoto')
      .populate('moderators', 'username displayName profilePhoto');

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check membership
    const isMember = group.isMember(userId);
    const memberCount = group.members.length + group.moderators.length + 1; // +1 for owner

    // Base response (visible to everyone)
    const response = {
      _id: group._id,
      slug: group.slug,
      name: group.name,
      description: group.description,
      visibility: group.visibility,
      owner: group.owner,
      moderators: group.moderators,
      memberCount,
      isMember,
      createdAt: group.createdAt
    };

    // If NOT a member, return metadata only - NO posts
    if (!isMember) {
      return res.json({
        ...response,
        posts: null, // Explicitly null to indicate access denied
        message: 'Join this group to see posts'
      });
    }

    // Phase 2: Member - fetch posts scoped to this group
    // Group posts are intentionally isolated from global feeds
    const posts = await Post.find({
      groupId: group._id,
      visibility: 'group'
    })
      .populate('author', 'username displayName profilePhoto isVerified')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.json({
      ...response,
      posts
    });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ message: 'Failed to fetch group' });
  }
});

/**
 * @route   POST /api/groups/:slug/join
 * @desc    Join a group (idempotent - safe to click twice)
 * @access  Private (authenticated)
 */
router.post('/:slug/join', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user.id;

    // Use $addToSet for idempotent membership addition (no duplicates)
    // findOneAndUpdate is atomic and returns the updated document
    const group = await Group.findOneAndUpdate(
      { slug: slug.toLowerCase() },
      { $addToSet: { members: userId } },
      { new: true }
    )
      .populate('owner', 'username displayName profilePhoto')
      .populate('moderators', 'username displayName profilePhoto');

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Return full response with isMember flag for UI update
    const memberCount = group.members.length + group.moderators.length + 1; // +1 for owner

    res.json({
      success: true,
      message: 'Successfully joined group',
      isMember: true,
      groupId: group._id,
      slug: group.slug,
      name: group.name,
      description: group.description,
      visibility: group.visibility,
      owner: group.owner,
      moderators: group.moderators,
      memberCount,
      createdAt: group.createdAt,
      posts: [] // Posts will be fetched separately or in Phase 1+
    });
  } catch (error) {
    console.error('Join group error:', error);
    res.status(500).json({ message: 'Failed to join group' });
  }
});

/**
 * @route   POST /api/groups/:slug/leave
 * @desc    Leave a group
 * @access  Private (authenticated)
 */
router.post('/:slug/leave', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user.id;

    // Normalize slug for consistency
    const group = await Group.findOne({ slug: slug.toLowerCase() });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Owner cannot leave (must transfer ownership first)
    if (group.owner.toString() === userId) {
      return res.status(400).json({
        message: 'Owner cannot leave group. Transfer ownership first.'
      });
    }

    // Use $pull for atomic removal from both arrays
    await Group.findOneAndUpdate(
      { slug: slug.toLowerCase() },
      {
        $pull: {
          members: userId,
          moderators: userId
        }
      }
    );

    res.json({
      success: true,
      message: 'Left group successfully',
      isMember: false,
      slug: group.slug
    });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ message: 'Failed to leave group' });
  }
});

/**
 * Phase 2: Group-only posting
 *
 * @route   POST /api/groups/:slug/posts
 * @desc    Create a post in this group (members only)
 * @access  Private (authenticated + member)
 *
 * Group posts are intentionally isolated from global feeds.
 * They NEVER appear in /feed, /profile, bookmarks, search, or notifications.
 */
router.post('/:slug/posts', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user.id;
    const { content, media, contentWarning } = req.body;

    // Find group
    const group = await Group.findOne({ slug: slug.toLowerCase() });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // CRITICAL: Verify membership on backend
    if (!group.isMember(userId)) {
      return res.status(403).json({
        message: 'You must be a member to post in this group'
      });
    }

    // Validate content
    if ((!content || content.trim() === '') && (!media || media.length === 0)) {
      return res.status(400).json({ message: 'Post must have content or media' });
    }

    // Create group post
    const post = new Post({
      author: userId,
      content: content || '',
      media: media || [],
      groupId: group._id,
      visibility: 'group', // Phase 2: Group visibility isolates from global feeds
      contentWarning: contentWarning || ''
    });

    await post.save();

    // Populate author for response
    await post.populate('author', 'username displayName profilePhoto isVerified');

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post: post.toObject()
    });
  } catch (error) {
    console.error('Create group post error:', error);
    res.status(500).json({ message: 'Failed to create post' });
  }
});

/**
 * Phase 2: Group-only posting
 *
 * @route   GET /api/groups/:slug/posts
 * @desc    Get posts in this group (members only)
 * @access  Private (authenticated + member)
 *
 * Group posts are intentionally isolated from global feeds.
 */
router.get('/:slug/posts', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user.id;
    const { before, limit = 20 } = req.query;

    // Find group
    const group = await Group.findOne({ slug: slug.toLowerCase() });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // CRITICAL: Verify membership on backend
    if (!group.isMember(userId)) {
      return res.status(403).json({
        message: 'You must be a member to view posts in this group'
      });
    }

    // Build query
    const query = {
      groupId: group._id,
      visibility: 'group'
    };

    // Pagination
    if (before) {
      const beforeDate = new Date(before);
      if (!isNaN(beforeDate.getTime())) {
        query.createdAt = { $lt: beforeDate };
      }
    }

    // Fetch posts
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const posts = await Post.find(query)
      .populate('author', 'username displayName profilePhoto isVerified')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .lean();

    res.json({
      success: true,
      posts,
      groupId: group._id,
      groupSlug: group.slug
    });
  } catch (error) {
    console.error('Get group posts error:', error);
    res.status(500).json({ message: 'Failed to fetch posts' });
  }
});

export default router;

