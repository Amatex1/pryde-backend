/**
 * Phase 2: Group-only posting
 * Phase 4A: Group Ownership & Moderation
 * Phase 4B: Group Notifications (Quiet, Opt-in)
 * Phase 6A: Group Moderation (Calm Owner Controls)
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
 * MODERATION ENDPOINTS (Phase 4A + 6A):
 * - POST /api/groups/:slug/remove-member     - Remove a member (owner/moderator only)
 * - POST /api/groups/:slug/promote-moderator - Promote to moderator (owner only)
 * - POST /api/groups/:slug/demote-moderator  - Demote from moderator (owner only)
 * - GET  /api/groups/:slug/members           - Get member list (members only)
 * - POST /api/groups/:slug/mute-member       - Mute a member (owner/moderator only)
 * - POST /api/groups/:slug/unmute-member     - Unmute a member (owner/moderator only)
 * - POST /api/groups/:slug/block-user        - Block a user (owner/moderator only)
 * - POST /api/groups/:slug/unblock-user      - Unblock a user (owner/moderator only)
 * - POST /api/groups/:slug/posts/:postId/lock   - Lock a post (owner/moderator only)
 * - POST /api/groups/:slug/posts/:postId/unlock - Unlock a post (owner/moderator only)
 * - GET  /api/groups/:slug/moderation-log    - Get moderation log (owner/moderator only)
 *
 * NOTIFICATION ENDPOINTS (Phase 4B):
 * - GET  /api/groups/:slug/notification-settings - Get user's notification prefs
 * - PUT  /api/groups/:slug/notification-settings - Update notification prefs
 *
 * ISOLATION:
 * - Group posts are intentionally isolated from global feeds
 * - Group posts NEVER appear in /feed, /profile, bookmarks, search, or notifications
 * - All read/write operations verify membership on backend
 *
 * MODERATION PRINCIPLES:
 * - Groups moderate themselves
 * - Platform admins do NOT interfere unless reported
 * - Owner is immutable (cannot be removed)
 * - Moderator permissions are scoped to their group only
 * - Muted members can view but not post/comment
 * - Blocked users cannot request to join
 *
 * Tags are legacy entry points only.
 */

import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import Group from '../models/Group.js';
import Post from '../models/Post.js';
import User from '../models/User.js';
import GroupModerationLog from '../models/GroupModerationLog.js';
import { authenticateToken } from '../middleware/auth.js';
import { isGroupOwner, isGroupModerator, isGroupMember, canModerateGroup, getGroupMemberCount, isGroupMuted, isGroupBlocked, canPostInGroup } from '../utils/groupPermissions.js';
import { processGroupPostNotifications, updateGroupNotificationSettings, getGroupNotificationSettings } from '../services/groupNotificationService.js';
import logger from '../utils/logger.js';
import { processUserBadgesById } from '../services/autoBadgeService.js';
import { stripExifData } from '../middleware/imageProcessing.js';
import { Readable } from 'stream';

// Multer configuration for cover photo uploads
const storage = multer.memoryStorage();
const coverPhotoUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for cover photos
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
    }
  }
});

// GridFS bucket reference (initialized after connection)
let gridfsBucket;
mongoose.connection.once('open', () => {
  gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads'
  });
});

const router = express.Router();

/**
 * Phase 5A: Manual, Calm Group Discovery
 *
 * @route   GET /api/groups
 * @desc    List all groups (public listing)
 *          - Shows ONLY listed groups (visibility = 'listed' or 'public')
 *          - Plus user's own groups (any visibility)
 *          - Plus user's pending groups
 * @access  Private (authenticated)
 *
 * Query params:
 * - sort: 'alphabetical' (default), 'recent', 'active'
 *   NO trending/popular/recommended - intentionally excluded
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { sort = 'alphabetical' } = req.query;

    // Phase 5A: Only show LISTED groups (visibility = 'listed' or 'public')
    // Plus user's own groups regardless of visibility
    // Plus user's pending groups
    const groups = await Group.find({
      $and: [
        { status: { $ne: 'rejected' } },
        {
          $or: [
            // Listed groups (approved)
            {
              visibility: { $in: ['listed', 'public'] },
              status: 'approved'
            },
            // User's own groups (any visibility/status)
            { owner: userId },
            // Groups user is a member of (any visibility)
            { members: userId },
            { moderators: userId }
          ]
        }
      ]
    })
      .populate('owner', 'username displayName profilePhoto');

    // Phase 5A: Apply sorting (NO trending/popular/recommended)
    let sortedGroups = [...groups];
    switch (sort) {
      case 'recent':
        // Recently created
        sortedGroups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'active':
        // Recently active (updatedAt timestamp)
        sortedGroups.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        break;
      case 'alphabetical':
      default:
        // Alphabetical A-Z (default)
        sortedGroups.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    // Map groups with accurate membership status and role info
    const userIdStr = userId.toString();
    const groupsWithStatus = sortedGroups.map(group => {
      const ownerId = group.owner?._id?.toString() || group.owner?.toString();
      const isOwner = ownerId === userIdStr;
      const isModerator = group.moderators?.some(m =>
        (m._id?.toString() || m.toString()) === userIdStr
      );
      // CRITICAL FIX: Owner/moderator should ALWAYS be considered a member
      const isMemberFromMethod = group.isMember(userId);
      const isMember = isMemberFromMethod || isOwner || isModerator;
      const hasPendingRequest = group.hasPendingRequest(userId);

      // Determine user's role
      let role = null;
      if (isOwner) role = 'owner';
      else if (isModerator) role = 'moderator';
      else if (isMember) role = 'member';

      // Phase 5A: Normalize visibility for frontend
      const isListed = group.visibility === 'listed' || group.visibility === 'public';

      return {
        _id: group._id,
        slug: group.slug,
        name: group.name,
        description: group.description,
        coverPhoto: group.coverPhoto || null,
        visibility: isListed ? 'listed' : 'unlisted',
        joinMode: group.joinMode || 'approval',
        status: group.status,
        owner: group.owner,
        memberCount: group.members.length + group.moderators.length + 1,
        isMember,
        isOwner,
        isModerator,
        hasPendingRequest,
        role,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt
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

    // Phase 5A: Create group with new defaults
    // - visibility: 'listed' (appears in /groups index)
    // - joinMode: 'approval' (requires owner approval to join)
    const group = new Group({
      slug,
      name: trimmedName,
      description: description?.trim().substring(0, 500) || '',
      visibility: 'listed',  // Phase 5A default
      joinMode: 'approval',  // Phase 5A default
      status,
      owner: userId,
      members: [],
      moderators: [],
      joinRequests: []
    });

    await group.save();

    // BADGE SYSTEM: Process automatic badges after group creation (non-blocking)
    // This checks for group_organizer badge
    setImmediate(async () => {
      try {
        await processUserBadgesById(userId.toString());
      } catch (err) {
        logger.warn('Failed to process badges on group creation:', err.message);
      }
    });

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
 * Phase 5A: Edit group settings
 *
 * @route   PATCH /api/groups/:slug
 * @desc    Edit a group (owner only)
 * @access  Private (owner only)
 *
 * Supported fields:
 * - name: Group name
 * - description: Group description
 * - visibility: 'listed' or 'unlisted'
 * - joinMode: 'auto' or 'approval'
 */
