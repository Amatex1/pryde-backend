import express from 'express';
const router = express.Router();
import GroupChat from '../models/GroupChat.js';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import auth from '../middleware/auth.js';

// Create a new group chat
router.post('/create', auth, async (req, res) => {
  try {
    const { name, description, memberIds } = req.body;

    // Create group with creator as admin
    const groupChat = new GroupChat({
      name,
      description,
      creator: req.user.id,
      members: [req.user.id, ...memberIds],
      admins: [req.user.id]
    });

    await groupChat.save();
    await groupChat.populate('members', 'username displayName profilePhoto');
    
    res.json(groupChat);
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all group chats for current user
router.get('/', auth, async (req, res) => {
  try {
    const groupChats = await GroupChat.find({
      members: req.user.id
    })
      .populate('members', 'username displayName profilePhoto')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

    res.json(groupChats);
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single group chat by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const groupChat = await GroupChat.findById(req.params.id)
      .populate('members', 'username displayName profilePhoto')
      .populate('admins', 'username displayName')
      .populate('creator', 'username displayName');

    if (!groupChat) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is a member
    if (!groupChat.members.some(m => m._id.toString() === req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(groupChat);
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add members to group
router.post('/:id/add-members', auth, async (req, res) => {
  try {
    const { memberIds } = req.body;
    const groupChat = await GroupChat.findById(req.params.id);

    if (!groupChat) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is admin
    if (!groupChat.admins.some(a => a.toString() === req.user.id)) {
      return res.status(403).json({ message: 'Only admins can add members' });
    }

    // Add new members (avoid duplicates)
    memberIds.forEach(memberId => {
      if (!groupChat.members.includes(memberId)) {
        groupChat.members.push(memberId);
      }
    });

    await groupChat.save();
    await groupChat.populate('members', 'username displayName profilePhoto');

    res.json(groupChat);
  } catch (error) {
    console.error('Add members error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove member from group
router.post('/:id/remove-member', auth, async (req, res) => {
  try {
    const { memberId } = req.body;
    const groupChat = await GroupChat.findById(req.params.id);

    if (!groupChat) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is admin
    if (!groupChat.admins.some(a => a.toString() === req.user.id)) {
      return res.status(403).json({ message: 'Only admins can remove members' });
    }

    // Remove member
    groupChat.members = groupChat.members.filter(m => m.toString() !== memberId);
    groupChat.admins = groupChat.admins.filter(a => a.toString() !== memberId);

    await groupChat.save();
    await groupChat.populate('members', 'username displayName profilePhoto');

    res.json(groupChat);
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Leave group
router.post('/:id/leave', auth, async (req, res) => {
  try {
    const groupChat = await GroupChat.findById(req.params.id);

    if (!groupChat) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Remove user from members and admins
    groupChat.members = groupChat.members.filter(m => m.toString() !== req.user.id);
    groupChat.admins = groupChat.admins.filter(a => a.toString() !== req.user.id);

    // If creator leaves, assign new admin
    if (groupChat.creator.toString() === req.user.id && groupChat.members.length > 0) {
      groupChat.creator = groupChat.members[0];
      if (!groupChat.admins.includes(groupChat.members[0])) {
        groupChat.admins.push(groupChat.members[0]);
      }
    }

    // Delete group if no members left
    if (groupChat.members.length === 0) {
      await GroupChat.findByIdAndDelete(req.params.id);
      return res.json({ message: 'Group deleted' });
    }

    await groupChat.save();
    res.json({ message: 'Left group successfully' });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update group details
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description, avatar } = req.body;
    const groupChat = await GroupChat.findById(req.params.id);

    if (!groupChat) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is admin
    if (!groupChat.admins.some(a => a.toString() === req.user.id)) {
      return res.status(403).json({ message: 'Only admins can update group' });
    }

    if (name) groupChat.name = name;
    if (description !== undefined) groupChat.description = description;
    if (avatar !== undefined) groupChat.avatar = avatar;
    groupChat.updatedAt = Date.now();

    await groupChat.save();
    await groupChat.populate('members', 'username displayName profilePhoto');

    res.json(groupChat);
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ========================================
// GROUP CONVERSATION MANAGEMENT
// ========================================

// @route   POST /api/groupchats/:groupId/archive
// @desc    Archive a group chat
// @access  Private
router.post('/:groupId/archive', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const groupId = req.params.groupId;

    // Find or create conversation
    let conversation = await Conversation.findOne({
      groupChat: groupId
    });

    if (!conversation) {
      conversation = new Conversation({
        groupChat: groupId,
        participants: []
      });
    }

    // Add to archivedBy if not already archived
    if (!conversation.archivedBy.includes(currentUserId)) {
      conversation.archivedBy.push(currentUserId);
      await conversation.save();
    }

    res.json({ message: 'Group chat archived', conversation });
  } catch (error) {
    console.error('Archive group chat error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/groupchats/:groupId/unarchive
// @desc    Unarchive a group chat
// @access  Private
router.post('/:groupId/unarchive', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const groupId = req.params.groupId;

    const conversation = await Conversation.findOne({
      groupChat: groupId
    });

    if (conversation) {
      conversation.archivedBy = conversation.archivedBy.filter(
        id => id.toString() !== currentUserId
      );
      await conversation.save();
    }

    res.json({ message: 'Group chat unarchived', conversation });
  } catch (error) {
    console.error('Unarchive group chat error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/groupchats/:groupId/mute
// @desc    Mute notifications for a group chat
// @access  Private
router.post('/:groupId/mute', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const groupId = req.params.groupId;
    const { duration } = req.body; // duration in hours, null for indefinite

    // Find or create conversation
    let conversation = await Conversation.findOne({
      groupChat: groupId
    });

    if (!conversation) {
      conversation = new Conversation({
        groupChat: groupId,
        participants: []
      });
    }

    // Remove existing mute for this user
    conversation.mutedBy = conversation.mutedBy.filter(
      m => m.user.toString() !== currentUserId
    );

    // Add new mute
    const mutedUntil = duration ? new Date(Date.now() + duration * 60 * 60 * 1000) : null;
    conversation.mutedBy.push({
      user: currentUserId,
      mutedUntil
    });

    await conversation.save();

    res.json({ message: 'Group chat muted', conversation, mutedUntil });
  } catch (error) {
    console.error('Mute group chat error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/groupchats/:groupId/unmute
// @desc    Unmute notifications for a group chat
// @access  Private
router.post('/:groupId/unmute', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const groupId = req.params.groupId;

    const conversation = await Conversation.findOne({
      groupChat: groupId
    });

    if (conversation) {
      conversation.mutedBy = conversation.mutedBy.filter(
        m => m.user.toString() !== currentUserId
      );
      await conversation.save();
    }

    res.json({ message: 'Group chat unmuted', conversation });
  } catch (error) {
    console.error('Unmute group chat error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
