/**
 * Life-Signal Feature 4: Small Circles (Micro-Communities)
 * 
 * Intimate groups with 20 member limit, invite-only.
 * - Separate feed per circle (not in global feed)
 * - No discovery algorithm, no public metrics
 */

import express from 'express';
import Circle from '../models/Circle.js';
import CircleMember from '../models/CircleMember.js';
import Post from '../models/Post.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import { sanitizeFields } from '../middleware/sanitize.js';
import { validateParamId } from '../middleware/validation.js';

const router = express.Router();

// @route   GET /api/circles
// @desc    Get circles the current user is a member of
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const memberships = await CircleMember.find({ user: req.user.id })
      .populate('circle')
      .sort({ joinedAt: -1 });
    
    const circles = await Promise.all(
      memberships.map(async (m) => {
        const memberCount = await CircleMember.countDocuments({ circle: m.circle._id });
        return {
          ...m.circle.toObject(),
          role: m.role,
          memberCount,
          joinedAt: m.joinedAt
        };
      })
    );
    
    res.json(circles.filter(c => c)); // Filter out null circles
  } catch (error) {
    console.error('Get circles error:', error);
    res.status(500).json({ message: 'Failed to fetch circles' });
  }
});

// @route   POST /api/circles
// @desc    Create a new circle
// @access  Private
router.post('/', authenticateToken, sanitizeFields(['name', 'intent', 'rules']), async (req, res) => {
  try {
    const { name, intent, rules, memberLimit } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: 'Circle name is required' });
    }
    
    if (!intent || intent.trim().length === 0) {
      return res.status(400).json({ message: 'Intent statement is required' });
    }
    
    const circle = new Circle({
      name: name.trim(),
      intent: intent.trim(),
      rules: rules?.trim() || '',
      owner: req.user.id,
      memberLimit: Math.min(memberLimit || 20, 20) // Cap at 20
    });
    
    await circle.save();
    
    // Add owner as first member
    await CircleMember.create({
      circle: circle._id,
      user: req.user.id,
      role: 'owner'
    });
    
    res.status(201).json({ ...circle.toObject(), memberCount: 1 });
  } catch (error) {
    console.error('Create circle error:', error);
    res.status(500).json({ message: 'Failed to create circle' });
  }
});

// @route   GET /api/circles/:id
// @desc    Get a circle's details
// @access  Private (members only)
router.get('/:id', authenticateToken, validateParamId('id'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check membership
    const membership = await CircleMember.findOne({ circle: id, user: req.user.id });
    if (!membership) {
      return res.status(403).json({ message: 'You are not a member of this circle' });
    }
    
    const circle = await Circle.findById(id)
      .populate('owner', 'username displayName profilePhoto');
    
    if (!circle) {
      return res.status(404).json({ message: 'Circle not found' });
    }
    
    // Get members
    const members = await CircleMember.find({ circle: id })
      .populate('user', 'username displayName profilePhoto presenceState presenceVisible')
      .sort({ joinedAt: 1 });
    
    res.json({
      circle,
      members: members.map(m => ({
        user: m.user,
        role: m.role,
        joinedAt: m.joinedAt
      })),
      userRole: membership.role
    });
  } catch (error) {
    console.error('Get circle error:', error);
    res.status(500).json({ message: 'Failed to fetch circle' });
  }
});

// @route   POST /api/circles/:id/invite
// @desc    Invite a user to the circle
// @access  Private (owner/member)
router.post('/:id/invite', authenticateToken, validateParamId('id'), async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    // Check inviter's membership
    const inviterMembership = await CircleMember.findOne({ circle: id, user: req.user.id });
    if (!inviterMembership) {
      return res.status(403).json({ message: 'You are not a member of this circle' });
    }
    
    const circle = await Circle.findById(id);
    if (!circle) {
      return res.status(404).json({ message: 'Circle not found' });
    }
    
    // Check member limit
    const memberCount = await CircleMember.countDocuments({ circle: id });
    if (memberCount >= circle.memberLimit) {
      return res.status(400).json({ message: 'Circle has reached its member limit' });
    }
    
    // Check if already a member
    const existingMembership = await CircleMember.findOne({ circle: id, user: userId });
    if (existingMembership) {
      return res.status(400).json({ message: 'User is already a member' });
    }
    
    // Get inviter info for notification
    const inviter = await User.findById(req.user.id).select('username displayName');
    
    // Send invitation notification
    await Notification.create({
      recipient: userId,
      sender: req.user.id,
      type: 'circle_invite',
      message: `${inviter.displayName || inviter.username} invited you to join "${circle.name}"`,
      circleId: circle._id,
      circleName: circle.name
    });

    res.json({ message: 'Invitation sent' });
  } catch (error) {
    console.error('Invite to circle error:', error);
    res.status(500).json({ message: 'Failed to send invitation' });
  }
});