router.patch('/:slug', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user.id || req.user._id;
    const { name, description, visibility, joinMode } = req.body;

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

    // Phase 5A: New visibility options (listed/unlisted)
    if (visibility !== undefined) {
      if (!['listed', 'unlisted'].includes(visibility)) {
        return res.status(400).json({ message: 'Visibility must be "listed" or "unlisted"' });
      }
      group.visibility = visibility;
    }

    // Phase 5A: Join mode (auto/approval)
    if (joinMode !== undefined) {
      if (!['auto', 'approval'].includes(joinMode)) {
        return res.status(400).json({ message: 'Join mode must be "auto" or "approval"' });
      }
      group.joinMode = joinMode;
    }

    await group.save();

    // Normalize visibility for response
    const isListed = group.visibility === 'listed' || group.visibility === 'public';

    res.json({
      success: true,
      message: 'Group updated successfully',
      group: {
        _id: group._id,
        slug: group.slug,
        name: group.name,
        description: group.description,
        visibility: isListed ? 'listed' : 'unlisted',
        joinMode: group.joinMode || 'approval',
        status: group.status,
        coverPhoto: group.coverPhoto
      }
    });

  } catch (error) {
    console.error('Edit group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/groups/:slug/cover-photo
 * @desc    Upload or update group cover photo (owner only)
 * @access  Private (owner only)
 */
router.post('/:slug/cover-photo', authenticateToken, coverPhotoUpload.single('coverPhoto'), async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user.id || req.user._id;

    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const group = await Group.findOne({ slug: slug.toLowerCase() });
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Only owner can update cover photo
    if (group.owner.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Only the group owner can update the cover photo' });
    }

    // Process image (strip EXIF data for privacy)
    let processedBuffer = req.file.buffer;
    let processedMimetype = req.file.mimetype;
    if (req.file.mimetype.startsWith('image/')) {
      try {
        const result = await stripExifData(req.file.buffer, req.file.mimetype);
        processedBuffer = result.buffer;
        processedMimetype = result.mimetype;
      } catch (err) {
        console.error('EXIF stripping failed, using original:', err.message);
      }
    }

    // Generate unique filename with correct extension based on processed mimetype
    const extension = processedMimetype.split('/')[1] || 'webp';
    const filename = `group-cover-${group._id}-${Date.now()}.${extension}`;

    // Delete old cover photo from GridFS if exists
    if (group.coverPhoto && gridfsBucket) {
      try {
        const oldFilename = group.coverPhoto.split('/').pop();
        const files = await gridfsBucket.find({ filename: oldFilename }).toArray();
        if (files.length > 0) {
          await gridfsBucket.delete(files[0]._id);
        }
      } catch (err) {
        console.error('Failed to delete old cover photo:', err.message);
      }
    }

    // Upload to GridFS
    if (!gridfsBucket) {
      return res.status(500).json({ message: 'Storage not available' });
    }

    const uploadStream = gridfsBucket.openUploadStream(filename, {
      contentType: processedMimetype,
      metadata: {
        uploadedBy: userId,
        groupId: group._id.toString(),
        type: 'group-cover'
      }
    });

    const readableStream = Readable.from(processedBuffer);
    readableStream.pipe(uploadStream);

    uploadStream.on('error', (error) => {
      console.error('GridFS upload error:', error);
      res.status(500).json({ message: 'Failed to upload cover photo' });
    });

    uploadStream.on('finish', async () => {
      // Update group with new cover photo URL
      // Use the correct upload route: /api/upload/file/:filename
      const coverPhotoUrl = `/upload/file/${filename}`;
      group.coverPhoto = coverPhotoUrl;
      await group.save();

      res.json({
        success: true,
        message: 'Cover photo updated successfully',
        coverPhoto: coverPhotoUrl
      });
    });

  } catch (error) {
    console.error('Cover photo upload error:', error);
    res.status(500).json({ message: 'Failed to upload cover photo' });
  }
});

