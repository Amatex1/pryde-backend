import User from '../models/User.js';

// Check if user is blocked
export const checkBlocked = async (req, res, next) => {
  try {
    const currentUserId = req.userId;
    const targetUserId = req.params.userId || req.params.id || req.body.recipient;

    if (!targetUserId || currentUserId === targetUserId) {
      return next();
    }

    const currentUser = await User.findById(currentUserId).select('blockedUsers');
    const targetUser = await User.findById(targetUserId).select('blockedUsers');

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if current user is blocked by target user
    if (targetUser.blockedUsers.includes(currentUserId)) {
      return res.status(403).json({ message: 'You cannot interact with this user' });
    }

    // Check if target user is blocked by current user
    if (currentUser.blockedUsers.includes(targetUserId)) {
      return res.status(403).json({ message: 'You have blocked this user' });
    }

    next();
  } catch (error) {
    console.error('Check blocked error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Check profile visibility
export const checkProfileVisibility = async (req, res, next) => {
  try {
    const currentUserId = req.userId;
    // Support both 'id' and 'identifier' parameter names
    const profileIdentifier = req.params.identifier || req.params.id;

    if (!profileIdentifier) {
      return res.status(400).json({ message: 'User identifier is required' });
    }

    // Find user by ID or username
    let profileUser;
    const mongoose = (await import('mongoose')).default;

    if (mongoose.Types.ObjectId.isValid(profileIdentifier) && profileIdentifier.length === 24) {
      profileUser = await User.findById(profileIdentifier).select('_id privacySettings friends followers blockedUsers');
    }

    if (!profileUser) {
      profileUser = await User.findOne({ username: profileIdentifier }).select('_id privacySettings friends followers blockedUsers');
    }

    if (!profileUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // User can always view their own profile
    if (currentUserId === profileUser._id.toString()) {
      return next();
    }

    const currentUser = await User.findById(currentUserId).select('blockedUsers');

    if (!currentUser) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Check if blocked
    if (profileUser.blockedUsers.includes(currentUserId) || currentUser.blockedUsers.includes(profileUser._id)) {
      return res.status(403).json({ message: 'Profile not accessible' });
    }

    const visibility = profileUser.privacySettings?.profileVisibility || 'public';

    if (visibility === 'private') {
      return res.status(403).json({ message: 'This profile is private' });
    }

    // Check for both 'friends' and 'followers' for backward compatibility
    if (visibility === 'friends' || visibility === 'followers') {
      // Check followers first (new system), then friends (legacy)
      const isFollower = profileUser.followers?.some(followerId => followerId.toString() === currentUserId);
      const isFriend = profileUser.friends?.some(friendId => friendId.toString() === currentUserId);

      if (!isFollower && !isFriend) {
        return res.status(403).json({ message: 'This profile is only visible to followers' });
      }
    }

    next();
  } catch (error) {
    console.error('Check profile visibility error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PHASE 1 REFACTOR: Friend request permission check deprecated
// This middleware is no longer used as friends system is removed
export const checkFriendRequestPermission = async (req, res, next) => {
  // Friends system removed - return error
  return res.status(410).json({
    message: 'Friend requests are no longer supported. Please use the follow system instead.',
    deprecated: true
  });

  /* LEGACY CODE - KEPT FOR REFERENCE
  try {
    const currentUserId = req.userId;
    const targetUserId = req.params.userId;

    if (currentUserId === targetUserId) {
      return res.status(400).json({ message: 'Cannot send friend request to yourself' });
    }

    const targetUser = await User.findById(targetUserId).select('privacySettings friends blockedUsers');
    const currentUser = await User.findById(currentUserId).select('friends blockedUsers');

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if blocked
    if (targetUser.blockedUsers.includes(currentUserId) || currentUser.blockedUsers.includes(targetUserId)) {
      return res.status(403).json({ message: 'Cannot send friend request to this user' });
    }

    const permission = targetUser.privacySettings?.whoCanSendFriendRequests || 'everyone';

    if (permission === 'no-one') {
      return res.status(403).json({ message: 'This user is not accepting friend requests' });
    }

    if (permission === 'friends-of-friends') {
      // Check if they have mutual friends
      const mutualFriends = currentUser.friends.filter(friendId =>
        targetUser.friends.some(targetFriendId => targetFriendId.toString() === friendId.toString())
      );

      if (mutualFriends.length === 0) {
        return res.status(403).json({ message: 'You must have mutual friends to send a friend request' });
      }
    }

    next();
  } catch (error) {
    console.error('Check friend request permission error:', error);
    res.status(500).json({ message: 'Server error' });
  }
  */
};

// Check if user can send message
export const checkMessagingPermission = async (req, res, next) => {
  try {
    const currentUserId = req.userId;
    const recipientId = req.body.recipient || req.params.userId;

    if (!recipientId) {
      return next();
    }

    if (currentUserId === recipientId) {
      return res.status(400).json({ message: 'Cannot send message to yourself' });
    }

    // PHASE 1 REFACTOR: Use followers only (friends system removed)
    const recipient = await User.findById(recipientId).select('privacySettings followers blockedUsers');
    const currentUser = await User.findById(currentUserId).select('blockedUsers');

    if (!recipient) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if blocked
    if (recipient.blockedUsers.includes(currentUserId) || currentUser.blockedUsers.includes(recipientId)) {
      return res.status(403).json({ message: 'Cannot send message to this user' });
    }

    const permission = recipient.privacySettings?.whoCanMessage || 'followers';

    if (permission === 'no-one') {
      return res.status(403).json({ message: 'This user is not accepting messages' });
    }

    // PHASE 1 REFACTOR: Only check followers (friends removed)
    if (permission === 'friends' || permission === 'followers') {
      const isFollower = recipient.followers?.some(followerId => followerId.toString() === currentUserId);

      if (!isFollower) {
        return res.status(403).json({ message: 'You must be a follower to send a message' });
      }
    }

    next();
  } catch (error) {
    console.error('Check messaging permission error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

