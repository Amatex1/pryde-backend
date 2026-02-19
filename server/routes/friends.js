import express from 'express';
const router = express.Router();
import User from '../models/User.js';
import FriendRequest from '../models/FriendRequest.js';
import Notification from '../models/Notification.js';
import auth from '../middleware/auth.js';
import { friendRequestLimiter } from '../middleware/rateLimiter.js';
import { checkFriendRequestPermission, checkBlocked } from '../middleware/privacy.js';
import { sendPushNotification } from './pushNotifications.js';
import { emitNotificationCreated } from '../utils/notificationEmitter.js';
import logger from '../utils/logger.js';

// @route   POST /api/friends/request/:userId
// @desc    Send friend request
// @access  Private
router.post('/request/:userId', auth, friendRequestLimiter, checkFriendRequestPermission, async (req, res) => {
  try {
    const receiverId = req.params.userId;
    const senderId = req.userId;

    if (receiverId === senderId) {
      return res.status(400).json({ message: 'Cannot send friend request to yourself' });
    }

    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Idempotent: if already friends, return success (no-op)
    const sender = await User.findById(senderId);
    if (sender.friends.includes(receiverId)) {
      logger.debug('noop.friend_request.already_friends', {
        userId: senderId,
        targetId: receiverId,
        endpoint: 'POST /friends/request/:userId'
      });
      return res.json({
        message: 'Already friends',
        friendRequest: null
      });
    }

    // Idempotent: if request exists, return success (no-op)
    let friendRequest = await FriendRequest.findOne({
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId }
      ],
      status: 'pending'
    });

    if (friendRequest) {
      logger.debug('noop.friend_request.request_exists', {
        userId: senderId,
        targetId: receiverId,
        endpoint: 'POST /friends/request/:userId'
      });
      return res.json({
        message: 'Friend request sent',
        friendRequest
      });
    }

    // Create friend request
    friendRequest = new FriendRequest({
      sender: senderId,
      receiver: receiverId
    });

    await friendRequest.save();

    // Create notification for receiver
    const notification = new Notification({
      recipient: receiverId,
      sender: senderId,
      type: 'friend_request',
      message: 'sent you a friend request'
    });
    await notification.save();
    await notification.populate('sender', 'username displayName profilePhoto');

    // ✅ Emit real-time notification
    emitNotificationCreated(req.io, receiverId, notification);

    // ✅ Emit friend update event to both users
    req.io.to(`user:${senderId}`).emit('friend:request_sent', { receiverId });
    req.io.to(`user:${receiverId}`).emit('friend:request_received', { senderId });

    // ✅ Push notification for receiver (app may be closed/backgrounded)
    const senderName = sender.displayName || sender.username;
    sendPushNotification(receiverId, {
      title: '👋 New Friend Request',
      body: `${senderName} sent you a friend request`,
      data: { type: 'friend_request', url: '/friends' },
      tag: `friend-request-${senderId}`
    }).catch(err => logger.error('Push notification error:', err));

    res.status(201).json({ message: 'Friend request sent', friendRequest });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/friends/request/:requestId
// @desc    Cancel friend request
// @access  Private
router.delete('/request/:requestId', auth, async (req, res) => {
  try {
    const friendRequest = await FriendRequest.findById(req.params.requestId);

    if (!friendRequest) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    if (friendRequest.sender.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await FriendRequest.findByIdAndDelete(req.params.requestId);

    res.json({ message: 'Friend request cancelled' });
  } catch (error) {
    console.error('Cancel request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/friends/accept/:requestId
// @desc    Accept friend request
// @access  Private
router.post('/accept/:requestId', auth, async (req, res) => {
  try {
    const friendRequest = await FriendRequest.findById(req.params.requestId);

    if (!friendRequest) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    if (friendRequest.receiver.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (friendRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Request already processed' });
    }

    // Update friend request status
    friendRequest.status = 'accepted';
    await friendRequest.save();

    // Add to friends list for both users
    await User.findByIdAndUpdate(friendRequest.sender, {
      $addToSet: { friends: friendRequest.receiver }
    });

    await User.findByIdAndUpdate(friendRequest.receiver, {
      $addToSet: { friends: friendRequest.sender }
    });

    // Create notification for sender
    const notification = new Notification({
      recipient: friendRequest.sender,
      sender: req.userId,
      type: 'friend_accept',
      message: 'accepted your friend request'
    });
    await notification.save();
    await notification.populate('sender', 'username displayName profilePhoto');

    // ✅ Emit real-time notification
    emitNotificationCreated(req.io, friendRequest.sender.toString(), notification);

    // ✅ Emit friend update event to both users
    req.io.to(`user:${friendRequest.sender}`).emit('friend:added', {
      friendId: friendRequest.receiver
    });
    req.io.to(`user:${friendRequest.receiver}`).emit('friend:added', {
      friendId: friendRequest.sender
    });

    // ✅ Push notification for original sender (app may be closed/backgrounded)
    const accepterName = notification.sender.displayName || notification.sender.username;
    sendPushNotification(friendRequest.sender, {
      title: '🎉 Friend Request Accepted',
      body: `${accepterName} accepted your friend request`,
      data: { type: 'friend_accept', url: '/friends' },
      tag: `friend-accept-${req.userId}`
    }).catch(err => logger.error('Push notification error:', err));

    res.json({ message: 'Friend request accepted' });
  } catch (error) {
    console.error('Accept request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/friends/decline/:requestId
// @desc    Decline friend request
// @access  Private
router.post('/decline/:requestId', auth, async (req, res) => {
  try {
    const friendRequest = await FriendRequest.findById(req.params.requestId);

    if (!friendRequest) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    if (friendRequest.receiver.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    friendRequest.status = 'declined';
    await friendRequest.save();

    // ✅ Emit friend update event to sender (request was declined)
    req.io.to(`user:${friendRequest.sender}`).emit('friend:request_declined', {
      receiverId: friendRequest.receiver
    });

    res.json({ message: 'Friend request declined' });
  } catch (error) {
    console.error('Decline request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/friends/:friendId
// @desc    Remove friend
// @access  Private
router.delete('/:friendId', auth, async (req, res) => {
  try {
    const friendId = req.params.friendId;
    const userId = req.userId;

    // Remove from both users' friends lists
    await User.findByIdAndUpdate(userId, {
      $pull: { friends: friendId }
    });

    await User.findByIdAndUpdate(friendId, {
      $pull: { friends: userId }
    });

    // Delete any friend requests between them
    await FriendRequest.deleteMany({
      $or: [
        { sender: userId, receiver: friendId },
        { sender: friendId, receiver: userId }
      ]
    });

    // ✅ Emit friend update event to both users
    req.io.to(`user:${userId}`).emit('friend:removed', { friendId });
    req.io.to(`user:${friendId}`).emit('friend:removed', { friendId: userId });

    res.json({ message: 'Friend removed' });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/friends
// @desc    Get user's friends list (includes deactivated users, excludes blocked users)
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId)
      .populate({
        path: 'friends',
        match: { isBanned: { $ne: true } }, // Exclude banned users, but include deactivated
        select: 'username displayName profilePhoto bio lastSeen isActive'
      })
      .select('blockedUsers');

    // Filter out null values (banned friends) and users who have blocked the current user
    let friends = (currentUser.friends || []).filter(friend => friend !== null);

    // Filter out users who are in the current user's blocked list
    // SAFETY: blockedUsers may be undefined for older users
    const blockedUsers = currentUser.blockedUsers || [];
    friends = friends.filter(friend =>
      !blockedUsers.some(blockedId => blockedId.toString() === friend._id.toString())
    );

    // PERFORMANCE: Batch fetch all friend users in ONE query instead of N queries
    // This replaces N+1 pattern with a single query
    const friendIds = friends.map(f => f._id);
    const friendUsers = await User.find({
      _id: { $in: friendIds }
    }).select('_id blockedUsers').lean();

    // Create a map for O(1) lookup
    const friendBlockMap = new Map();
    friendUsers.forEach(fu => {
      const isBlockedByFriend = (fu.blockedUsers || []).some(
        blockedId => blockedId.toString() === req.userId
      );
      friendBlockMap.set(fu._id.toString(), isBlockedByFriend);
    });

    // Filter out users who have blocked the current user
    const filteredFriends = friends.filter(friend => {
      const isBlocked = friendBlockMap.get(friend._id.toString());
      return !isBlocked;
    });

    res.json(filteredFriends);
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/friends/online
// @desc    Get online friends with full details
// @access  Private
router.get('/online', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('friends');
    const onlineUsers = req.app.get('onlineUsers');

    if (!onlineUsers) {
      return res.json([]);
    }

    // Filter friends who are online
    const onlineFriendIds = user.friends.filter(friendId =>
      onlineUsers.has(friendId.toString())
    );

    // Fetch full user details (only active, non-banned users)
    const onlineFriends = await User.find({
      _id: { $in: onlineFriendIds },
      isActive: true,
      isBanned: { $ne: true }
    }).select('username displayName profilePhoto lastSeen');

    res.json(onlineFriends);
  } catch (error) {
    console.error('Get online friends error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/friends/offline
// @desc    Get offline friends with lastSeen timestamp
// @access  Private
router.get('/offline', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('friends');
    const onlineUsers = req.app.get('onlineUsers');

    // Filter friends who are offline
    const offlineFriendIds = user.friends.filter(friendId =>
      !onlineUsers || !onlineUsers.has(friendId.toString())
    );

    // Fetch full user details (only active, non-banned users)
    const offlineFriends = await User.find({
      _id: { $in: offlineFriendIds },
      isActive: true,
      isBanned: { $ne: true }
    }).select('username displayName profilePhoto lastSeen');

    res.json(offlineFriends);
  } catch (error) {
    console.error('Get offline friends error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/friends/requests/pending
// @desc    Get pending friend requests (received)
// @access  Private
router.get('/requests/pending', auth, async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      receiver: req.userId,
      status: 'pending'
    })
    .populate('sender', 'username displayName profilePhoto')
    .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/friends/requests/sent
// @desc    Get sent friend requests (pending)
// @access  Private
router.get('/requests/sent', auth, async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      sender: req.userId,
      status: 'pending'
    })
    .populate('receiver', 'username displayName profilePhoto')
    .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Get sent requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/friends/mutual/:userId
// @desc    Get mutual friends with another user
// @access  Private
router.get('/mutual/:userId', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId).select('friends');
    const otherUser = await User.findById(req.params.userId).select('friends');

    if (!otherUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find intersection of friends
    const mutualFriendIds = currentUser.friends.filter(friendId =>
      otherUser.friends.some(otherId => otherId.equals(friendId))
    );

    const mutualFriends = await User.find({
      _id: { $in: mutualFriendIds }
    }).select('username displayName profilePhoto');

    res.json(mutualFriends);
  } catch (error) {
    console.error('Get mutual friends error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
