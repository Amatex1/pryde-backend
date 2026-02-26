/**
 * Life-Signal Feature 3: "Someone felt this too" Resonance Signals
 * 
 * Silent resonance tracking with rate-limited author notifications.
 * - No exposed counts
 * - No names shown to authors
 * - Rate-limited soft notifications
 */

import express from 'express';
import Resonance from '../models/Resonance.js';
import Post from '../models/Post.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendPushNotification } from './pushNotifications.js';

const router = express.Router();

// Rate limit: Only send resonance notification once per post per day
const RESONANCE_NOTIFICATION_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

// Soft notification messages (rotated randomly)
const RESONANCE_MESSAGES = [
  "Someone quietly resonated with something you shared.",
  "Your words touched someone today.",
  "Something you wrote connected with a reader.",
  "A quiet moment of connection happened with your post.",
  "Someone felt seen because of what you shared."
];

// @route   POST /api/resonance
// @desc    Record a resonance event (silent, no response to author)
// @access  Private
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { postId, type } = req.body;
    
    if (!postId || !type) {
      return res.status(400).json({ message: 'Post ID and type are required' });
    }
    
    if (!['reaction', 'bookmark', 'read'].includes(type)) {
      return res.status(400).json({ message: 'Invalid resonance type' });
    }
    
    // Check if post exists
    const post = await Post.findById(postId).select('author');
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Don't record resonance for own posts
    if (post.author.toString() === req.user.id) {
      return res.json({ recorded: false, reason: 'own_post' });
    }
    
    // Try to create resonance (will fail if duplicate)
    try {
      await Resonance.create({
        user: req.user.id,
        post: postId,
        type
      });
    } catch (err) {
      // Duplicate resonance is fine, just ignore
      if (err.code !== 11000) throw err;
      return res.json({ recorded: false, reason: 'duplicate' });
    }
    
    // Check if we should send a soft notification to author
    await maybeSendResonanceNotification(post.author, postId);
    
    res.json({ recorded: true });
  } catch (error) {
    console.error('Record resonance error:', error);
    res.status(500).json({ message: 'Failed to record resonance' });
  }
});

/**
 * Maybe send a resonance notification to the author.
 * Rate-limited: only once per post per 24 hours.
 */
async function maybeSendResonanceNotification(authorId, postId) {
  try {
    // Check if we've sent a resonance notification for this post recently
    const recentNotification = await Notification.findOne({
      recipient: authorId,
      type: 'resonance',
      postId,
      createdAt: { $gt: new Date(Date.now() - RESONANCE_NOTIFICATION_COOLDOWN_MS) }
    });
    
    if (recentNotification) {
      return; // Already notified recently
    }
    
    // Count resonances for this post (don't expose exact number)
    const resonanceCount = await Resonance.countDocuments({ post: postId });
    
    // Only notify after a few resonances (threshold: 3+)
    if (resonanceCount < 3) {
      return;
    }
    
    // Get author's system user for sender (or use the author as both)
    const systemUser = await User.findOne({ username: 'pryde' }).select('_id');
    const senderId = systemUser?._id || authorId;
    
    // Pick a random message
    const message = RESONANCE_MESSAGES[Math.floor(Math.random() * RESONANCE_MESSAGES.length)];
    
    // Create soft notification
    await Notification.create({
      recipient: authorId,
      sender: senderId,
      type: 'resonance',
      message,
      postId,
      link: `/feed?post=${postId}`
    });

    // Send push notification (fire-and-forget)
    sendPushNotification(authorId, {
      title: 'Someone felt this too',
      body: message,
      data: { type: 'resonance', url: `/feed?post=${postId}` }
    }).catch(() => {});
  } catch (error) {
    console.error('Send resonance notification error:', error);
    // Don't throw - this is a background operation
  }
}

export default router;

