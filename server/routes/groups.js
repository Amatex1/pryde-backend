/**
 * Migration Phase: TAGS → GROUPS (Phase 0 - Foundation)
 * 
 * Group Routes - Private, join-gated community groups
 * 
 * ENDPOINTS:
 * - GET  /api/groups/:slug       - Get group (metadata for all, posts only for members)
 * - POST /api/groups/:slug/join  - Join a group (idempotent)
 * - POST /api/groups/:slug/leave - Leave a group
 * 
 * NO discovery endpoints.
 * NO trending.
 * NO public listing.
 * 
 * NOTE: Tags are still legacy-active. These routes are isolated and additive.
 */

import express from 'express';
import Group from '../models/Group.js';
import Post from '../models/Post.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

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

    // Find group by slug
    const group = await Group.findOne({ slug })
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

    // Member: fetch posts scoped to this group
    // Migration Phase: For now, we don't have groupId on posts yet
    // This will be populated in future migration phases
    // For Phase 0, return empty array (no posts in new groups yet)
    const posts = []; // TODO: Phase 1+ will add Post.find({ groupId: group._id })

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

    const group = await Group.findOne({ slug });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if already a member (idempotent)
    if (group.isMember(userId)) {
      return res.json({ 
        message: 'Already a member',
        isMember: true 
      });
    }

    // Add to members array
    group.members.push(userId);
    await group.save();

    res.json({ 
      message: 'Successfully joined group',
      isMember: true
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

    const group = await Group.findOne({ slug });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Owner cannot leave (must transfer ownership first)
    if (group.owner.toString() === userId) {
      return res.status(400).json({ 
        message: 'Owner cannot leave group. Transfer ownership first.' 
      });
    }

    // Remove from members and moderators
    group.members = group.members.filter(m => m.toString() !== userId);
    group.moderators = group.moderators.filter(m => m.toString() !== userId);
    await group.save();

    res.json({ 
      message: 'Left group successfully',
      isMember: false
    });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ message: 'Failed to leave group' });
  }
});

export default router;