/**
 * @route   DELETE /api/groups/:slug/cover-photo
 * @desc    Remove group cover photo (owner only)
 * @access  Private (owner only)
 */
router.delete('/:slug/cover-photo', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user.id || req.user._id;

    const group = await Group.findOne({ slug: slug.toLowerCase() });
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Only owner can remove cover photo
    if (group.owner.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Only the group owner can remove the cover photo' });
    }

    // Delete from GridFS if exists
    if (group.coverPhoto && gridfsBucket) {
      try {
        const filename = group.coverPhoto.split('/').pop();
        const files = await gridfsBucket.find({ filename }).toArray();
        if (files.length > 0) {
          await gridfsBucket.delete(files[0]._id);
        }
      } catch (err) {
        console.error('Failed to delete cover photo from GridFS:', err.message);
      }
    }

    group.coverPhoto = null;
    await group.save();

    res.json({
      success: true,
      message: 'Cover photo removed successfully'
    });

  } catch (error) {
    console.error('Cover photo delete error:', error);
    res.status(500).json({ message: 'Failed to remove cover photo' });
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
 * Phase 5A: Get group by slug
 *
 * @route   GET /api/groups/:slug
 * @desc    Get group by slug
 *          - Non-members: metadata only (name, description, join button)
 *          - Members: metadata + posts scoped to group
 * @access  Private (authenticated)
 *
 * Visibility rules (Phase 5A):
 * - Non-members CANNOT see: posts, member list, activity
 * - Non-members CAN see: name, description, privacy badge, join button
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

    // Accurate membership and role detection
    const ownerId = group.owner?._id?.toString() || group.owner?.toString();
    const userIdStr = userId.toString();
    const isOwner = ownerId === userIdStr;
    const isModerator = group.moderators?.some(m =>
      (m._id?.toString() || m.toString()) === userIdStr
    );

    // Check membership - owners and moderators are always considered members
    const isMemberFromMethod = group.isMember(userId);
    // CRITICAL FIX: Owner/moderator should ALWAYS be considered a member
    const isMember = isMemberFromMethod || isOwner || isModerator;
    const hasPendingRequest = group.hasPendingRequest(userId);

    // Accurate member count (owner counted separately, not in members array)
    const memberCount = group.members.length + group.moderators.length + 1;

    // Determine user's role in the group
    let role = null;
    if (isOwner) role = 'owner';
    else if (isModerator) role = 'moderator';
    else if (isMember) role = 'member';

    // Phase 5A: Normalize visibility for frontend
    const isListed = group.visibility === 'listed' || group.visibility === 'public';

    // Base response (visible to everyone - Phase 5A compliant)
    const response = {
      _id: group._id,
      slug: group.slug,
      name: group.name,
      description: group.description,
      coverPhoto: group.coverPhoto || null,
      visibility: isListed ? 'listed' : 'unlisted',
      joinMode: group.joinMode || 'approval',
      // Phase 5A: Only show owner name to non-members (no profile link)
      owner: isMember ? group.owner : { displayName: group.owner.displayName },
      // Phase 5A: Non-members don't see moderators list
      moderators: isMember ? group.moderators : [],
      memberCount,
      isMember,
      isOwner,
      isModerator,
      hasPendingRequest,
      role,
      createdAt: group.createdAt,
      // Phase 5A: Include pending request count for owners/mods
      pendingRequestCount: (isOwner || isModerator) ? (group.joinRequests?.length || 0) : undefined
    };

    // Phase 5A: If NOT a member, return metadata only - NO posts, NO member list
    if (!isMember) {
      return res.json({
        ...response,
        posts: null, // Explicitly null to indicate access denied
        members: null, // Phase 5A: Non-members cannot see member list
        message: 'Join this group to see posts'
      });
    }

    // Member - fetch posts scoped to this group
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
 * Phase 5A: Boundary-first join flow
 * - joinMode = 'auto': Immediate join
 * - joinMode = 'approval': Request sent, awaiting approval
 */
router.post('/:slug/join', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user.id;

    const group = await Group.findOne({ slug: slug.toLowerCase() });
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Phase 6A: Check if user is blocked from this group
    if (isGroupBlocked(userId, group)) {
      return res.status(403).json({
        message: 'You are not able to join this group',
        isBlocked: true
      });
    }

    const isOwner = group.owner.toString() === userId.toString();
    const isModerator = group.moderators?.some(m => m.toString() === userId.toString());
    const isMember = group.isMember(userId);
    const hasPendingRequest = group.hasPendingRequest(userId);

    // Already a member
    if (isMember) {
      const memberCount = group.members.length + group.moderators.length + 1;
      return res.json({
        success: true,
        message: isOwner ? 'You are the owner of this group' : 'You are already a member',
        isMember: true,
        isOwner,
        isModerator,
        hasPendingRequest: false,
        memberCount,
        slug: group.slug,
        name: group.name
      });
    }

    // Already has pending request
    if (hasPendingRequest) {
      const memberCount = group.members.length + group.moderators.length + 1;
      return res.json({
        success: true,
        message: 'Your request to join is pending approval',
        isMember: false,
        isOwner: false,
        hasPendingRequest: true,
        memberCount,
        slug: group.slug,
        name: group.name
      });
    }

    // Phase 5A: Check join mode
    const joinMode = group.joinMode || 'approval';

    if (joinMode === 'approval') {
      // Add to join requests (not members)
      await Group.findOneAndUpdate(
        { slug: slug.toLowerCase() },
        { $addToSet: { joinRequests: userId } }
      );

      const memberCount = group.members.length + group.moderators.length + 1;
      return res.json({
        success: true,
        status: 'pending', // For frontend compatibility
        message: 'Request sent! You\'ll be notified when approved.',
        isMember: false,
        isOwner: false,
        hasPendingRequest: true,
        memberCount,
        slug: group.slug,
        name: group.name,
        joinMode: 'approval'
      });
    }

    // Auto-join: Add to members immediately
    const updatedGroup = await Group.findOneAndUpdate(
      { slug: slug.toLowerCase() },
      { $addToSet: { members: userId } },
      { new: true }
    )
      .populate('owner', 'username displayName profilePhoto')
      .populate('moderators', 'username displayName profilePhoto');

    const memberCount = updatedGroup.members.length + updatedGroup.moderators.length + 1;

    res.json({
      success: true,
      message: `You joined ${updatedGroup.name}`,
      isMember: true,
      isOwner: false,
      hasPendingRequest: false,
      groupId: updatedGroup._id,
      slug: updatedGroup.slug,
      name: updatedGroup.name,
      description: updatedGroup.description,
      visibility: updatedGroup.visibility,
      joinMode: updatedGroup.joinMode || 'approval',
      owner: updatedGroup.owner,
      moderators: updatedGroup.moderators,
      memberCount,
      createdAt: updatedGroup.createdAt,
      posts: []
    });
  } catch (error) {
    console.error('Join group error:', error);
    res.status(500).json({ message: 'Failed to join group' });
  }
});

