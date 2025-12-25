import express from 'express';
const router = express.Router();
import User from '../models/User.js';
import auth from '../middleware/auth.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import SecurityLog from '../models/SecurityLog.js';
import { sendRecoveryContactNotificationEmail } from '../utils/emailService.js';

// @route   GET /api/recovery-contacts
// @desc    Get user's recovery contacts
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate('recoveryContacts.user', 'username displayName profilePhoto');

    res.json({ recoveryContacts: user.recoveryContacts || [] });
  } catch (error) {
    console.error('Get recovery contacts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/recovery-contacts/add
// @desc    Add a recovery contact
// @access  Private
router.post('/add', auth, async (req, res) => {
  try {
    const { contactUserId } = req.body;

    if (!contactUserId) {
      return res.status(400).json({ message: 'Contact user ID is required' });
    }

    const user = await User.findById(req.userId);
    const contactUser = await User.findById(contactUserId);

    if (!contactUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already added
    const existing = user.recoveryContacts.find(
      rc => rc.user.toString() === contactUserId
    );

    if (existing) {
      return res.status(400).json({ message: 'This user is already a recovery contact' });
    }

    // Limit to 5 recovery contacts
    if (user.recoveryContacts.length >= 5) {
      return res.status(400).json({ message: 'Maximum 5 recovery contacts allowed' });
    }

    // Add recovery contact
    user.recoveryContacts.push({
      user: contactUserId,
      status: 'pending',
      addedAt: new Date()
    });

    await user.save();

    // TODO: Send notification to contact user

    await user.populate('recoveryContacts.user', 'username displayName profilePhoto');
    res.json({ recoveryContacts: user.recoveryContacts });
  } catch (error) {
    console.error('Add recovery contact error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/recovery-contacts/:contactId/accept
// @desc    Accept being someone's recovery contact
// @access  Private
router.post('/:contactId/accept', auth, async (req, res) => {
  try {
    const { contactId } = req.params;

    // Find the user who added current user as recovery contact
    const requester = await User.findOne({
      'recoveryContacts._id': contactId,
      'recoveryContacts.user': req.userId
    });

    if (!requester) {
      return res.status(404).json({ message: 'Recovery contact request not found' });
    }

    const contact = requester.recoveryContacts.id(contactId);
    contact.status = 'accepted';
    contact.acceptedAt = new Date();

    await requester.save();

    res.json({ message: 'Recovery contact accepted' });
  } catch (error) {
    console.error('Accept recovery contact error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/recovery-contacts/:contactId
// @desc    Remove a recovery contact
// @access  Private
router.delete('/:contactId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    user.recoveryContacts = user.recoveryContacts.filter(
      rc => rc._id.toString() !== req.params.contactId
    );

    await user.save();

    res.json({ message: 'Recovery contact removed', recoveryContacts: user.recoveryContacts });
  } catch (error) {
    console.error('Remove recovery contact error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/recovery-contacts/initiate-recovery
// @desc    Initiate account recovery (public - no auth required)
// @access  Public
router.post('/initiate-recovery', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ message: 'Email and new password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Don't reveal if email exists
      return res.json({ message: 'If this email has recovery contacts, they will be notified' });
    }

    const acceptedContacts = user.recoveryContacts.filter(
      c => c.status === 'accepted'
    );

    if (acceptedContacts.length < 2) {
      return res.status(400).json({
        error: 'At least 2 accepted recovery contacts are required to enable account recovery.'
      });
    }

    // Hash the new password (SECURITY: 12 rounds for stronger protection)
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Create recovery request
    const requestId = crypto.randomBytes(32).toString('hex');

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    user.recoveryRequests.push({
      requestId,
      contactsNotified: acceptedContacts.map(rc => rc.user),
      contactsApproved: [],
      requiredApprovals: Math.min(2, acceptedContacts.length),
      status: 'pending',
      newPasswordHash: hashedPassword,
      createdAt: new Date(),
      expiresAt
    });

    await user.save();

    // Send notifications to recovery contacts
    const notificationPromises = acceptedContacts.map(async (contact) => {
      try {
        // Populate contact user details
        const contactUser = await User.findById(contact.user).select('email username');

        if (!contactUser) {
          console.error(`Recovery contact user not found: ${contact.user}`);
          return { success: false, contactId: contact.user, error: 'User not found' };
        }

        // Send email notification
        const emailResult = await sendRecoveryContactNotificationEmail(
          contactUser.email,
          contactUser.username,
          user.username,
          requestId,
          expiresAt
        );

        // Log security event for each notified contact
        if (emailResult.success) {
          SecurityLog.create({
            type: 'recovery_contact_notified',
            severity: 'high',
            userId: contactUser._id,
            username: contactUser.username,
            email: contactUser.email,
            ipAddress: req.headers['x-forwarded-for']?.split(',')[0].trim() ||
                       req.headers['x-real-ip'] ||
                       req.connection?.remoteAddress ||
                       'Unknown',
            userAgent: req.headers['user-agent'] || 'Unknown',
            details: `Notified as recovery contact for ${user.username}'s account recovery request. Request ID: ${requestId}`,
            action: 'logged'
          }).catch(err => {
            console.error('Failed to log recovery contact notification:', err);
          });
        }

        return {
          success: emailResult.success,
          contactId: contact.user,
          contactUsername: contactUser.username,
          error: emailResult.error
        };
      } catch (error) {
        console.error(`Error notifying recovery contact ${contact.user}:`, error);
        return { success: false, contactId: contact.user, error: error.message };
      }
    });

    // Wait for all notifications to complete (don't block response)
    Promise.all(notificationPromises).then(results => {
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      console.log(`Recovery contact notifications: ${successCount} sent, ${failureCount} failed`);

      if (failureCount > 0) {
        console.error('Failed notifications:', results.filter(r => !r.success));
      }
    }).catch(err => {
      console.error('Error processing recovery contact notifications:', err);
    });

    res.json({
      message: 'Recovery request sent to your trusted contacts',
      requestId
    });
  } catch (error) {
    console.error('Initiate recovery error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/recovery-contacts/approve-recovery/:requestId
// @desc    Approve a recovery request
// @access  Private
router.post('/approve-recovery/:requestId', auth, async (req, res) => {
  try {
    const { requestId } = req.params;

    // Find user with this recovery request
    const user = await User.findOne({ 'recoveryRequests.requestId': requestId });

    if (!user) {
      return res.status(404).json({ message: 'Recovery request not found' });
    }

    const request = user.recoveryRequests.find(r => r.requestId === requestId);

    if (!request) {
      return res.status(404).json({ message: 'Recovery request not found' });
    }

    // Check if expired
    if (new Date() > request.expiresAt) {
      request.status = 'expired';
      await user.save();
      return res.status(400).json({ message: 'Recovery request has expired' });
    }

    // Check if current user is a notified contact
    if (!request.contactsNotified.some(c => c.toString() === req.userId.toString())) {
      return res.status(403).json({ message: 'You are not authorized to approve this request' });
    }

    // Check if already approved
    if (request.contactsApproved.some(c => c.toString() === req.userId.toString())) {
      return res.status(400).json({ message: 'You have already approved this request' });
    }

    // Add approval
    request.contactsApproved.push(req.userId);

    // Check if enough approvals
    if (request.contactsApproved.length >= request.requiredApprovals) {
      request.status = 'approved';
      user.password = request.newPasswordHash;
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;

      // CRITICAL SECURITY: Reset 2FA to prevent compromised second-factor persistence
      const had2FAEnabled = user.twoFactorEnabled || user.pushTwoFactorEnabled;
      user.twoFactorEnabled = false;
      user.twoFactorSecret = null;
      user.twoFactorBackupCodes = [];
      user.pushTwoFactorEnabled = false;

      // Save user first
      await user.save();

      // Log security event (async, don't wait)
      if (had2FAEnabled) {
        SecurityLog.create({
          type: 'account_recovery_2fa_reset',
          severity: 'critical',
          userId: user._id,
          username: user.username,
          email: user.email,
          ipAddress: req.headers['x-forwarded-for']?.split(',')[0].trim() ||
                     req.headers['x-real-ip'] ||
                     req.connection?.remoteAddress ||
                     'Unknown',
          userAgent: req.headers['user-agent'] || 'Unknown',
          details: `Account recovered via trusted contacts. 2FA has been reset and must be re-enabled. Recovery request: ${requestId}`,
          action: 'logged'
        }).catch(err => {
          console.error('Failed to log account recovery 2FA reset:', err);
        });
      }

      res.json({
        message: 'Recovery request approved. Account recovered successfully. For security, 2FA has been reset and must be re-enabled.',
        approved: request.contactsApproved.length,
        required: request.requiredApprovals,
        status: request.status,
        twoFactorReset: had2FAEnabled
      });
    } else {
      // Not enough approvals yet
      await user.save();

      res.json({
        message: 'Recovery request approved',
        approved: request.contactsApproved.length,
        required: request.requiredApprovals,
        status: request.status
      });
    }
  } catch (error) {
    console.error('Approve recovery error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

