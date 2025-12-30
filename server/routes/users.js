import express from 'express';
const router = express.Router();
import User from '../models/User.js';
import Badge from '../models/Badge.js';
import Post from '../models/Post.js';
import Message from '../models/Message.js';
import FriendRequest from '../models/FriendRequest.js';
import GroupChat from '../models/GroupChat.js';
import Notification from '../models/Notification.js';
import auth from '../middleware/auth.js';
import requireActiveUser from '../middleware/requireActiveUser.js';
import { checkProfileVisibility, checkBlocked } from '../middleware/privacy.js';
import { sanitizeFields } from '../middleware/sanitize.js';
import mongoose from 'mongoose';
import { getUserStabilityReport } from '../utils/stabilityScore.js';
import { processUserBadgesById } from '../services/autoBadgeService.js';
import logger from '../utils/logger.js';

/**
 * Helper to resolve badge IDs to full badge objects
 * @param {string[]} badgeIds - Array of badge IDs
 * @returns {Promise<Object[]>} Array of badge objects with id, label, icon, tooltip, etc.
 */
async function resolveBadges(badgeIds) {
  if (!badgeIds || !Array.isArray(badgeIds) || badgeIds.length === 0) {
    return [];
  }

  try {
    const badges = await Badge.find({ id: { $in: badgeIds }, isActive: true })
      .select('id label icon tooltip type priority color')
      .lean();

    // Sort by priority (lower = higher priority)
    return badges.sort((a, b) => (a.priority || 100) - (b.priority || 100));
  } catch (error) {
    logger.error('Failed to resolve badges:', error);
    return [];
  }
}

// PHASE 1 REFACTOR: Helper function to sanitize user data for private follower counts
// Keeps counts but removes detailed arrays, only shows if current user follows them
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

  // Store counts before removing arrays
  const followersCount = userObj.followers?.length || 0;
  const followingCount = userObj.following?.length || 0;

  // Replace follower/following arrays with just counts and booleans
  userObj.isFollowing = isFollowing; // Does current user follow this profile?
  userObj.followsYou = followsYou;   // Does this profile follow current user?

  // Keep counts but remove detailed arrays for privacy
  userObj.followers = { length: followersCount };
  userObj.following = { length: followingCount };

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

    // Get current user to check blocked users
    const currentUser = await User.findById(req.userId).select('blockedUsers');
    const blockedUserIds = currentUser?.blockedUsers || [];

    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { displayName: { $regex: q, $options: 'i' } }
      ],
      _id: {
        $ne: req.userId, // Exclude current user
        $nin: blockedUserIds // Exclude blocked users
      },
      isActive: true, // Only show active accounts
      isDeleted: { $ne: true }, // Exclude deleted accounts
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
      isDeleted: { $ne: true }, // Exclude deleted accounts
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
// @desc    DEPRECATED - Verification system removed 2025-12-26
// @access  Private
// NOTE: This route MUST be before /:identifier route to avoid being caught by it
router.post('/verification-request', auth, (req, res) => {
  res.status(410).json({
    message: 'Verification request system has been removed.',
    deprecated: true,
    removedDate: '2025-12-26'
  });
});