/**
 * Phase 5A: Get join requests for a group
 *
 * @route   GET /api/groups/:slug/requests
 * @desc    Get pending join requests (owner/moderator only)
 * @access  Private (owner/moderator)
 */
router.get('/:slug/requests', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user.id;

    const group = await Group.findOne({ slug: slug.toLowerCase() })
      .populate('joinRequests', 'username displayName profilePhoto');

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Only owner/moderators can view requests
    if (!group.canModerate(userId)) {
      return res.status(403).json({ message: 'Only owners and moderators can view join requests' });
    }

    res.json({
      requests: group.joinRequests || [],
      count: group.joinRequests?.length || 0
    });
  } catch (error) {
    console.error('Get join requests error:', error);
    res.status(500).json({ message: 'Failed to get join requests' });
  }
});

/**
 * Phase 5A: Approve a join request
 *
 * @route   POST /api/groups/:slug/requests/:userId/approve
 * @desc    Approve a user's join request
 * @access  Private (owner/moderator)
 */
router.post('/:slug/requests/:requestUserId/approve', authenticateToken, async (req, res) => {
  try {
    const { slug, requestUserId } = req.params;
    const userId = req.user.id;

    const group = await Group.findOne({ slug: slug.toLowerCase() });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Only owner/moderators can approve
    if (!group.canModerate(userId)) {
      return res.status(403).json({ message: 'Only owners and moderators can approve requests' });
    }

    // Check if request exists
    if (!group.hasPendingRequest(requestUserId)) {
      return res.status(400).json({ message: 'No pending request from this user' });
    }

    // Move from joinRequests to members
    await Group.findOneAndUpdate(
      { slug: slug.toLowerCase() },
      {
        $pull: { joinRequests: requestUserId },
        $addToSet: { members: requestUserId }
      }
    );

    // Phase 6A: Log moderation action
    await GroupModerationLog.create({
      groupId: group._id,
      actorId: userId,
      action: 'join_approved',
      targetUserId: requestUserId
    });

    res.json({
      success: true,
      message: 'User approved and added to group'
    });
  } catch (error) {
    console.error('Approve request error:', error);
    res.status(500).json({ message: 'Failed to approve request' });
  }
});

/**
 * Phase 5A: Reject a join request
 *
 * @route   POST /api/groups/:slug/requests/:userId/reject
 * @desc    Reject a user's join request
 * @access  Private (owner/moderator)
 */
