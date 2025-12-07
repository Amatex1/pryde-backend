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
import mongoose from 'mongoose';

// PHASE 1 REFACTOR: Helper function to sanitize user data for private follower counts
// Removes follower/following arrays and counts, only shows if current user follows them
const sanitizeUserForPrivateFollowers = (user, currentUserId) => {
  const userObj = user.toObject ? user.toObject() : user;

  // Check if current user follows this user
  const isFollowing = userObj.followers?.some(follower =>
    (follower._id || follower).toString() === currentUserId.toString()
  );

  // Check if this user follows current user
  const followsYou = userObj.following?.some(following =>
    (following._id || following).toString() === currentUserId.toString()
  );

  // Replace follower/following arrays with just booleans
  userObj.isFollowing = isFollowing; // Does current user follow this profile?
  userObj.followsYou = followsYou;   // Does this profile follow current user?
  delete userObj.followers;
  delete userObj.following;

  return userObj;
};

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
      _id: { $ne: req.userId }, // Exclude current user
      isActive: true, // Only show active accounts
      isBanned: { $ne: true } // Exclude banned users
    })
    .select('username displayName profilePhoto bio')
    .limit(20);

    res.json(users);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/suggested
// @desc    Get suggested users based on interests, location, and sexual orientation
// @access  Private
router.get('/suggested', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);

    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Build exclusion list (convert to ObjectId)
    const excludeIds = [
      new mongoose.Types.ObjectId(req.userId), // Current user
      ...(currentUser.following || []).map(id => new mongoose.Types.ObjectId(id)),
      ...(currentUser.followers || []).map(id => new mongoose.Types.ObjectId(id)),
      ...(currentUser.blockedUsers || []).map(id => new mongoose.Types.ObjectId(id))
    ];

    // Build match criteria
    const matchCriteria = {
      _id: { $nin: excludeIds },
      isActive: true,
      isBanned: { $ne: true }
    };

    // Score-based matching
    const pipeline = [
      { $match: matchCriteria },
      {
        $addFields: {
          score: {
            $add: [
              // Match by interests (highest priority)
              {
                $cond: [
                  {
                    $gt: [
                      {
                        $size: {
                          $ifNull: [
                            { $setIntersection: [{ $ifNull: ['$interests', []] }, currentUser.interests || []] },
                            []
                          ]
                        }
                      },
                      0
                    ]
                  },
                  {
                    $multiply: [
                      {
                        $size: {
                          $setIntersection: [{ $ifNull: ['$interests', []] }, currentUser.interests || []]
                        }
                      },
                      10
                    ]
                  },
                  0
                ]
              },
              // Match by sexual orientation
              {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$sexualOrientation', ''] },
                      { $ne: [currentUser.sexualOrientation, ''] },
                      { $eq: ['$sexualOrientation', currentUser.sexualOrientation] }
                    ]
                  },
                  5,
                  0
                ]
              },
              // Match by city
              {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$city', ''] },
                      { $ne: [currentUser.city, ''] },
                      { $eq: ['$city', currentUser.city] }
                    ]
                  },
                  3,
                  0
                ]
              },
              // Match by postcode (same area)
              {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$postcode', ''] },
                      { $ne: [currentUser.postcode, ''] },
                      { $eq: ['$postcode', currentUser.postcode] }
                    ]
                  },
                  2,
                  0
                ]
              }
            ]
          }
        }
      },
      { $sort: { score: -1, createdAt: -1 } },
      { $limit: 50 },
      {
        $project: {
          username: 1,
          displayName: 1,
          profilePhoto: 1,
          coverPhoto: 1,
          bio: 1,
          interests: 1,
          city: 1,
          sexualOrientation: 1,
          score: 1
        }
      }
    ];

    let suggestedUsers = await User.aggregate(pipeline);

    // Debug logging
    console.log('🔍 Suggested users debug:');
    console.log('  - Current user:', req.userId);
    console.log('  - Excluded IDs count:', excludeIds.length);
    console.log('  - Suggested users found:', suggestedUsers.length);

    // If no suggestions found, return random users (fallback)
    if (suggestedUsers.length === 0) {
      console.log('  - No scored matches, fetching random users...');
      suggestedUsers = await User.find(matchCriteria)
        .select('username displayName profilePhoto coverPhoto bio interests city sexualOrientation')
        .sort({ createdAt: -1 })
        .limit(20);

      console.log('  - Random users found:', suggestedUsers.length);
    }

    res.json(suggestedUsers);
  } catch (error) {
    console.error('Suggested users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/verification-request
// @desc    Request account verification
// @access  Private
// NOTE: This route MUST be before /:identifier route to avoid being caught by it
router.post('/verification-request', auth, async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ message: 'Please provide a reason for verification' });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'Your account is already verified' });
    }

    if (user.verificationRequested) {
      return res.status(400).json({ message: 'You have already submitted a verification request. Please wait for admin review.' });
    }

    user.verificationRequested = true;
    user.verificationRequestDate = new Date();
    user.verificationRequestReason = reason.trim();
    await user.save();

    res.json({
      message: 'Verification request submitted successfully. An admin will review your request.',
      verificationRequested: true
    });
  } catch (error) {
    console.error('Verification request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/verification-status
// @desc    Get verification status
// @access  Private
// NOTE: This route MUST be before /:identifier route to avoid being caught by it
router.get('/verification-status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('isVerified verificationRequested verificationRequestDate');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      isVerified: user.isVerified,
      verificationRequested: user.verificationRequested,
      verificationRequestDate: user.verificationRequestDate
    });
  } catch (error) {
    console.error('Verification status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/download-data
// @desc    Download all user data
// @access  Private
// NOTE: This route MUST be before /:id route to avoid being caught by it
router.get('/download-data', auth, async (req, res) => {
  try {
    const userId = req.userId;
    console.log('📥 Download data request for user:', userId);

    // Fetch user data
    const user = await User.findById(userId).select('-password').lean();

    if (!user) {
      console.log('❌ User not found:', userId);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('✅ User found:', user.username);
    console.log('📊 User object keys:', Object.keys(user));

    // Initialize data object with safe field access
    console.log('📝 Building user profile data...');

    let userData;
    try {
      userData = {
        profile: {
          username: user.username || '',
          displayName: user.displayName || '',
          fullName: user.fullName || '',
          nickname: user.nickname || '',
          email: user.email || '',
          bio: user.bio || '',
          location: user.location || '',
          website: user.website || '',
          birthday: user.birthday || null,
          gender: user.gender || '',
          pronouns: user.pronouns || '',
          sexualOrientation: user.sexualOrientation || '',
          relationshipStatus: user.relationshipStatus || '',
          interests: user.interests || '',
          lookingFor: user.lookingFor || '',
          profilePhoto: user.profilePhoto || '',
          coverPhoto: user.coverPhoto || '',
          createdAt: user.createdAt || null,
          friends: Array.isArray(user.friends) ? user.friends : [],
          blockedUsers: Array.isArray(user.blockedUsers) ? user.blockedUsers : [],
          bookmarkedPosts: Array.isArray(user.bookmarkedPosts) ? user.bookmarkedPosts : []
        },
        posts: [],
        messages: [],
        friendRequests: [],
        groupChats: [],
        notifications: [],
        exportDate: new Date().toISOString()
      };
      console.log('✅ Profile data built successfully');
    } catch (profileError) {
      console.error('❌ Error building profile data:', profileError);
      throw new Error('Failed to build profile data: ' + profileError.message);
    }

    // Fetch posts
    try {
      if (Post) {
        const posts = await Post.find({ author: userId }).lean();
        userData.posts = posts || [];
        console.log('✅ Posts fetched:', posts?.length || 0);
      } else {
        console.log('⚠️ Post model not available');
      }
    } catch (err) {
      console.log('⚠️ Error fetching posts:', err.message);
      console.error('⚠️ Posts error stack:', err.stack);
      userData.posts = [];
    }

    // Fetch messages
    try {
      if (Message) {
        const messages = await Message.find({
          $or: [{ sender: userId }, { recipient: userId }]
        });
        // Convert to JSON to trigger decryption (don't use .lean())
        userData.messages = messages.map(msg => msg.toJSON()) || [];
        console.log('✅ Messages fetched:', messages?.length || 0);
      } else {
        console.log('⚠️ Message model not available');
      }
    } catch (err) {
      console.log('⚠️ Error fetching messages:', err.message);
      console.error('⚠️ Messages error stack:', err.stack);
      userData.messages = [];
    }

    // Fetch friend requests
    try {
      if (FriendRequest) {
        const friendRequests = await FriendRequest.find({
          $or: [{ sender: userId }, { receiver: userId }]
        }).lean();
        userData.friendRequests = friendRequests || [];
        console.log('✅ Friend requests fetched:', friendRequests?.length || 0);
      } else {
        console.log('⚠️ FriendRequest model not available');
      }
    } catch (err) {
      console.log('⚠️ Error fetching friend requests:', err.message);
      console.error('⚠️ Friend requests error stack:', err.stack);
      userData.friendRequests = [];
    }

    // Fetch group chats (if model exists)
    try {
      if (GroupChat) {
        const groupChats = await GroupChat.find({ members: userId }).lean();
        userData.groupChats = groupChats || [];
        console.log('✅ Group chats fetched:', groupChats?.length || 0);
      } else {
        console.log('⚠️ GroupChat model not available');
      }
    } catch (err) {
      console.log('⚠️ Error fetching group chats:', err.message);
      console.error('⚠️ Group chats error stack:', err.stack);
      userData.groupChats = [];
    }

    // Fetch notifications (if model exists)
    try {
      if (Notification) {
        const notifications = await Notification.find({ recipient: userId }).lean();
        userData.notifications = notifications || [];
        console.log('✅ Notifications fetched:', notifications?.length || 0);
      } else {
        console.log('⚠️ Notification model not available');
      }
    } catch (err) {
      console.log('⚠️ Error fetching notifications:', err.message);
      console.error('⚠️ Notifications error stack:', err.stack);
      userData.notifications = [];
    }

    console.log('✅ Data compiled successfully, sending response');
    console.log('📊 Data summary:', {
      posts: userData.posts.length,
      messages: userData.messages.length,
      friendRequests: userData.friendRequests.length,
      groupChats: userData.groupChats.length,
      notifications: userData.notifications.length
    });

    res.json(userData);
  } catch (error) {
    console.error('❌ Download data error:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error name:', error.name);
    res.status(500).json({
      message: 'Server error',
      error: error.message,
      errorName: error.name
    });
  }
});

// @route   GET /api/users/:identifier
// @desc    Get user by ID or username
// @access  Private
router.get('/:identifier', auth, checkProfileVisibility, async (req, res) => {
  try {
    const { identifier } = req.params;
    let user;

    // Check if identifier is a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(identifier) && identifier.length === 24) {
      // Try to find by ID first
      // PHASE 1 REFACTOR: Still populate to check relationships, but will sanitize before sending
      user = await User.findById(identifier)
        .select('-password')
        .populate('friends', 'username displayName profilePhoto coverPhoto bio')
        .populate('followers', 'username displayName profilePhoto coverPhoto bio')
        .populate('following', 'username displayName profilePhoto coverPhoto bio');
    }

    // If not found by ID or not a valid ID, try username
    if (!user) {
      // PHASE 1 REFACTOR: Still populate to check relationships, but will sanitize before sending
      user = await User.findOne({ username: identifier })
        .select('-password')
        .populate('friends', 'username displayName profilePhoto coverPhoto bio')
        .populate('followers', 'username displayName profilePhoto coverPhoto bio')
        .populate('following', 'username displayName profilePhoto coverPhoto bio');
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // PHASE 1 REFACTOR: Sanitize user to hide follower/following counts
    const currentUserId = req.userId || req.user._id;
    const sanitizedUser = sanitizeUserForPrivateFollowers(user, currentUserId);

    res.json(sanitizedUser);
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

// @route   PATCH /api/users/me/settings
// @desc    Update user settings (PHASE 2: Quiet Mode)
// @access  Private
router.patch('/me/settings', auth, async (req, res) => {
  try {
    const { quietModeEnabled } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Initialize privacySettings if it doesn't exist
    if (!user.privacySettings) {
      user.privacySettings = {};
    }

    // Update quiet mode setting
    if (typeof quietModeEnabled === 'boolean') {
      user.privacySettings.quietModeEnabled = quietModeEnabled;
      user.markModified('privacySettings');
    }

    await user.save();

    res.json({
      message: 'Settings updated successfully',
      quietModeEnabled: user.privacySettings.quietModeEnabled
    });
  } catch (error) {
    console.error('Update settings error:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PATCH /api/users/me/creator
// @desc    Update creator mode settings (PHASE 5)
// @access  Private
router.patch('/me/creator', auth, async (req, res) => {
  try {
    const { isCreator, creatorTagline, creatorBio, featuredPosts } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update creator fields
    if (typeof isCreator === 'boolean') {
      user.isCreator = isCreator;
    }
    if (creatorTagline !== undefined) {
      user.creatorTagline = creatorTagline;
    }
    if (creatorBio !== undefined) {
      user.creatorBio = creatorBio;
    }
    if (featuredPosts !== undefined && Array.isArray(featuredPosts)) {
      user.featuredPosts = featuredPosts;
    }

    await user.save();

    res.json({
      message: 'Creator settings updated successfully',
      isCreator: user.isCreator,
      creatorTagline: user.creatorTagline,
      creatorBio: user.creatorBio,
      featuredPosts: user.featuredPosts
    });
  } catch (error) {
    console.error('Update creator settings error:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PATCH /api/users/me/ally
// @desc    Update ally status (PHASE 6)
// @access  Private
router.patch('/me/ally', auth, async (req, res) => {
  try {
    const { isAlly } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (typeof isAlly === 'boolean') {
      user.isAlly = isAlly;
      user.onboardingCompleted = true;
    }

    await user.save();

    res.json({
      message: 'Ally status updated successfully',
      isAlly: user.isAlly
    });
  } catch (error) {
    console.error('Update ally status error:', error);
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
