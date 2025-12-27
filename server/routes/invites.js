import express from 'express';
import rateLimit from 'express-rate-limit';
import Invite from '../models/Invite.js';
import User from '../models/User.js';
import SecurityLog from '../models/SecurityLog.js';
import { authenticateToken } from '../middleware/auth.js';
import config from '../config/config.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Rate limiter for invite validation (anti-abuse)
const inviteValidationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { error: 'Too many invite validation attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for invite creation
const inviteCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: { error: 'Too many invite creation attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Helper: Check if user can create invites
 */
const canCreateInvite = (user) => {
  // Only admin and super_admin can create invites
  return ['admin', 'super_admin'].includes(user.role);
};

/**
 * Helper: Get client IP for logging
 */
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.headers['x-real-ip'] || 
         req.socket?.remoteAddress || 
         'unknown';
};

/**
 * @route   GET /api/invites/status
 * @desc    Check invite-only mode status (public)
 * @access  Public
 */
router.get('/status', (req, res) => {
  res.json({
    inviteOnlyMode: config.platform.inviteOnlyMode
  });
});

/**
 * @route   POST /api/invites/validate
 * @desc    Validate an invite code (for registration flow)
 * @access  Public
 */
router.post('/validate', inviteValidationLimiter, async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ 
        valid: false, 
        reason: 'invalid_format',
        message: 'Please enter an invite code.'
      });
    }
    
    // Normalize code (uppercase, trim)
    const normalizedCode = code.toUpperCase().trim();
    
    const invite = await Invite.findOne({ code: normalizedCode });
    
    if (!invite) {
      // Log failed validation attempt for security
      await SecurityLog.create({
        type: 'invite_validation_failed',
        severity: 'low',
        details: `Invalid invite code attempted: ${normalizedCode.substring(0, 10)}...`,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        action: 'blocked'
      });
      
      return res.json({ 
        valid: false, 
        reason: 'not_found',
        message: 'This invite code is not valid.'
      });
    }
    
    const validation = invite.isValid();
    
    if (!validation.valid) {
      const messages = {
        already_used: 'This invite has already been used.',
        expired: 'This invite has expired.',
        revoked: 'This invite is no longer valid.'
      };
      
      return res.json({ 
        valid: false, 
        reason: validation.reason,
        message: messages[validation.reason] || 'This invite is not valid.'
      });
    }
    
    res.json({ 
      valid: true,
      message: 'Invite is valid. You can proceed with registration.'
    });
    
  } catch (error) {
    logger.error('Invite validation error:', error);
    res.status(500).json({ 
      valid: false, 
      reason: 'server_error',
      message: 'Unable to validate invite. Please try again.'
    });
  }
});

/**
 * @route   POST /api/invites/create
 * @desc    Create a new invite (admin/super_admin only)
 * @access  Private (Admin)
 */
router.post('/create', authenticateToken, inviteCreationLimiter, async (req, res) => {
  try {
    const user = req.user;
    
    // Check eligibility
    if (!canCreateInvite(user)) {
      return res.status(403).json({ 
        error: 'You do not have permission to create invites.' 
      });
    }
    
    // Check cooldown (when was last invite created?)
    const lastInvite = await Invite.findOne({ createdBy: user._id })
      .sort({ createdAt: -1 });
    
    if (lastInvite) {
      const cooldownEnd = new Date(lastInvite.createdAt.getTime() + config.platform.inviteCooldownMs);
      if (new Date() < cooldownEnd) {
        const remainingMs = cooldownEnd - new Date();
        const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
        return res.status(429).json({
          error: `Please wait ${remainingDays} day(s) before creating another invite.`,
          cooldownEndsAt: cooldownEnd
        });
      }
    }

    // Check active invites limit (one at a time)
    const activeInvites = await Invite.countDocuments({
      createdBy: user._id,
      status: 'active'
    });

    if (activeInvites >= config.platform.maxActiveInvitesPerUser) {
      return res.status(400).json({
        error: 'You already have an active invite. Please wait for it to be used or expire.'
      });
    }

    // Generate unique invite code
    let code;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      code = Invite.generateCode();
      const exists = await Invite.findOne({ code });
      if (!exists) break;
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      logger.error('Failed to generate unique invite code after max attempts');
      return res.status(500).json({ error: 'Unable to generate invite. Please try again.' });
    }

    // Calculate expiry
    const expiresAt = config.platform.inviteExpiryMs
      ? new Date(Date.now() + config.platform.inviteExpiryMs)
      : null;

    // Create the invite
    const invite = await Invite.create({
      code,
      createdBy: user._id,
      expiresAt,
      note: req.body.note || ''
    });

    // Log invite creation
    await SecurityLog.create({
      type: 'invite_created',
      severity: 'info',
      userId: user._id,
      username: user.username,
      details: `Invite code created: ${code.substring(0, 10)}...`,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      action: 'created'
    });

    logger.info(`Invite created by ${user.username}: ${code.substring(0, 10)}...`);

    res.status(201).json({
      success: true,
      invite: {
        code: invite.code,
        expiresAt: invite.expiresAt,
        status: invite.status,
        createdAt: invite.createdAt,
        inviteUrl: `${config.frontendURL}/register?invite=${invite.code}`
      }
    });

  } catch (error) {
    logger.error('Invite creation error:', error);
    res.status(500).json({ error: 'Unable to create invite. Please try again.' });
  }
});