router.post('/:slug/requests/:requestUserId/reject', authenticateToken, async (req, res) => {
  try {
    const { slug, requestUserId } = req.params;
    const userId = req.user.id;

    const group = await Group.findOne({ slug: slug.toLowerCase() });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Only owner/moderators can reject
    if (!group.canModerate(userId)) {
      return res.status(403).json({ message: 'Only owners and moderators can reject requests' });
    }

    // Remove from joinRequests
    await Group.findOneAndUpdate(
      { slug: slug.toLowerCase() },
      { $pull: { joinRequests: requestUserId } }
    );

    // Phase 6A: Log moderation action
    await GroupModerationLog.create({
      groupId: group._id,
      actorId: userId,
      action: 'join_declined',
      targetUserId: requestUserId
    });

    res.json({
      success: true,
      message: 'Request rejected'
    });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ message: 'Failed to reject request' });
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

    // Phase 6A: Check if user is muted
    const muteRecord = isGroupMuted(userId, group);
    if (muteRecord) {
      return res.status(403).json({
        message: 'You are currently unable to post in this group',
        isMuted: true,
        mutedUntil: muteRecord.mutedUntil
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

    // PHASE 4B: Trigger group notifications (async, non-blocking)
    // Notifications are opt-in and respect Quiet Mode
    processGroupPostNotifications({
      post,
      group,
      author: post.author
    }).catch(err => {
      logger.error('Failed to process group post notifications', { error: err.message });
    });

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
 * @desc    Delete a post in this group (author, owner, or moderator)
 * @access  Private (authenticated + member/owner/moderator)
 *
 * Phase 4A: Moderators can now delete posts within their group
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

    // Phase 4A: Use permission helpers for consistent checks
    const userIsOwner = isGroupOwner(userId, group);
    const userCanModerate = canModerateGroup(userId, group);

    // CRITICAL: Verify membership on backend (Phase 2A security assertion)
    // Non-moderators must be members to delete their own posts
    if (!userCanModerate && !isGroupMember(userId, group)) {
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

    // Phase 4A: Check permission - author, owner, OR moderator can delete
    const isAuthor = post.author.toString() === userId.toString();

    if (!isAuthor && !userCanModerate) {
      return res.status(403).json({ message: 'Only the author, owner, or moderator can delete this post' });
    }

    await Post.deleteOne({ _id: post._id });

    // Phase 6A: Log moderation action for moderator deletions
    if (!isAuthor && userCanModerate) {
      await GroupModerationLog.create({
        groupId: group._id,
        actorId: userId,
        action: 'post_deleted',
        targetPostId: postId,
        metadata: { authorId: post.author.toString() }
      });

      logger.info('Group post deleted by moderator', {
        groupId: group._id,
        groupSlug: group.slug,
        postId: postId,
        actorId: userId.toString(),
        actorRole: userIsOwner ? 'owner' : 'moderator',
        action: 'delete-post'
      });
    }

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    logger.error('Delete group post error:', error);
    res.status(500).json({ message: 'Failed to delete post' });
  }
});

// ============================================================================
// PHASE 4A: GROUP MODERATION ENDPOINTS
// ============================================================================

/**
 * @route   GET /api/groups/:slug/members
 * @desc    Get member list for a group (members only)
 * @access  Private (authenticated + member)
 */
router.get('/:slug/members', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user.id || req.user._id;

    const group = await Group.findOne({ slug: slug.toLowerCase() })
      .populate('owner', 'username displayName profilePhoto')
      .populate('moderators', 'username displayName profilePhoto')
      .populate('members', 'username displayName profilePhoto');

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Only members can see the member list
    if (!isGroupMember(userId, group)) {
      return res.status(403).json({ message: 'You must be a member to view the member list' });
    }

    // Phase 6A: Include muted member IDs for moderators
    let mutedMembers = [];
    if (canModerateGroup(userId, group)) {
      // Filter to active mutes only
      mutedMembers = (group.mutedMembers || [])
        .filter(m => !m.mutedUntil || new Date(m.mutedUntil) > new Date())
        .map(m => m.user.toString());
    }

    res.json({
      success: true,
      owner: group.owner,
      moderators: group.moderators || [],
      members: group.members || [],
      mutedMembers, // Phase 6A: Only for moderators
      memberCount: getGroupMemberCount(group)
    });
  } catch (error) {
    logger.error('Get group members error:', error);
    res.status(500).json({ message: 'Failed to fetch members' });
  }
});

/**
 * @route   POST /api/groups/:slug/remove-member
 * @desc    Remove a member from the group (owner or moderator only)
 * @access  Private (owner or moderator)
 *
 * RULES:
 * - Owner can remove anyone (except self)
 * - Moderator can remove regular members only (not other moderators or owner)
 * - Cannot remove owner
 */
router.post('/:slug/remove-member', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const actorId = req.user.id || req.user._id;
    const { userId: targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const group = await Group.findOne({ slug: slug.toLowerCase() });
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check actor has moderation privileges
    if (!canModerateGroup(actorId, group)) {
      return res.status(403).json({ message: 'You do not have permission to remove members' });
    }

    // CRITICAL: Cannot remove owner
    if (isGroupOwner(targetUserId, group)) {
      return res.status(400).json({ message: 'Cannot remove the group owner' });
    }

    // Moderators cannot remove other moderators (only owner can)
    if (!isGroupOwner(actorId, group) && isGroupModerator(targetUserId, group)) {
      return res.status(403).json({ message: 'Only the owner can remove moderators' });
    }

    // Remove from both members and moderators arrays (also remove any mutes)
    const updatedGroup = await Group.findOneAndUpdate(
      { slug: slug.toLowerCase() },
      {
        $pull: {
          members: targetUserId,
          moderators: targetUserId,
          mutedMembers: { user: targetUserId }
        }
      },
      { new: true }
    );

    // Phase 6A: Log moderation action
    await GroupModerationLog.create({
      groupId: group._id,
      actorId,
      action: 'member_removed',
      targetUserId
    });

    // Audit log
    logger.info('Group member removed', {
      groupId: group._id,
      groupSlug: group.slug,
      actorId: actorId.toString(),
      targetUserId: targetUserId,
      action: 'remove-member'
    });

    res.json({
      success: true,
      message: 'Member removed successfully',
      memberCount: getGroupMemberCount(updatedGroup)
    });
  } catch (error) {
    logger.error('Remove member error:', error);
    res.status(500).json({ message: 'Failed to remove member' });
  }
});

/**
 * @route   POST /api/groups/:slug/promote-moderator
 * @desc    Promote a member to moderator (owner only)
 * @access  Private (owner only)
 *
 * RULES:
 * - Only owner can promote
 * - Target must already be a member
 * - Cannot promote self (owner already has all privileges)
 */