// @route   GET /api/users/verification-status
// @desc    DEPRECATED - Verification system removed 2025-12-26
// @access  Private
// NOTE: This route MUST be before /:identifier route to avoid being caught by it
router.get('/verification-status', auth, (req, res) => {
  res.status(410).json({
    message: 'Verification request system has been removed.',
    deprecated: true,
    removedDate: '2025-12-26'
  });
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
          // REMOVED 2025-12-26: relationshipStatus deleted (Phase 5)
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
// @desc    Get user by ID, username, or profileSlug
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

    // If still not found, try profileSlug (custom profile URL)
    if (!user) {
      user = await User.findOne({ profileSlug: identifier.toLowerCase() })
        .select('-password')
        .populate('friends', 'username displayName profilePhoto coverPhoto bio')
        .populate('followers', 'username displayName profilePhoto coverPhoto bio')
        .populate('following', 'username displayName profilePhoto coverPhoto bio');
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // CRITICAL: Block access to deleted user profiles
    if (user.isDeleted) {
      return res.status(404).json({ message: 'User not found' });
    }

    // CRITICAL: Block access to deactivated user profiles (except for own profile)
    const currentUserId = req.userId || req.user._id;
    if (!user.isActive && user._id.toString() !== currentUserId.toString()) {
      return res.status(404).json({ message: 'User not found' });
    }

    // PHASE 1 REFACTOR: Sanitize user to hide follower/following counts
    const sanitizedUser = sanitizeUserForPrivateFollowers(user, currentUserId);

    // BADGE SYSTEM: Resolve badge IDs to full badge objects
    if (sanitizedUser.badges && sanitizedUser.badges.length > 0) {
      // Check if user has hideBadges enabled in privacy settings
      const hideBadges = user.privacySettings?.hideBadges;
      if (hideBadges) {
        sanitizedUser.badges = [];
      } else {
        sanitizedUser.badges = await resolveBadges(sanitizedUser.badges);
      }
    }

    // Check if this user has blocked the current user (for messaging availability)
    const { hasBlocked } = await import('../utils/blockHelper.js');
    const hasBlockedCurrentUser = await hasBlocked(user._id.toString(), currentUserId.toString());
    sanitizedUser.hasBlockedCurrentUser = hasBlockedCurrentUser;

    res.json(sanitizedUser);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, requireActiveUser, sanitizeFields([
  'fullName', 'nickname', 'customDisplayName', 'pronouns',
  'bio', 'city', 'website', 'communicationStyle', 'safetyPreferences'
]), async (req, res) => {
  try {
    const {
      fullName,
      nickname,
      displayNameType,
      customDisplayName,
      pronouns,
      gender,
      sexualOrientation,
      // DEPRECATED 2025-12-26: relationshipStatus is ignored (UI removed)
      // relationshipStatus,
      birthday,
      bio,
      postcode,
      city,
      website,
      socialLinks,
      interests,
      lookingFor,
      communicationStyle,
      safetyPreferences,
      profilePhoto,
      coverPhoto,
      coverPhotoPosition,
      profilePhotoPosition
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
    // DEPRECATED 2025-12-26: relationshipStatus update removed (UI removed)
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

    // Update photo URLs
    if (profilePhoto !== undefined) user.profilePhoto = profilePhoto;
    if (coverPhoto !== undefined) user.coverPhoto = coverPhoto;

    // Update photo positions (includes x, y, scale)
    if (coverPhotoPosition !== undefined) {
      // SAFETY: Ensure coverPhotoPosition exists for older users
      const currentCover = user.coverPhotoPosition || { x: 50, y: 50, scale: 1 };
      user.coverPhotoPosition = {
        x: coverPhotoPosition.x ?? currentCover.x ?? 50,
        y: coverPhotoPosition.y ?? currentCover.y ?? 50,
        scale: coverPhotoPosition.scale ?? currentCover.scale ?? 1
      };
      user.markModified('coverPhotoPosition');
    }
    if (profilePhotoPosition !== undefined) {
      // SAFETY: Ensure profilePhotoPosition exists for older users
      const currentProfile = user.profilePhotoPosition || { x: 50, y: 50, scale: 1 };
      user.profilePhotoPosition = {
        x: profilePhotoPosition.x ?? currentProfile.x ?? 50,
        y: profilePhotoPosition.y ?? currentProfile.y ?? 50,
        scale: profilePhotoPosition.scale ?? currentProfile.scale ?? 1
      };
      user.markModified('profilePhotoPosition');
    }

    // Update displayName based on displayNameType
    if (displayNameType === 'fullName') {
      user.displayName = fullName;
    } else if (displayNameType === 'nickname') {
      user.displayName = nickname || fullName;
    } else if (displayNameType === 'custom') {
      user.displayName = customDisplayName || fullName;
    }

    await user.save();

    // BADGE SYSTEM: Process automatic badges after profile update (non-blocking)
    // This checks for profile_complete badge
    setImmediate(async () => {
      try {
        await processUserBadgesById(user._id.toString());
      } catch (err) {
        logger.warn('Failed to process badges on profile update:', err.message);
      }
    });

    res.json({ user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/photo-position
// @desc    Update profile or cover photo position (DEPRECATED - use /users/profile instead)
// @access  Private
router.put('/photo-position', auth, requireActiveUser, async (req, res) => {
  try {
    const { type, x, y, scale } = req.body;

    if (!type || (type !== 'profile' && type !== 'cover')) {
      return res.status(400).json({ message: 'Invalid photo type' });
    }

    if (typeof x !== 'number' || typeof y !== 'number') {
      return res.status(400).json({ message: 'Invalid position values' });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update position (with optional scale parameter)
    // SAFETY: Ensure position objects exist for older users
    if (type === 'profile') {
      const currentScale = user.profilePhotoPosition?.scale ?? 1;
      user.profilePhotoPosition = {
        x,
        y,
        scale: typeof scale === 'number' ? scale : currentScale
      };
      user.markModified('profilePhotoPosition');
    } else {
      const currentScale = user.coverPhotoPosition?.scale ?? 1;
      user.coverPhotoPosition = {
        x,
        y,
        scale: typeof scale === 'number' ? scale : currentScale
      };
      user.markModified('coverPhotoPosition');
    }

    await user.save();

    res.json({
      message: 'Photo position updated',
      position: type === 'profile' ? user.profilePhotoPosition : user.coverPhotoPosition
    });
  } catch (error) {
    console.error('Update photo position error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PATCH /api/users/me/settings
// @desc    Update user settings (PHASE 2: Quiet Mode, V2 sub-toggles, Badge System V1)
// @access  Private
router.patch('/me/settings', auth, requireActiveUser, async (req, res) => {
  try {
    const {
      quietModeEnabled,
      // Quiet Mode V2 sub-toggles
      quietVisuals,
      quietWriting,
      quietMetrics,
      // BADGE SYSTEM V1: Hide badges option
      hideBadges
    } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Initialize privacySettings if it doesn't exist
    if (!user.privacySettings) {
      user.privacySettings = {};
    }

    // Update quiet mode main toggle
    if (typeof quietModeEnabled === 'boolean') {
      user.privacySettings.quietModeEnabled = quietModeEnabled;
    }

    // Quiet Mode V2: Update sub-toggles
    if (typeof quietVisuals === 'boolean') {
      user.privacySettings.quietVisuals = quietVisuals;
    }
    if (typeof quietWriting === 'boolean') {
      user.privacySettings.quietWriting = quietWriting;
    }
    if (typeof quietMetrics === 'boolean') {
      user.privacySettings.quietMetrics = quietMetrics;
    }

    // BADGE SYSTEM V1: Update hide badges setting
    if (typeof hideBadges === 'boolean') {
      user.privacySettings.hideBadges = hideBadges;
    }

    user.markModified('privacySettings');
    await user.save();

    res.json({
      message: 'Settings updated successfully',
      quietModeEnabled: user.privacySettings.quietModeEnabled,
      quietVisuals: user.privacySettings.quietVisuals ?? true,
      quietWriting: user.privacySettings.quietWriting ?? true,
      quietMetrics: user.privacySettings.quietMetrics ?? false,
      hideBadges: user.privacySettings.hideBadges ?? false
    });
  } catch (error) {
    console.error('Update settings error:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PATCH /api/users/me/creator
// @desc    DEPRECATED - Creator mode removed 2025-12-25
// @access  Private
router.patch('/me/creator', auth, requireActiveUser, async (req, res) => {
  // Return 410 Gone to indicate this endpoint has been permanently removed
  res.status(410).json({
    message: 'Creator mode has been removed. All users now have access to creative features.',
    deprecated: true,
    removedDate: '2025-12-25'
  });
});

// @route   GET /api/users/me/stability
// @desc    Get user stability score
// @access  Private
router.get('/me/stability', auth, async (req, res) => {
  try {
    const report = getUserStabilityReport(req.userId);
    res.json(report);
  } catch (error) {
    console.error('Get stability score error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PATCH /api/users/me/ally
// @desc    DEPRECATED - isAlly field removed 2025-12-26 (Phase 5)
// @access  Private
router.patch('/me/ally', auth, requireActiveUser, (req, res) => {
  res.status(410).json({
    message: 'Ally status system has been removed. Use identity field instead.',
    deprecated: true,
    removedDate: '2025-12-26'
  });
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

    // Deactivate account
    user.isActive = false;
    user.deactivatedAt = new Date();

    // Clear all sessions (force logout everywhere)
    user.activeSessions = [];

    await user.save();

    // CRITICAL: Force disconnect all sockets for this user
    const io = req.app.get('io');
    const onlineUsers = req.app.get('onlineUsers');

    if (io) {
      try {
        const sockets = await io.fetchSockets();
        for (const socket of sockets) {
          if (socket.userId === user._id.toString()) {
            console.log(`🔌 Force disconnecting socket for deactivated user ${user._id}`);
            socket.emit('force_logout', {
              reason: 'Account deactivated',
              final: true
            });
            socket.disconnect(true);
          }
        }
      } catch (socketError) {
        console.error('Socket disconnect error (non-critical):', socketError);
      }

      // Emit real-time event for user deactivation (for admin panel)
      io.emit('user_deactivated', {
        userId: user._id
      });
    }

    // Remove from online users map
    if (onlineUsers) {
      onlineUsers.delete(user._id.toString());
    }

    res.json({ message: 'Account deactivated successfully' });
  } catch (error) {
    console.error('Deactivate account error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/reactivate
// @desc    Reactivate user account
// @access  Private (auth only - no requireActiveUser, allows deactivated users)
router.put('/reactivate', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Double-check: deleted users cannot reactivate
    if (user.isDeleted) {
      return res.status(401).json({ message: 'Account has been permanently deleted', code: 'ACCOUNT_DELETED' });
    }

    // Reactivate the account
    user.isActive = true;
    user.deactivatedAt = null; // Clear deactivation timestamp
    await user.save();

    // Emit real-time event for user reactivation (for admin panel)
    const io = req.app.get('io');
    if (io) {
      io.emit('user_reactivated', {
        userId: user._id
      });
    }

    // Return success with updated user data
    res.json({
      message: 'Account reactivated successfully',
      user: {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Reactivate account error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/account/delete-request
// @desc    Request account deletion (sends confirmation email)
// @access  Private
router.post('/account/delete-request', auth, requireActiveUser, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate deletion confirmation token
    const crypto = await import('crypto');
    const deletionToken = crypto.randomBytes(32).toString('hex');

    user.deletionConfirmationToken = deletionToken;
    user.deletionConfirmationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await user.save();

    // TODO: Send confirmation email with deletion link
    // sendAccountDeletionEmail(user.email, user.username, deletionToken);

    res.json({
      message: 'Account deletion confirmation email sent. Please check your email to confirm.',
      expiresIn: '24 hours'
    });
  } catch (error) {
    console.error('Delete request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/account/delete-confirm
// @desc    Confirm account deletion with token (soft delete with 30-day recovery)
// @access  Public
router.post('/account/delete-confirm', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Deletion token required' });
    }

    const user = await User.findOne({
      deletionConfirmationToken: token,
      deletionConfirmationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired deletion token' });
    }

    // Soft delete: Mark as deleted and schedule permanent deletion in 30 days
    user.isDeleted = true;
    user.deletedAt = new Date();
    user.deletionScheduledFor = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    user.deletionConfirmationToken = null;
    user.deletionConfirmationExpires = null;

    // Anonymize user data
    user.email = `deleted_${user._id}@deleted.local`;
    user.fullName = '[Deleted User]';
    user.displayName = '[Deleted User]';
    user.nickname = '';
    user.bio = '';
    user.profilePhoto = '';
    user.coverPhoto = '';
    user.location = '';
    user.website = '';
    user.socialLinks = {};
    user.pronouns = '';
    user.customPronouns = '';
    user.gender = '';
    user.customGender = '';
    // REMOVED 2025-12-26: relationshipStatus deleted (Phase 5)

    // Clear all sessions (log out everywhere)
    user.activeSessions = [];

    await user.save();

    // CRITICAL: Force disconnect all sockets for this user
    const io = req.app.get('io');
    const onlineUsers = req.app.get('onlineUsers');

    if (io) {
      try {
        const sockets = await io.fetchSockets();
        for (const socket of sockets) {
          if (socket.userId === user._id.toString()) {
            console.log(`🔌 Force disconnecting socket for deleted user ${user._id}`);
            socket.emit('force_logout', {
              reason: 'Account deleted',
              final: true
            });
            socket.disconnect(true);
          }
        }
      } catch (socketError) {
        console.error('Socket disconnect error (non-critical):', socketError);
      }

      // Emit real-time event for user deletion (for admin panel)
      io.emit('user_deleted', {
        userId: user._id
      });
    }

    // Remove from online users map
    if (onlineUsers) {
      onlineUsers.delete(user._id.toString());
    }

    // Anonymize user's posts (keep content but mark as deleted user)
    // Posts remain but author is anonymized

    // Remove user from other users' friends/followers lists
    await User.updateMany(
      { $or: [{ friends: user._id }, { followers: user._id }, { following: user._id }] },
      {
        $pull: {
          friends: user._id,
          followers: user._id,
          following: user._id
        }
      }
    );

    res.json({
      message: 'Account deleted successfully. You have 30 days to recover your account by logging in.',
      recoveryDeadline: user.deletionScheduledFor
    });
  } catch (error) {
    console.error('Delete confirm error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/account/recover
// @desc    Recover deleted account (within 30-day window)
// @access  Public (requires login credentials)
router.post('/account/recover', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    // Find deleted user
    const user = await User.findOne({
      isDeleted: true,
      deletionScheduledFor: { $gt: Date.now() } // Still within recovery window
    });

    if (!user) {
      return res.status(404).json({ message: 'No recoverable account found or recovery period has expired' });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Restore account
    user.isDeleted = false;
    user.deletedAt = null;
    user.deletionScheduledFor = null;

    // Restore original email (if we stored it)
    // For now, user will need to update their email manually

    await user.save();

    res.json({
      message: 'Account recovered successfully! Please update your profile information.',
      user: {
        id: user._id,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Account recovery error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
