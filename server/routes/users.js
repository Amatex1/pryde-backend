import express from 'express';
const router = express.Router();
import User from '../models/User.js';
import Post from '../models/Post.js';
import Message from '../models/Message.js';
import FriendRequest from '../models/FriendRequest.js';
import GroupChat from '../models/GroupChat.js';
import Notification from '../models/Notification.js';
import auth from '../middleware/auth.js';
import { checkProfileVisibility, checkBlocked } from '../middleware/privacy.js';

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
router.get('/:id', auth, checkProfileVisibility, async (req, res) => {
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
      nickname,
      displayNameType,
      customDisplayName,
      pronouns,
      gender,
      sexualOrientation,
      relationshipStatus,
      birthday,
      bio,
      postcode,
      city,
      website,
      socialLinks,
      interests,
      lookingFor,
      communicationStyle,
      safetyPreferences
    } = req.body;

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields
    if (fullName !== undefined) user.fullName = fullName;
    if (nickname !== undefined) user.nickname = nickname;
    if (displayNameType !== undefined) user.displayNameType = displayNameType;
    if (customDisplayName !== undefined) user.customDisplayName = customDisplayName;
    if (pronouns !== undefined) user.pronouns = pronouns;
    if (gender !== undefined) user.gender = gender;
    if (sexualOrientation !== undefined) user.sexualOrientation = sexualOrientation;
    if (relationshipStatus !== undefined) user.relationshipStatus = relationshipStatus;
    if (birthday !== undefined) user.birthday = birthday;
    if (bio !== undefined) user.bio = bio;
    if (postcode !== undefined) user.postcode = postcode;
    if (city !== undefined) user.city = city;
    if (website !== undefined) user.website = website;
    if (socialLinks !== undefined) user.socialLinks = socialLinks;
    if (interests !== undefined) user.interests = interests;
    if (lookingFor !== undefined) user.lookingFor = lookingFor;
    if (communicationStyle !== undefined) user.communicationStyle = communicationStyle;
    if (safetyPreferences !== undefined) user.safetyPreferences = safetyPreferences;

    // Update displayName based on displayNameType
    if (displayNameType === 'fullName') {
      user.displayName = fullName;
    } else if (displayNameType === 'nickname') {
      user.displayName = nickname || fullName;
    } else if (displayNameType === 'custom') {
      user.displayName = customDisplayName || fullName;
    }

    await user.save();

    res.json({ user });
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
    console.log('📥 Download data request for user:', userId);

    // Fetch user data
    const user = await User.findById(userId).select('-password');

    if (!user) {
      console.log('❌ User not found:', userId);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('✅ User found:', user.username);

    // Initialize data object
    const userData = {
      profile: {
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        bio: user.bio,
        location: user.location,
        website: user.website,
        birthday: user.birthday,
        gender: user.gender,
        pronouns: user.pronouns,
        sexualOrientation: user.sexualOrientation,
        relationshipStatus: user.relationshipStatus,
        interests: user.interests,
        lookingFor: user.lookingFor,
        profilePhoto: user.profilePhoto,
        coverPhoto: user.coverPhoto,
        createdAt: user.createdAt,
        friends: user.friends || [],
        blockedUsers: user.blockedUsers || [],
        bookmarks: user.bookmarks || []
      },
      posts: [],
      messages: [],
      friendRequests: [],
      groupChats: [],
      notifications: [],
      exportDate: new Date().toISOString()
    };

    // Fetch posts
    try {
      const posts = await Post.find({ author: userId });
      userData.posts = posts;
      console.log('✅ Posts fetched:', posts.length);
    } catch (err) {
      console.log('⚠️ Error fetching posts:', err.message);
    }

    // Fetch messages
    try {
      const messages = await Message.find({
        $or: [{ sender: userId }, { recipient: userId }]
      });
      userData.messages = messages;
      console.log('✅ Messages fetched:', messages.length);
    } catch (err) {
      console.log('⚠️ Error fetching messages:', err.message);
    }

    // Fetch friend requests
    try {
      const friendRequests = await FriendRequest.find({
        $or: [{ sender: userId }, { receiver: userId }]
      });
      userData.friendRequests = friendRequests;
      console.log('✅ Friend requests fetched:', friendRequests.length);
    } catch (err) {
      console.log('⚠️ Error fetching friend requests:', err.message);
    }

    // Fetch group chats (if model exists)
    try {
      if (GroupChat) {
        const groupChats = await GroupChat.find({ members: userId });
        userData.groupChats = groupChats;
        console.log('✅ Group chats fetched:', groupChats.length);
      }
    } catch (err) {
      console.log('⚠️ Error fetching group chats:', err.message);
    }

    // Fetch notifications (if model exists)
    try {
      if (Notification) {
        const notifications = await Notification.find({ recipient: userId });
        userData.notifications = notifications;
        console.log('✅ Notifications fetched:', notifications.length);
      }
    } catch (err) {
      console.log('⚠️ Error fetching notifications:', err.message);
    }

    console.log('✅ Data compiled successfully, sending response');
    res.json(userData);
  } catch (error) {
    console.error('❌ Download data error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
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