router.post('/:slug/promote-moderator', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const actorId = req.user.id || req.user._id;
    const { userId: targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const group = await Group.findOne({ slug: slug.toLowerCase() });
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Only owner can promote
    if (!isGroupOwner(actorId, group)) {
      return res.status(403).json({ message: 'Only the owner can promote moderators' });
    }

    // Cannot promote owner (already has all privileges)
    if (isGroupOwner(targetUserId, group)) {
      return res.status(400).json({ message: 'Owner already has all moderator privileges' });
    }

    // Target must be a member
    if (!isGroupMember(targetUserId, group)) {
      return res.status(400).json({ message: 'User must be a member before becoming a moderator' });
    }

    // Already a moderator?
    if (isGroupModerator(targetUserId, group)) {
      return res.status(400).json({ message: 'User is already a moderator' });
    }

    // Add to moderators, remove from regular members
    await Group.findOneAndUpdate(
      { slug: slug.toLowerCase() },
      {
        $addToSet: { moderators: targetUserId },
        $pull: { members: targetUserId }
      }
    );

    // Phase 6A: Log moderation action
    await GroupModerationLog.create({
      groupId: group._id,
      actorId,
      action: 'moderator_promoted',
      targetUserId
    });

    // Audit log
    logger.info('Member promoted to moderator', {
      groupId: group._id,
      groupSlug: group.slug,
      actorId: actorId.toString(),
      targetUserId: targetUserId,
      action: 'promote-moderator'
    });

    res.json({
      success: true,
      message: 'Member promoted to moderator'
    });
  } catch (error) {
    logger.error('Promote moderator error:', error);
    res.status(500).json({ message: 'Failed to promote moderator' });
  }
});

/**
 * @route   POST /api/groups/:slug/demote-moderator
 * @desc    Demote a moderator to regular member (owner only)
 * @access  Private (owner only)
 *
 * RULES:
 * - Only owner can demote
 * - Cannot demote owner
 */
router.post('/:slug/demote-moderator', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const actorId = req.user.id || req.user._id;
    const { userId: targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const group = await Group.findOne({ slug: slug.toLowerCase() });
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Only owner can demote
    if (!isGroupOwner(actorId, group)) {
      return res.status(403).json({ message: 'Only the owner can demote moderators' });
    }

    // Cannot demote owner
    if (isGroupOwner(targetUserId, group)) {
      return res.status(400).json({ message: 'Cannot demote the group owner' });
    }

    // Target must be a moderator
    if (!isGroupModerator(targetUserId, group)) {
      return res.status(400).json({ message: 'User is not a moderator' });
    }

    // Remove from moderators, add back to members
    await Group.findOneAndUpdate(
      { slug: slug.toLowerCase() },
      {
        $pull: { moderators: targetUserId },
        $addToSet: { members: targetUserId }
      }
    );

    // Phase 6A: Log moderation action
    await GroupModerationLog.create({
      groupId: group._id,
      actorId,
      action: 'moderator_demoted',
      targetUserId
    });

    // Audit log
    logger.info('Moderator demoted to member', {
      groupId: group._id,
      groupSlug: group.slug,
      actorId: actorId.toString(),
      targetUserId: targetUserId,
      action: 'demote-moderator'
    });

    res.json({
      success: true,
      message: 'Moderator demoted to member'
    });
  } catch (error) {
    logger.error('Demote moderator error:', error);
    res.status(500).json({ message: 'Failed to demote moderator' });
  }
});

/**
 * PHASE 4B: Group Notifications (Quiet, Opt-in)
 *
 * @route   GET /api/groups/:slug/notification-settings
 * @desc    Get user's notification settings for this group
 * @access  Private (members only)
 */
router.get('/:slug/notification-settings', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user.id || req.user._id;

    const group = await Group.findOne({ slug: slug.toLowerCase() });
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Must be a member to see notification settings
    if (!isGroupMember(userId, group) && !isGroupOwner(userId, group) && !isGroupModerator(userId, group)) {
      return res.status(403).json({ message: 'You must be a member to manage notification settings' });
    }

    // Get user with their notification settings
    const user = await User.findById(userId).select('groupNotificationSettings');
    const settings = getGroupNotificationSettings(user, group._id.toString());

    res.json({
      success: true,
      settings: {
        notifyOnNewPost: settings.notifyOnNewPost,
        notifyOnMention: settings.notifyOnMention
      }
    });
  } catch (error) {
    logger.error('Get notification settings error:', error);
    res.status(500).json({ message: 'Failed to get notification settings' });
  }
});

/**
 * PHASE 4B: Group Notifications (Quiet, Opt-in)
 *
 * @route   PUT /api/groups/:slug/notification-settings
 * @desc    Update user's notification settings for this group
 * @access  Private (members only)
 *
 * Body: { notifyOnNewPost: boolean, notifyOnMention: boolean }
 */
router.put('/:slug/notification-settings', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user.id || req.user._id;
    const { notifyOnNewPost, notifyOnMention } = req.body;

    const group = await Group.findOne({ slug: slug.toLowerCase() });
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Must be a member to update notification settings
    if (!isGroupMember(userId, group) && !isGroupOwner(userId, group) && !isGroupModerator(userId, group)) {
      return res.status(403).json({ message: 'You must be a member to manage notification settings' });
    }

    // Update settings
    const updatedSettings = await updateGroupNotificationSettings(userId, group._id.toString(), {
      notifyOnNewPost,
      notifyOnMention
    });

    res.json({
      success: true,
      message: 'Notification settings updated',
      settings: {
        notifyOnNewPost: updatedSettings.notifyOnNewPost,
        notifyOnMention: updatedSettings.notifyOnMention
      }
    });
  } catch (error) {
    logger.error('Update notification settings error:', error);
    res.status(500).json({ message: 'Failed to update notification settings' });
  }
});

// ============================================================================
// PHASE 6A: CALM GROUP MODERATION ENDPOINTS
// ============================================================================

/**
 * @route   POST /api/groups/:slug/mute-member
 * @desc    Mute a member (can view but not post/comment)
 * @access  Private (owner or moderator)
 *
 * Body: { userId, duration? } - duration in hours (null = permanent)
 */
