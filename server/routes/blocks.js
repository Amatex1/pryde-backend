import express from 'express';
const router = express.Router();
import Block from '../models/Block.js';
import User from '../models/User.js';
import auth from '../middleware/auth.js';

// @route   POST /api/blocks
// @desc    Block a user
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { blockedUserId, reason } = req.body;
    const userId = req.userId || req.user._id;

    if (!blockedUserId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Cannot block yourself
    if (blockedUserId === userId.toString()) {
      return res.status(400).json({ message: 'You cannot block yourself' });
    }

    // Check if user exists
    const userToBlock = await User.findById(blockedUserId);
    if (!userToBlock) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already blocked
    const existingBlock = await Block.findOne({
      blocker: userId,
      blocked: blockedUserId
    });

    if (existingBlock) {
      return res.status(400).json({ message: 'User is already blocked' });
    }

    const block = new Block({
      blocker: userId,
      blocked: blockedUserId,
      reason: reason || ''
    });

    await block.save();

    res.status(201).json({ 
      message: 'User blocked successfully',
      block 
    });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/blocks
// @desc    Get list of blocked users
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.userId || req.user._id;

    const blocks = await Block.find({ blocker: userId })
      .populate('blocked', 'username displayName profilePhoto')
      .sort({ createdAt: -1 });

    res.json(blocks);
  } catch (error) {
    console.error('Get blocks error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/blocks/check/:userId
// @desc    Check if a user is blocked
// @access  Private
router.get('/check/:userId', auth, async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    const targetUserId = req.params.userId;

    const block = await Block.findOne({
      blocker: userId,
      blocked: targetUserId
    });

    res.json({ isBlocked: !!block });
  } catch (error) {
    console.error('Check block error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/blocks/:userId
// @desc    Unblock a user
// @access  Private
router.delete('/:userId', auth, async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    const blockedUserId = req.params.userId;

    const block = await Block.findOneAndDelete({
      blocker: userId,
      blocked: blockedUserId
    });

    if (!block) {
      return res.status(404).json({ message: 'Block not found' });
    }

    res.json({ message: 'User unblocked successfully' });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