/**
 * @route   GET /api/invites/my-invites
 * @desc    Get current user's invites (admin/super_admin only)
 * @access  Private (Admin)
 */
router.get('/my-invites', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    if (!canCreateInvite(user)) {
      return res.status(403).json({ error: 'You do not have permission to view invites.' });
    }

    const invites = await Invite.find({ createdBy: user._id })
      .select('code status usedAt expiresAt createdAt note')
      .sort({ createdAt: -1 })
      .limit(20);

    // Check and update expired invites
    const now = new Date();
    for (const invite of invites) {
      if (invite.status === 'active' && invite.expiresAt && now > invite.expiresAt) {
        invite.status = 'expired';
        await invite.save();
      }
    }

    res.json({
      invites: invites.map(inv => ({
        code: inv.code,
        status: inv.status,
        usedAt: inv.usedAt,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        note: inv.note,
        inviteUrl: inv.status === 'active'
          ? `${config.frontendURL}/register?invite=${inv.code}`
          : null
      })),
      canCreateNew: await canCreateNewInvite(user)
    });

  } catch (error) {
    logger.error('Error fetching invites:', error);
    res.status(500).json({ error: 'Unable to fetch invites.' });
  }
});

/**
 * Helper: Check if user can create a new invite (considering cooldown and limits)
 */
async function canCreateNewInvite(user) {
  if (!canCreateInvite(user)) return { allowed: false, reason: 'not_eligible' };

  // Check active invites
  const activeInvites = await Invite.countDocuments({
    createdBy: user._id,
    status: 'active'
  });

  if (activeInvites >= config.platform.maxActiveInvitesPerUser) {
    return { allowed: false, reason: 'active_invite_exists' };
  }

  // Check cooldown
  const lastInvite = await Invite.findOne({ createdBy: user._id })
    .sort({ createdAt: -1 });

  if (lastInvite) {
    const cooldownEnd = new Date(lastInvite.createdAt.getTime() + config.platform.inviteCooldownMs);
    if (new Date() < cooldownEnd) {
      return { allowed: false, reason: 'cooldown', cooldownEndsAt: cooldownEnd };
    }
  }

  return { allowed: true };
}

/**
 * @route   DELETE /api/invites/:code
 * @desc    Revoke an unused invite (admin only, creator or super_admin)
 * @access  Private (Admin)
 */
router.delete('/:code', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { code } = req.params;

    const invite = await Invite.findOne({ code: code.toUpperCase() });

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found.' });
    }

    // Only creator or super_admin can revoke
    const isCreator = invite.createdBy.toString() === user._id.toString();
    const isSuperAdmin = user.role === 'super_admin';

    if (!isCreator && !isSuperAdmin) {
      return res.status(403).json({ error: 'You cannot revoke this invite.' });
    }

    // Cannot revoke already-used invites
    if (invite.status === 'used') {
      return res.status(400).json({ error: 'Cannot revoke an invite that has already been used.' });
    }

    invite.status = 'revoked';
    await invite.save();

    // Log revocation
    await SecurityLog.create({
      type: 'invite_revoked',
      severity: 'info',
      userId: user._id,
      username: user.username,
      details: `Invite revoked: ${code.substring(0, 10)}...`,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      action: 'revoked'
    });

    res.json({ success: true, message: 'Invite has been revoked.' });

  } catch (error) {
    logger.error('Invite revocation error:', error);
    res.status(500).json({ error: 'Unable to revoke invite.' });
  }
});

/**
 * @route   GET /api/invites/admin/stats
 * @desc    Get aggregate invite statistics (super_admin only)
 * @access  Private (Super Admin)
 */
router.get('/admin/stats', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const stats = await Invite.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalInvites = await Invite.countDocuments();
    const usedInvites = stats.find(s => s._id === 'used')?.count || 0;
    const activeInvites = stats.find(s => s._id === 'active')?.count || 0;

    res.json({
      total: totalInvites,
      used: usedInvites,
      active: activeInvites,
      expired: stats.find(s => s._id === 'expired')?.count || 0,
      revoked: stats.find(s => s._id === 'revoked')?.count || 0
    });

  } catch (error) {
    logger.error('Error fetching invite stats:', error);
    res.status(500).json({ error: 'Unable to fetch stats.' });
  }
});

export default router;