router.post('/:slug/mute-member', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const actorId = req.user.id || req.user._id;
    const { userId: targetUserId, duration } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const group = await Group.findOne({ slug: slug.toLowerCase() });
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check actor has moderation privileges
    if (!canModerateGroup(actorId, group)) {
      return res.status(403).json({ message: 'You do not have permission to mute members' });
    }

    // Cannot mute owner
    if (isGroupOwner(targetUserId, group)) {
      return res.status(400).json({ message: 'Cannot mute the group owner' });
    }

    // Moderators cannot mute other moderators (only owner can)
    if (!isGroupOwner(actorId, group) && isGroupModerator(targetUserId, group)) {
      return res.status(403).json({ message: 'Only the owner can mute moderators' });
    }

    // Target must be a member
    if (!isGroupMember(targetUserId, group)) {
      return res.status(400).json({ message: 'User is not a member of this group' });
    }

    // Calculate mute duration
    let mutedUntil = null;
    if (duration && typeof duration === 'number' && duration > 0) {
      mutedUntil = new Date(Date.now() + duration * 60 * 60 * 1000);
    }

    // Remove existing mute if any, then add new one
    await Group.findOneAndUpdate(
      { slug: slug.toLowerCase() },
      {
        $pull: { mutedMembers: { user: targetUserId } }
      }
    );

    await Group.findOneAndUpdate(
      { slug: slug.toLowerCase() },
      {
        $push: {
          mutedMembers: {
            user: targetUserId,
            mutedAt: new Date(),
            mutedUntil,
            mutedBy: actorId
          }
        }
      }
    );

    // Log moderation action
    await GroupModerationLog.create({
      groupId: group._id,
      actorId,
      action: 'member_muted',
      targetUserId,
      metadata: { duration, mutedUntil }
    });

    logger.info('Member muted', {
      groupId: group._id,
      groupSlug: group.slug,
      actorId: actorId.toString(),
      targetUserId,
      duration,
      action: 'mute-member'
    });

    res.json({
      success: true,
      message: mutedUntil
        ? `Member muted until ${mutedUntil.toISOString()}`
        : 'Member muted indefinitely'
    });
  } catch (error) {
    logger.error('Mute member error:', error);
    res.status(500).json({ message: 'Failed to mute member' });
  }
});

/**
 * @route   POST /api/groups/:slug/unmute-member
 * @desc    Unmute a member
 * @access  Private (owner or moderator)
 */
router.post('/:slug/unmute-member', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const actorId = req.user.id || req.user._id;
    const { userId: targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const group = await Group.findOne({ slug: slug.toLowerCase() });
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check actor has moderation privileges
    if (!canModerateGroup(actorId, group)) {
      return res.status(403).json({ message: 'You do not have permission to unmute members' });
    }

    // Remove from muted list
    await Group.findOneAndUpdate(
      { slug: slug.toLowerCase() },
      { $pull: { mutedMembers: { user: targetUserId } } }
    );

    // Log moderation action
    await GroupModerationLog.create({
      groupId: group._id,
      actorId,
      action: 'member_unmuted',
      targetUserId
    });

    res.json({
      success: true,
      message: 'Member unmuted'
    });
  } catch (error) {
    logger.error('Unmute member error:', error);
    res.status(500).json({ message: 'Failed to unmute member' });
  }
});

/**
 * @route   POST /api/groups/:slug/block-user
 * @desc    Block a user from joining the group
 * @access  Private (owner or moderator)
 */
router.post('/:slug/block-user', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const actorId = req.user.id || req.user._id;
    const { userId: targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const group = await Group.findOne({ slug: slug.toLowerCase() });
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check actor has moderation privileges
    if (!canModerateGroup(actorId, group)) {
      return res.status(403).json({ message: 'You do not have permission to block users' });
    }

    // Cannot block owner
    if (isGroupOwner(targetUserId, group)) {
      return res.status(400).json({ message: 'Cannot block the group owner' });
    }

    // Add to blocked list (also remove from members/moderators/joinRequests)
    await Group.findOneAndUpdate(
      { slug: slug.toLowerCase() },
      {
        $addToSet: { blockedUsers: targetUserId },
        $pull: {
          members: targetUserId,
          moderators: targetUserId,
          joinRequests: targetUserId
        }
      }
    );

    // Log moderation action
    await GroupModerationLog.create({
      groupId: group._id,
      actorId,
      action: 'member_blocked',
      targetUserId
    });

    res.json({
      success: true,
      message: 'User blocked from this group'
    });
  } catch (error) {
    logger.error('Block user error:', error);
    res.status(500).json({ message: 'Failed to block user' });
  }
});

/**
 * @route   POST /api/groups/:slug/unblock-user
 * @desc    Unblock a user (allow them to request to join again)
 * @access  Private (owner or moderator)
 */
router.post('/:slug/unblock-user', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const actorId = req.user.id || req.user._id;
    const { userId: targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const group = await Group.findOne({ slug: slug.toLowerCase() });
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check actor has moderation privileges
    if (!canModerateGroup(actorId, group)) {
      return res.status(403).json({ message: 'You do not have permission to unblock users' });
    }

    // Remove from blocked list
    await Group.findOneAndUpdate(
      { slug: slug.toLowerCase() },
      { $pull: { blockedUsers: targetUserId } }
    );

    // Log moderation action
    await GroupModerationLog.create({
      groupId: group._id,
      actorId,
      action: 'member_unblocked',
      targetUserId
    });

    res.json({
      success: true,
      message: 'User unblocked'
    });
  } catch (error) {
    logger.error('Unblock user error:', error);
    res.status(500).json({ message: 'Failed to unblock user' });
  }
});

/**
 * @route   POST /api/groups/:slug/posts/:postId/lock
 * @desc    Lock a post (disable replies)
 * @access  Private (owner or moderator)
 */
