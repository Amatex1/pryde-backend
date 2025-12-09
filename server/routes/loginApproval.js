import express from 'express';
import jwt from 'jsonwebtoken';
import LoginApproval from '../models/LoginApproval.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendPushNotification } from './pushNotifications.js';
import config from '../config/config.js';

const router = express.Router();

// Generate random 2-digit code
function generateVerificationCode() {
  return Math.floor(10 + Math.random() * 90).toString(); // 10-99
}

// @route   POST /api/login-approval/request
// @desc    Create a login approval request (called during login)
// @access  Public (but requires valid user ID)
router.post('/request', async (req, res) => {
  try {
    const { userId, deviceInfo, browser, os, ipAddress, location } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has push 2FA enabled
    if (!user.pushTwoFactorEnabled) {
      return res.status(400).json({ message: 'Push 2FA is not enabled for this account' });
    }

    // Check if user has push subscription
    if (!user.pushSubscription) {
      return res.status(400).json({ 
        message: 'No push subscription found. Please enable notifications in the app.',
        fallbackToTOTP: user.twoFactorEnabled // Can fall back to TOTP if enabled
      });
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();

    // Create temporary token (valid for 5 minutes)
    const tempToken = jwt.sign(
      { userId: user._id, requiresApproval: true },
      config.jwtSecret,
      { expiresIn: '5m' }
    );

    // Create login approval request
    const approval = new LoginApproval({
      user: user._id,
      verificationCode,
      deviceInfo: deviceInfo || 'Unknown Device',
      browser: browser || '',
      os: os || '',
      ipAddress: ipAddress || 'Unknown',
      location: location || { city: '', region: '', country: '' },
      tempToken,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    });

    await approval.save();

    // Create notification
    const notification = new Notification({
      recipient: user._id,
      sender: user._id, // Self-notification
      type: 'login_approval',
      message: `New login attempt from ${deviceInfo || 'Unknown Device'}. Verification code: ${verificationCode}`,
      loginApprovalId: approval._id,
      loginApprovalData: {
        verificationCode,
        deviceInfo: deviceInfo || 'Unknown Device',
        browser: browser || '',
        os: os || '',
        ipAddress: ipAddress || 'Unknown',
        location: location || { city: '', region: '', country: '' }
      }
    });

    await notification.save();

    // Send push notification
    try {
      await sendPushNotification(user._id, {
        title: '🔐 Login Approval Required',
        body: `New login from ${deviceInfo || 'Unknown Device'}. Code: ${verificationCode}`,
        data: {
          type: 'login_approval',
          approvalId: approval._id.toString(),
          verificationCode,
          deviceInfo: deviceInfo || 'Unknown Device',
          browser: browser || '',
          os: os || '',
          ipAddress: ipAddress || 'Unknown',
          url: '/notifications'
        },
        tag: 'login-approval',
        requireInteraction: true // Keep notification visible until user interacts
      });
    } catch (pushError) {
      console.error('Failed to send push notification:', pushError);
      // Continue anyway - user can still see in-app notification
    }

    res.json({
      success: true,
      approvalId: approval._id,
      verificationCode, // Show this on login screen
      expiresIn: 300, // 5 minutes in seconds
      message: 'Login approval request sent. Check your other devices for the verification code.'
    });
  } catch (error) {
    console.error('Login approval request error:', error);
    res.status(500).json({ message: 'Server error creating login approval request' });
  }
});

// @route   POST /api/login-approval/approve
// @desc    Approve a login request (called from authenticated device)
// @access  Private (requires authentication)
router.post('/approve', authenticateToken, async (req, res) => {
  try {
    const { approvalId } = req.body;

    if (!approvalId) {
      return res.status(400).json({ message: 'Approval ID is required' });
    }

    const approval = await LoginApproval.findById(approvalId);
    if (!approval) {
      return res.status(404).json({ message: 'Login approval request not found' });
    }

    // Check if request belongs to the authenticated user
    if (approval.user.toString() !== req.userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Check if already responded
    if (approval.status !== 'pending') {
      return res.status(400).json({ message: `Login request already ${approval.status}` });
    }

    // Check if expired
    if (new Date() > approval.expiresAt) {
      approval.status = 'expired';
      await approval.save();
      return res.status(400).json({ message: 'Login approval request has expired' });
    }

    // Approve the login
    approval.status = 'approved';
    approval.respondedAt = new Date();
    await approval.save();

    res.json({
      success: true,
      message: 'Login approved successfully',
      tempToken: approval.tempToken
    });
  } catch (error) {
    console.error('Login approval error:', error);
    res.status(500).json({ message: 'Server error approving login' });
  }
});

// @route   POST /api/login-approval/deny
// @desc    Deny a login request (called from authenticated device)
// @access  Private (requires authentication)
router.post('/deny', authenticateToken, async (req, res) => {
  try {
    const { approvalId } = req.body;

    if (!approvalId) {
      return res.status(400).json({ message: 'Approval ID is required' });
    }

    const approval = await LoginApproval.findById(approvalId);
    if (!approval) {
      return res.status(404).json({ message: 'Login approval request not found' });
    }

    // Check if request belongs to the authenticated user
    if (approval.user.toString() !== req.userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Check if already responded
    if (approval.status !== 'pending') {
      return res.status(400).json({ message: `Login request already ${approval.status}` });
    }

    // Deny the login
    approval.status = 'denied';
    approval.respondedAt = new Date();
    await approval.save();

    res.json({
      success: true,
      message: 'Login denied successfully'
    });
  } catch (error) {
    console.error('Login denial error:', error);
    res.status(500).json({ message: 'Server error denying login' });
  }
});

// @route   GET /api/login-approval/status/:approvalId
// @desc    Check status of a login approval request (polled by login screen)
// @access  Public (but requires approval ID)
router.get('/status/:approvalId', async (req, res) => {
  try {
    const { approvalId } = req.params;

    const approval = await LoginApproval.findById(approvalId);
    if (!approval) {
      return res.status(404).json({ message: 'Login approval request not found' });
    }

    // Check if expired
    if (approval.status === 'pending' && new Date() > approval.expiresAt) {
      approval.status = 'expired';
      await approval.save();
    }

    res.json({
      status: approval.status,
      respondedAt: approval.respondedAt,
      tempToken: approval.status === 'approved' ? approval.tempToken : null
    });
  } catch (error) {
    console.error('Login approval status error:', error);
    res.status(500).json({ message: 'Server error checking login approval status' });
  }
});

// @route   GET /api/login-approval/pending
// @desc    Get pending login approval requests for the authenticated user
// @access  Private (requires authentication)
router.get('/pending', authenticateToken, async (req, res) => {
  try {
    const approvals = await LoginApproval.find({
      user: req.userId,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    res.json({ approvals });
  } catch (error) {
    console.error('Pending approvals error:', error);
    res.status(500).json({ message: 'Server error fetching pending approvals' });
  }
});

// @route   POST /api/login-approval/enable
// @desc    Enable push-based 2FA
// @access  Private (requires authentication)
router.post('/enable', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has push subscription
    if (!user.pushSubscription) {
      return res.status(400).json({
        message: 'Please enable push notifications first before enabling push 2FA'
      });
    }

    user.pushTwoFactorEnabled = true;
    user.preferPushTwoFactor = true;
    await user.save();

    res.json({
      success: true,
      message: 'Push 2FA enabled successfully'
    });
  } catch (error) {
    console.error('Enable push 2FA error:', error);
    res.status(500).json({ message: 'Server error enabling push 2FA' });
  }
});

// @route   POST /api/login-approval/disable
// @desc    Disable push-based 2FA
// @access  Private (requires authentication)
router.post('/disable', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.pushTwoFactorEnabled = false;
    await user.save();

    res.json({
      success: true,
      message: 'Push 2FA disabled successfully'
    });
  } catch (error) {
    console.error('Disable push 2FA error:', error);
    res.status(500).json({ message: 'Server error disabling push 2FA' });
  }
});

export default router;