// @route   POST /api/circles/:id/join
// @desc    Accept an invitation and join a circle
// @access  Private
router.post('/:id/join', authenticateToken, validateParamId('id'), async (req, res) => {
  try {
    const { id } = req.params;

    const circle = await Circle.findById(id);
    if (!circle) {
      return res.status(404).json({ message: 'Circle not found' });
    }

    // Check if already a member
    const existingMembership = await CircleMember.findOne({ circle: id, user: req.user.id });
    if (existingMembership) {
      return res.status(400).json({ message: 'Already a member' });
    }

    // Check member limit
    const memberCount = await CircleMember.countDocuments({ circle: id });
    if (memberCount >= circle.memberLimit) {
      return res.status(400).json({ message: 'Circle is full' });
    }

    // Join the circle
    await CircleMember.create({
      circle: id,
      user: req.user.id,
      role: 'member'
    });

    res.json({ message: 'Joined circle successfully' });
  } catch (error) {
    console.error('Join circle error:', error);
    res.status(500).json({ message: 'Failed to join circle' });
  }
});

// @route   POST /api/circles/:id/leave
// @desc    Leave a circle
// @access  Private
router.post('/:id/leave', authenticateToken, validateParamId('id'), async (req, res) => {
  try {
    const { id } = req.params;

    const membership = await CircleMember.findOne({ circle: id, user: req.user.id });
    if (!membership) {
      return res.status(400).json({ message: 'Not a member of this circle' });
    }

    // Owner cannot leave (must delete circle)
    if (membership.role === 'owner') {
      return res.status(400).json({ message: 'Owners cannot leave. Delete the circle instead.' });
    }

    await CircleMember.findByIdAndDelete(membership._id);

    res.json({ message: 'Left circle successfully' });
  } catch (error) {
    console.error('Leave circle error:', error);
    res.status(500).json({ message: 'Failed to leave circle' });
  }
});

// @route   GET /api/circles/:id/feed
// @desc    Get posts in a circle's feed
// @access  Private (members only)
router.get('/:id/feed', authenticateToken, validateParamId('id'), async (req, res) => {
  try {
    const { id } = req.params;
    const { cursor, limit = 20 } = req.query;

    // Check membership
    const membership = await CircleMember.findOne({ circle: id, user: req.user.id });
    if (!membership) {
      return res.status(403).json({ message: 'You are not a member of this circle' });
    }

    // Build query
    const query = { circleId: id };
    if (cursor) {
      query.createdAt = { $lt: new Date(cursor) };
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('author', 'username displayName profilePhoto presenceState presenceVisible');

    // Update last viewed
    membership.lastViewedAt = Date.now();
    await membership.save();

    // Update circle activity
    await Circle.findByIdAndUpdate(id, { lastActivityAt: Date.now() });

    res.json({
      posts,
      nextCursor: posts.length ? posts[posts.length - 1].createdAt.toISOString() : null
    });
  } catch (error) {
    console.error('Get circle feed error:', error);
    res.status(500).json({ message: 'Failed to fetch circle feed' });
  }
});

// @route   DELETE /api/circles/:id
// @desc    Delete a circle (owner only)
// @access  Private
router.delete('/:id', authenticateToken, validateParamId('id'), async (req, res) => {
  try {
    const { id } = req.params;

    const circle = await Circle.findById(id);
    if (!circle) {
      return res.status(404).json({ message: 'Circle not found' });
    }

    if (circle.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the owner can delete the circle' });
    }

    // Delete all memberships
    await CircleMember.deleteMany({ circle: id });

    // Delete circle posts (or orphan them - for now, orphan)
    await Post.updateMany({ circleId: id }, { circleId: null, visibility: 'private' });

    // Delete circle
    await Circle.findByIdAndDelete(id);

    res.json({ message: 'Circle deleted' });
  } catch (error) {
    console.error('Delete circle error:', error);
    res.status(500).json({ message: 'Failed to delete circle' });
  }
});

export default router;