router.post('/:slug/posts/:postId/lock', authenticateToken, async (req, res) => {
  try {
    const { slug, postId } = req.params;
    const actorId = req.user.id || req.user._id;

    const group = await Group.findOne({ slug: slug.toLowerCase() });
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check actor has moderation privileges
    if (!canModerateGroup(actorId, group)) {
      return res.status(403).json({ message: 'You do not have permission to lock posts' });
    }

    // Find and verify post belongs to this group
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (!post.groupId || post.groupId.toString() !== group._id.toString()) {
      return res.status(404).json({ message: 'Post not found in this group' });
    }

    // Lock the post
    post.isLocked = true;
    post.lockedAt = new Date();
    post.lockedBy = actorId;
    await post.save();

    // Log moderation action
    await GroupModerationLog.create({
      groupId: group._id,
      actorId,
      action: 'post_locked',
      targetPostId: postId
    });

    res.json({
      success: true,
      message: 'Post locked'
    });
  } catch (error) {
    logger.error('Lock post error:', error);
    res.status(500).json({ message: 'Failed to lock post' });
  }
});

/**
 * @route   POST /api/groups/:slug/posts/:postId/unlock
 * @desc    Unlock a post (enable replies)
 * @access  Private (owner or moderator)
 */
router.post('/:slug/posts/:postId/unlock', authenticateToken, async (req, res) => {
  try {
    const { slug, postId } = req.params;
    const actorId = req.user.id || req.user._id;

    const group = await Group.findOne({ slug: slug.toLowerCase() });
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check actor has moderation privileges
    if (!canModerateGroup(actorId, group)) {
      return res.status(403).json({ message: 'You do not have permission to unlock posts' });
    }

    // Find and verify post belongs to this group
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (!post.groupId || post.groupId.toString() !== group._id.toString()) {
      return res.status(404).json({ message: 'Post not found in this group' });
    }

    // Unlock the post
    post.isLocked = false;
    post.lockedAt = null;
    post.lockedBy = null;
    await post.save();

    // Log moderation action
    await GroupModerationLog.create({
      groupId: group._id,
      actorId,
      action: 'post_unlocked',
      targetPostId: postId
    });

    res.json({
      success: true,
      message: 'Post unlocked'
    });
  } catch (error) {
    logger.error('Unlock post error:', error);
    res.status(500).json({ message: 'Failed to unlock post' });
  }
});

/**
 * @route   GET /api/groups/:slug/moderation-log
 * @desc    Get moderation log for a group (owner/moderator only)
 * @access  Private (owner or moderator)
 *
 * Query params:
 * - limit: Number of entries (default 50, max 100)
 * - before: Cursor for pagination (ISO date string)
 */
router.get('/:slug/moderation-log', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user.id || req.user._id;
    const { limit = 50, before } = req.query;

    const group = await Group.findOne({ slug: slug.toLowerCase() });
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Only owner/moderators can view moderation log
    if (!canModerateGroup(userId, group)) {
      return res.status(403).json({ message: 'Only owners and moderators can view the moderation log' });
    }

    // Build query
    const query = { groupId: group._id };
    if (before) {
      const beforeDate = new Date(before);
      if (!isNaN(beforeDate.getTime())) {
        query.createdAt = { $lt: beforeDate };
      }
    }

    // Fetch logs
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const logs = await GroupModerationLog.find(query)
      .populate('actorId', 'username displayName profilePhoto')
      .populate('targetUserId', 'username displayName profilePhoto')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .lean();

    res.json({
      success: true,
      logs,
      hasMore: logs.length === limitNum
    });
  } catch (error) {
    logger.error('Get moderation log error:', error);
    res.status(500).json({ message: 'Failed to fetch moderation log' });
  }
});

/**
 * @route   GET /api/groups/:slug/blocked-users
 * @desc    Get list of blocked users (owner/moderator only)
 * @access  Private (owner or moderator)
 */
router.get('/:slug/blocked-users', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user.id || req.user._id;

    const group = await Group.findOne({ slug: slug.toLowerCase() })
      .populate('blockedUsers', 'username displayName profilePhoto');

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Only owner/moderators can view blocked users
    if (!canModerateGroup(userId, group)) {
      return res.status(403).json({ message: 'Only owners and moderators can view blocked users' });
    }

    res.json({
      success: true,
      blockedUsers: group.blockedUsers || []
    });
  } catch (error) {
    logger.error('Get blocked users error:', error);
    res.status(500).json({ message: 'Failed to fetch blocked users' });
  }
});

/**
 * @route   GET /api/groups/:slug/muted-members
 * @desc    Get list of muted members (owner/moderator only)
 * @access  Private (owner or moderator)
 */
router.get('/:slug/muted-members', authenticateToken, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user.id || req.user._id;

    const group = await Group.findOne({ slug: slug.toLowerCase() })
      .populate('mutedMembers.user', 'username displayName profilePhoto')
      .populate('mutedMembers.mutedBy', 'username displayName');

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Only owner/moderators can view muted members
    if (!canModerateGroup(userId, group)) {
      return res.status(403).json({ message: 'Only owners and moderators can view muted members' });
    }

    // Filter out expired mutes
    const activeMutes = (group.mutedMembers || []).filter(m => {
      if (!m.mutedUntil) return true; // Permanent mute
      return new Date(m.mutedUntil) > new Date(); // Not expired
    });

    res.json({
      success: true,
      mutedMembers: activeMutes
    });
  } catch (error) {
    logger.error('Get muted members error:', error);
    res.status(500).json({ message: 'Failed to fetch muted members' });
  }
});

export default router;

