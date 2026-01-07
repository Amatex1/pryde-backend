import User from '../models/User.js';
import { isBlocked } from '../utils/blockHelper.js';

// Helper function to fetch user by ID or username
const getUserByIdOrUsername = async (identifier) => {
  const mongoose = (await import('mongoose')).default;
  if (mongoose.Types.ObjectId.isValid(identifier) && identifier.length === 24) {
    return User.findById(identifier);
  }
  return User.findOne({ username: identifier });
};

// Check if user is blocked
export const checkBlocked = async (req, res, next) => {
  try {
    const currentUserId = req.userId;
    const targetUserId = req.params.userId || req.params.id || req.body.recipient;
    if (!targetUserId || currentUserId === targetUserId) {
      return next();
    }
    // Check if users have blocked each other (bidirectional)
    const blocked = await isBlocked(currentUserId, targetUserId);
    if (blocked) {
      return res.status(403).json({ message: 'You cannot interact with this user' });
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
    let profileUser = await getUserByIdOrUsername(profileIdentifier);
    if (!profileUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    profileUser = await profileUser.select('_id privacySettings friends followers');
    // User can always view their own profile
    if (currentUserId === profileUser._id.toString()) {
      return next();
    }
    // Check if blocked using Block model
    const blocked = await isBlocked(currentUserId, profileUser._id.toString());
    if (blocked) {
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
    const recipient = await User.findById(recipientId).select('privacySettings followers isActive isDeleted');
    if (!recipient) {
      return res.status(404).json({ message: 'User not found' });
    }
    // CRITICAL: Block messaging to deleted users
    if (recipient.isDeleted) {
      return res.status(404).json({ message: 'User not found' });
    }
    // CRITICAL: Block messaging to deactivated users
    if (!recipient.isActive) {
      return res.status(403).json({ message: 'This user is not available' });
    }
    // Check if blocked using Block model
    const blocked = await isBlocked(currentUserId, recipientId);
    if (blocked) {
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
