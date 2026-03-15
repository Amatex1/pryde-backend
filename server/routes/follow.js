import express from 'express';
const router = express.Router();
import User from '../models/User.js';
import Follow from '../models/Follow.js';
import FollowRequest from '../models/FollowRequest.js';
import Notification from '../models/Notification.js';
import auth from '../middleware/auth.js';
import requireActiveUser from '../middleware/requireActiveUser.js';
import requireEmailVerification from '../middleware/requireEmailVerification.js';
import { checkBlocked } from '../middleware/privacy.js';
import { guardFollow } from '../middleware/systemAccountGuard.js';
import logger from '../utils/logger.js';
import { validateParamId } from '../middleware/validation.js';
import { emitNotificationCreated } from '../utils/notificationEmitter.js';
import { sendPushNotification } from './pushNotifications.js';

// @route   POST /api/follow/:userId
// @desc    Follow a user (instant for public accounts, request for private)
// @access  Private (System accounts cannot follow users, requires email verification)
router.post('/:userId', auth, requireActiveUser, requireEmailVerification, guardFollow, checkBlocked, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.userId;

    if (targetUserId === currentUserId) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }

    const targetUser = await User.findById(targetUserId).select('privacySettings followers username');
    const currentUser = await User.findById(currentUserId).select('following username');

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Idempotent: if already following, return success (no-op)
    if (currentUser.following.includes(targetUserId)) {
      logger.debug('noop.follow.already_following', {
        userId: currentUserId,
        targetId: targetUserId,
        endpoint: 'POST /follow/:userId'
      });
      return res.json({
        message: 'Now following user',
        following: currentUser.following
      });
    }

    // Check if account is private
    const isPrivate = targetUser.privacySettings?.isPrivateAccount || false;

    if (isPrivate) {
      // Check if follow request already exists
      let followRequest = await FollowRequest.findOne({
        sender: currentUserId,
        receiver: targetUserId,
        status: 'pending'
      });

      // Idempotent: if request exists, return success (no-op)
      if (followRequest) {
        logger.debug('noop.follow.request_exists', {
          userId: currentUserId,
          targetId: targetUserId,
          endpoint: 'POST /follow/:userId'
        });
        return res.json({
          message: 'Follow request sent',
          requiresApproval: true,
          followRequest
        });
      }

      // Create follow request
      followRequest = new FollowRequest({
        sender: currentUserId,
        receiver: targetUserId
      });

      await followRequest.save();

      // 🔔 Create notification for follow request
      try {
        const notification = new Notification({
          recipient: targetUserId,
          sender: currentUserId,
          type: 'system', // Using 'system' type for follow requests
          message: 'sent you a follow request'
        });
        await notification.save();
        await notification.populate('sender', 'username displayName profilePhoto');

        // ✅ Emit real-time notification
        emitNotificationCreated(req.io, targetUserId.toString(), notification);

        // Send push notification
        const requester = await User.findById(currentUserId).select('username displayName');
        const requesterName = requester.displayName || requester.username;

        sendPushNotification(targetUserId, {
          title: 'Pryde Social',
          body: `${requesterName} wants to follow you`,
          data: {
            type: 'follow_request',
            userId: currentUserId.toString(),
            url: `/profile/${requester.username}`
          },
          tag: `follow-request-${currentUserId}`
        }).catch(err => logger.error('Push notification error:', err));
      } catch (notificationError) {
        // Don't fail the request if notification creation fails
        logger.error('Failed to create follow request notification:', notificationError);
      }

      return res.status(201).json({
        message: 'Follow request sent',
        requiresApproval: true,
        followRequest
      });
    } else {
      // Public account - instant follow (atomic $addToSet prevents duplicates under concurrent requests)
      await User.updateOne({ _id: targetUserId }, { $addToSet: { followers: currentUserId } });
      await User.updateOne({ _id: currentUserId }, { $addToSet: { following: targetUserId } });

      // Primary follow record (separate collection)
      await Follow.findOneAndUpdate(
        { follower: currentUserId, following: targetUserId },
        { follower: currentUserId, following: targetUserId },
        { upsert: true, new: true }
      );

      // 🔔 Create notification for new follower
      try {
        const notification = new Notification({
          recipient: targetUserId,
          sender: currentUserId,
          type: 'system', // Using 'system' type for follows (no dedicated 'follow' type)
          message: 'started following you'
        });
        await notification.save();
        await notification.populate('sender', 'username displayName profilePhoto');

        // ✅ Emit real-time notification
        emitNotificationCreated(req.io, targetUserId.toString(), notification);

        // Send push notification
        const follower = await User.findById(currentUserId).select('username displayName');
        const followerName = follower.displayName || follower.username;

        sendPushNotification(targetUserId, {
          title: 'Pryde Social',
          body: `${followerName} started following you`,
          data: {
            type: 'follow',
            userId: currentUserId.toString(),
            url: `/profile/${follower.username}`
          },
          tag: `follow-${currentUserId}`
        }).catch(err => logger.error('Push notification error:', err));
      } catch (notificationError) {
        // Don't fail the request if notification creation fails
        logger.error('Failed to create follow notification:', notificationError);
      }

      return res.status(200).json({
        message: `You are now following ${targetUser.username}`,
        requiresApproval: false
      });
    }
  } catch (error) {
    logger.error('Follow user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/follow/:userId
// @desc    Unfollow a user
// @access  Private
router.delete('/:userId', auth, requireActiveUser, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.userId;

    const targetUser = await User.findById(targetUserId).select('followers username');
    const currentUser = await User.findById(currentUserId).select('following');

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove from following/followers (User arrays — kept for backward compat)
    currentUser.following = currentUser.following.filter(id => id.toString() !== targetUserId);
    targetUser.followers = targetUser.followers.filter(id => id.toString() !== currentUserId);

    await currentUser.save();
    await targetUser.save();

    // Remove from dedicated Follow collection
    await Follow.deleteOne({ follower: currentUserId, following: targetUserId });

    res.json({ message: `Unfollowed ${targetUser.username}` });
  } catch (error) {
    logger.error('Unfollow user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/follow/followers/:userId
// @desc    Get user's followers
// @access  Private
router.get('/followers/:userId', auth, requireActiveUser, async (req, res) => {
  try {
    const userId = req.params.userId;
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const user = await User.findById(userId).select('username isActive isDeleted');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.isActive === false || user.isDeleted === true) return res.json({ followers: [], total: 0 });

    const [edges, total] = await Promise.all([
      Follow.find({ following: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate({
          path: 'follower',
          match: { isActive: true, isDeleted: { $ne: true }, isBanned: { $ne: true } },
          select: 'username displayName profilePhoto coverPhoto bio'
        }),
      Follow.countDocuments({ following: userId })
    ]);

    const followers = edges.map(e => e.follower).filter(Boolean);
    res.json({ followers, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    logger.error('Get followers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/follow/following/:userId
// @desc    Get users that this user is following
// @access  Private
router.get('/following/:userId', auth, requireActiveUser, async (req, res) => {
  try {
    const userId = req.params.userId;
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const user = await User.findById(userId).select('username isActive isDeleted');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.isActive === false || user.isDeleted === true) return res.json({ following: [], total: 0 });

    const [edges, total] = await Promise.all([
      Follow.find({ follower: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate({
          path: 'following',
          match: { isActive: true, isDeleted: { $ne: true }, isBanned: { $ne: true } },
          select: 'username displayName profilePhoto coverPhoto bio'
        }),
      Follow.countDocuments({ follower: userId })
    ]);

    const following = edges.map(e => e.following).filter(Boolean);
    res.json({ following, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    logger.error('Get following error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/follow/requests
// @desc    Get pending follow requests (received)
// @access  Private
router.get('/requests', auth, requireActiveUser, async (req, res) => {
  try {
    const followRequests = await FollowRequest.find({
      receiver: req.userId,
      status: 'pending'
    })
    .populate('sender', 'username displayName profilePhoto')
    .sort({ createdAt: -1 });

    res.json({ followRequests });
  } catch (error) {
    logger.error('Get follow requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/follow/requests/sent
// @desc    Get sent follow requests (pending)
// @access  Private
router.get('/requests/sent', auth, requireActiveUser, async (req, res) => {
  try {
    const sentRequests = await FollowRequest.find({
      sender: req.userId,
      status: 'pending'
    })
    .populate('receiver', 'username displayName profilePhoto')
    .sort({ createdAt: -1 });

    res.json({ sentRequests });
  } catch (error) {
    logger.error('Get sent follow requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/follow/requests/:requestId/accept
// @desc    Accept follow request
// @access  Private
router.post('/requests/:requestId/accept', auth, requireActiveUser, validateParamId('requestId'), async (req, res) => {
  try {
    const followRequest = await FollowRequest.findById(req.params.requestId);

    if (!followRequest) {
      return res.status(404).json({ message: 'Follow request not found' });
    }

    if (followRequest.receiver.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (followRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Request already processed' });
    }

    // Update follow request status
    followRequest.status = 'accepted';
    await followRequest.save();

    // Add to followers/following
    const receiver = await User.findById(followRequest.receiver);
    const sender = await User.findById(followRequest.sender);

    receiver.followers.push(followRequest.sender);
    sender.following.push(followRequest.receiver);

    await receiver.save();
    await sender.save();

    // Primary follow record
    await Follow.findOneAndUpdate(
      { follower: followRequest.sender, following: followRequest.receiver },
      { follower: followRequest.sender, following: followRequest.receiver },
      { upsert: true, new: true }
    );

    // 🔔 Create notification for follow request acceptance
    try {
      const notification = new Notification({
        recipient: followRequest.sender, // Notify the person who sent the request
        sender: followRequest.receiver,  // The person who accepted it
        type: 'system',
        message: 'accepted your follow request'
      });
      await notification.save();
      await notification.populate('sender', 'username displayName profilePhoto');

      // ✅ Emit real-time notification
      emitNotificationCreated(req.io, followRequest.sender.toString(), notification);

      // Send push notification
      const accepter = await User.findById(followRequest.receiver).select('username displayName');
      const accepterName = accepter.displayName || accepter.username;

      sendPushNotification(followRequest.sender, {
        title: 'Pryde Social',
        body: `${accepterName} accepted your follow request`,
        data: {
          type: 'follow_accepted',
          userId: followRequest.receiver.toString(),
          url: `/profile/${accepter.username}`
        },
        tag: `follow-accepted-${followRequest.receiver}`
      }).catch(err => logger.error('Push notification error:', err));
    } catch (notificationError) {
      // Don't fail the request if notification creation fails
      logger.error('Failed to create follow acceptance notification:', notificationError);
    }

    res.json({ message: 'Follow request accepted' });
  } catch (error) {
    logger.error('Accept follow request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/follow/requests/:requestId/reject
// @desc    Reject follow request
// @access  Private
router.post('/requests/:requestId/reject', auth, requireActiveUser, validateParamId('requestId'), async (req, res) => {
  try {
    const followRequest = await FollowRequest.findById(req.params.requestId);

    if (!followRequest) {
      return res.status(404).json({ message: 'Follow request not found' });
    }

    if (followRequest.receiver.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (followRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Request already processed' });
    }

    followRequest.status = 'rejected';
    await followRequest.save();

    res.json({ message: 'Follow request rejected' });
  } catch (error) {
    logger.error('Reject follow request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/follow/requests/:requestId
// @desc    Cancel follow request
// @access  Private
router.delete('/requests/:requestId', auth, requireActiveUser, validateParamId('requestId'), async (req, res) => {
  try {
    const followRequest = await FollowRequest.findById(req.params.requestId);

    if (!followRequest) {
      return res.status(404).json({ message: 'Follow request not found' });
    }

    if (followRequest.sender.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await followRequest.deleteOne();

    res.json({ message: 'Follow request cancelled' });
  } catch (error) {
    logger.error('Cancel follow request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

