import express from 'express';
const router = express.Router();
import User from '../models/User.js';
import Post from '../models/Post.js';
import Message from '../models/Message.js';
import FriendRequest from '../models/FriendRequest.js';
import GroupChat from '../models/GroupChat.js';
import Notification from '../models/Notification.js';
import auth from '../middleware/auth.js';

// @route   GET /api/users/search
// @desc    Search users
// @access  Private
router.get('/search', auth, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === '') {
      return res.json([]);
    }

    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { displayName: { $regex: q, $options: 'i' } }
      ],
      _id: { $ne: req.userId } // Exclude current user
    })
    .select('username displayName profilePhoto bio')
    .limit(20);

    res.json(users);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('friends', 'username displayName profilePhoto');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
  try {
    const {
      fullName,
      displayName,
      nickname,
      pronouns,
      customPronouns,
      gender,
      customGender,
      relationshipStatus,
      bio,
      location,
      website,
      socialLinks
    } = req.body;

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields
    if (fullName !== undefined) user.fullName = fullName;
    if (displayName !== undefined) user.displayName = displayName;
    if (nickname !== undefined) user.nickname = nickname;
    if (pronouns !== undefined) user.pronouns = pronouns;
    if (customPronouns !== undefined) user.customPronouns = customPronouns;
    if (gender !== undefined) user.gender = gender;
    if (customGender !== undefined) user.customGender = customGender;
    if (relationshipStatus !== undefined) user.relationshipStatus = relationshipStatus;
    if (bio !== undefined) user.bio = bio;
    if (location !== undefined) user.location = location;
    if (website !== undefined) user.website = website;
    if (socialLinks !== undefined) user.socialLinks = socialLinks;

    await user.save();

    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/download-data
// @desc    Download all user data
// @access  Private
router.get('/download-data', auth, async (req, res) => {
  try {
    const userId = req.userId;

    // Fetch all user data
    const user = await User.findById(userId)
      .select('-password')
      .populate('friends', 'username displayName profilePhoto');

    const posts = await Post.find({ author: userId })
      .populate('comments.user', 'username displayName')
      .populate('likes', 'username displayName');

    const messages = await Message.find({
      $or: [{ sender: userId }, { recipient: userId }]
    })
      .populate('sender', 'username displayName')
      .populate('recipient', 'username displayName');

    const friendRequests = await FriendRequest.find({
      $or: [{ sender: userId }, { receiver: userId }]
    })
      .populate('sender', 'username displayName')
      .populate('receiver', 'username displayName');

    const groupChats = await GroupChat.find({ members: userId })
      .populate('members', 'username displayName')
      .populate('creator', 'username displayName');

    const notifications = await Notification.find({ recipient: userId });

    // Compile all data
    const userData = {
      profile: user,
      posts: posts,
      messages: messages,
      friendRequests: friendRequests,
      groupChats: groupChats,
      notifications: notifications,
      exportDate: new Date().toISOString()
    };

    res.json(userData);
  } catch (error) {
    console.error('Download data error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/deactivate
// @desc    Deactivate user account
// @access  Private
router.put('/deactivate', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Add isActive field if it doesn't exist
    user.isActive = false;
    await user.save();

    res.json({ message: 'Account deactivated successfully' });
  } catch (error) {
    console.error('Deactivate account error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/users/account
// @desc    Delete user account permanently
// @access  Private
router.delete('/account', auth, async (req, res) => {
  try {
    const userId = req.userId;

    // Delete all user's posts
    await Post.deleteMany({ author: userId });

    // Delete all user's messages
    await Message.deleteMany({
      $or: [{ sender: userId }, { recipient: userId }]
    });

    // Delete all friend requests
    await FriendRequest.deleteMany({
      $or: [{ sender: userId }, { receiver: userId }]
    });

    // Remove user from all group chats
    await GroupChat.updateMany(
      { members: userId },
      { $pull: { members: userId, admins: userId } }
    );

    // Delete notifications
    await Notification.deleteMany({
      $or: [{ sender: userId }, { recipient: userId }]
    });

    // Remove user from other users' friends lists
    await User.updateMany(
      { friends: userId },
      { $pull: { friends: userId } }
    );

    // Finally, delete the user
    await User.findByIdAndDelete(userId);

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
