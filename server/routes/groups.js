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
    const userId = req.user.id || req.user._id;

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

    // Phase 2C: Map groups with accurate membership status and role info
    const userIdStr = userId.toString();
    const groupsWithStatus = groups.map(group => {
      // Handle owner ID comparison safely (owner could be populated or just ObjectId)
      const ownerId = group.owner?._id?.toString() || group.owner?.toString();
      const isOwner = ownerId === userIdStr;
      const isModerator = group.moderators?.some(m =>
        (m._id?.toString() || m.toString()) === userIdStr
      );
      const isMember = group.isMember(userId);

      // Determine user's role
      let role = null;
      if (isOwner) role = 'owner';
      else if (isModerator) role = 'moderator';
      else if (isMember) role = 'member';

      return {
        _id: group._id,
        slug: group.slug,
        name: group.name,
        description: group.description,
        visibility: group.visibility,
        status: group.status,
        owner: group.owner,
        memberCount: group.members.length + group.moderators.length + 1,
        isMember,
        isOwner,
        isModerator,
        role,
        createdAt: group.createdAt
      };
    });

    res.json({ groups: groupsWithStatus });
  } catch (error) {
    console.error('List groups error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/groups
 * @desc    Create a new group
 *          - super_admin: auto-approved
 *          - everyone else: requires admin approval
 * @access  Private (authenticated)
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const userRole = req.user.role;
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

    // Super admins get auto-approved, everyone else needs approval
    const isSuperAdmin = userRole === 'super_admin';
    const status = isSuperAdmin ? 'approved' : 'pending';

    // Create group
    const group = new Group({
      slug,
      name: trimmedName,
      description: description?.trim().substring(0, 500) || '',
      visibility: 'private',
      status,
      owner: userId,
      members: [],
      moderators: []
    });

    await group.save();

    const message = isSuperAdmin
      ? 'Group created successfully'
      : 'Group submitted for approval';

    res.status(201).json({
      success: true,
      message,
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
 * @route   PATCH /api/groups/:slug
 * @desc    Edit a group (owner only)
 * @access  Private (owner only)
 */
router.patch('/:slug', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user.id || req.user._id;
    const { name, description, visibility } = req.body;

    const group = await Group.findOne({ slug });
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Only owner can edit
    if (group.owner.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Only the group owner can edit this group' });
    }

    // Update fields if provided
    if (name !== undefined) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return res.status(400).json({ message: 'Group name cannot be empty' });
      }
      if (trimmedName.length > 100) {
        return res.status(400).json({ message: 'Group name must be 100 characters or less' });
      }
      group.name = trimmedName;
    }

    if (description !== undefined) {
      group.description = description.trim().substring(0, 500);
    }

    if (visibility !== undefined) {
      if (!['private', 'public', 'hidden'].includes(visibility)) {
        return res.status(400).json({ message: 'Invalid visibility option' });
      }
      group.visibility = visibility;
    }

    await group.save();

    res.json({
      success: true,
      message: 'Group updated successfully',
      group: {
        _id: group._id,
        slug: group.slug,
        name: group.name,
        description: group.description,
        visibility: group.visibility,
        status: group.status
      }
    });

  } catch (error) {
    console.error('Edit group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   DELETE /api/groups/:slug
 * @desc    Delete a group (owner only)
 * @access  Private (owner only)
 */
router.delete('/:slug', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user.id || req.user._id;

    const group = await Group.findOne({ slug });
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Only owner can delete
    if (group.owner.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Only the group owner can delete this group' });
    }

    // Delete all posts in this group
    await Post.deleteMany({ group: group._id });

    // Delete the group
    await Group.deleteOne({ _id: group._id });

    res.json({
      success: true,
      message: 'Group deleted successfully'
    });

  } catch (error) {
    console.error('Delete group error:', error);
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

    // Phase 2C: Accurate membership and role detection
    const ownerId = group.owner?._id?.toString() || group.owner?.toString();
    const userIdStr = userId.toString();
    const isOwner = ownerId === userIdStr;
    const isModerator = group.moderators?.some(m =>
      (m._id?.toString() || m.toString()) === userIdStr
    );
    const isMember = group.isMember(userId);

    // Phase 2C: Accurate member count (owner counted separately, not in members array)
    const memberCount = group.members.length + group.moderators.length + 1; // +1 for owner

    // Determine user's role in the group
    let role = null;
    if (isOwner) role = 'owner';
    else if (isModerator) role = 'moderator';
    else if (isMember) role = 'member';

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
      isOwner,
      isModerator,
      role,
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
 *
 * Phase 2C: Fixed member count logic
 * - Owner is NOT added to members array (they're already the owner)
 * - Uses $addToSet for idempotent, deduplicated membership
 */
router.post('/:slug/join', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user.id;

    // First check if user is the owner (owners don't need to join)
    const existingGroup = await Group.findOne({ slug: slug.toLowerCase() });
    if (!existingGroup) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isOwner = existingGroup.owner.toString() === userId.toString();

    // If owner, just return success without modifying members array
    if (isOwner) {
      const memberCount = existingGroup.members.length + existingGroup.moderators.length + 1;
      return res.json({
        success: true,
        message: 'You are the owner of this group',
        isMember: true,
        isOwner: true,
        memberCount,
        slug: existingGroup.slug,
        name: existingGroup.name
      });
    }

    // Use $addToSet for idempotent membership addition (no duplicates)
    // findOneAndUpdate is atomic and returns the updated document
    const group = await Group.findOneAndUpdate(
      { slug: slug.toLowerCase() },
      { $addToSet: { members: userId } },
      { new: true }
    )
      .populate('owner', 'username displayName profilePhoto')
      .populate('moderators', 'username displayName profilePhoto');

    // Calculate member count: unique members + moderators + 1 (owner)
    // Owner is separate, never in members array
    const memberCount = group.members.length + group.moderators.length + 1;

    res.json({
      success: true,
      message: `You joined ${group.name}`,
      isMember: true,
      isOwner: false,
      groupId: group._id,
      slug: group.slug,
      name: group.name,
      description: group.description,
      visibility: group.visibility,
      owner: group.owner,
      moderators: group.moderators,
      memberCount,
      createdAt: group.createdAt,
      posts: [] // Posts will be fetched separately
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
 *
 * Phase 2C: Enhanced feedback
 * - Returns updated memberCount for accurate UI
 * - Owner cannot leave (shown clear message)
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
    if (group.owner.toString() === userId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'As the owner, you cannot leave this group. Transfer ownership or delete the group instead.',
        isOwner: true
      });
    }

    // Use $pull for atomic removal from both arrays
    // Return the updated document to get accurate member count
    const updatedGroup = await Group.findOneAndUpdate(
      { slug: slug.toLowerCase() },
      {
        $pull: {
          members: userId,
          moderators: userId
        }
      },
      { new: true }
    );

    // Calculate updated member count
    const memberCount = updatedGroup.members.length + updatedGroup.moderators.length + 1;

    res.json({
      success: true,
      message: `You left ${group.name}`,
      isMember: false,
      slug: group.slug,
      name: group.name,
      memberCount
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

/**
 * @route   PATCH /api/groups/:slug/posts/:postId
 * @desc    Edit a post in this group (author only)
 * @access  Private (authenticated + author)
 */
router.patch('/:slug/posts/:postId', authenticateToken, async (req, res) => {
  try {
    const { slug, postId } = req.params;
    const userId = req.user.id || req.user._id;
    const { content, media, contentWarning } = req.body;

    // Find group
    const group = await Group.findOne({ slug: slug.toLowerCase() });
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // CRITICAL: Verify membership on backend (Phase 2A security assertion)
    if (!group.isMember(userId)) {
      return res.status(403).json({
        message: 'You must be a member to edit posts in this group'
      });
    }

    // Find post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Verify post belongs to this group
    if (!post.groupId || post.groupId.toString() !== group._id.toString()) {
      return res.status(404).json({ message: 'Post not found in this group' });
    }

    // Only author can edit
    if (post.author.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Only the author can edit this post' });
    }

    // Update fields
    if (content !== undefined) {
      post.content = content;
    }
    if (media !== undefined) {
      post.media = media;
    }
    if (contentWarning !== undefined) {
      post.contentWarning = contentWarning;
    }

    // Validate: must have content or media
    if ((!post.content || post.content.trim() === '') && (!post.media || post.media.length === 0)) {
      return res.status(400).json({ message: 'Post must have content or media' });
    }

    await post.save();
    await post.populate('author', 'username displayName profilePhoto isVerified');

    res.json({
      success: true,
      message: 'Post updated successfully',
      post: post.toObject()
    });
  } catch (error) {
    console.error('Edit group post error:', error);
    res.status(500).json({ message: 'Failed to update post' });
  }
});

/**
 * @route   DELETE /api/groups/:slug/posts/:postId
 * @desc    Delete a post in this group (author or group owner)
 * @access  Private (authenticated + member/owner)
 */
router.delete('/:slug/posts/:postId', authenticateToken, async (req, res) => {
  try {
    const { slug, postId } = req.params;
    const userId = req.user.id || req.user._id;

    // Find group
    const group = await Group.findOne({ slug: slug.toLowerCase() });
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is group owner (can delete any post even if not member)
    const ownerId = group.owner?._id?.toString() || group.owner?.toString();
    const isGroupOwner = ownerId === userId.toString();

    // CRITICAL: Verify membership on backend (Phase 2A security assertion)
    // Non-owners must be members to delete their own posts
    if (!isGroupOwner && !group.isMember(userId)) {
      return res.status(403).json({
        message: 'You must be a member to delete posts in this group'
      });
    }

    // Find post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Verify post belongs to this group
    if (!post.groupId || post.groupId.toString() !== group._id.toString()) {
      return res.status(404).json({ message: 'Post not found in this group' });
    }

    // Check permission: author or group owner can delete
    const isAuthor = post.author.toString() === userId.toString();

    if (!isAuthor && !isGroupOwner) {
      return res.status(403).json({ message: 'Only the author or group owner can delete this post' });
    }

    await Post.deleteOne({ _id: post._id });

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    console.error('Delete group post error:', error);
    res.status(500).json({ message: 'Failed to delete post' });
  }
});

export default router;

