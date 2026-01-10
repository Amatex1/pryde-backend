import express from 'express';
const router = express.Router();
import User from '../models/User.js';
import AdminEscalationToken from '../models/AdminEscalationToken.js';
import AdminActionLog from '../models/AdminActionLog.js';
import auth from '../middleware/auth.js';
import adminAuth from '../middleware/adminAuth.js';
import { getClientIp } from '../utils/sessionUtils.js';
import logger from '../utils/logger.js';
import speakeasy from 'speakeasy';
import { decryptString, isEncrypted } from '../utils/encryption.js';
import {
  generatePasskeyAuthenticationOptions,
  verifyPasskeyAuthentication
} from '../utils/passkeyUtils.js';

// All routes require authentication + admin role
router.use(auth);
router.use(adminAuth);

// Store challenges for passkey authentication
const challenges = new Map();

/**
 * Helper to decrypt 2FA secret
 */
const getDecrypted2FASecret = (user) => {
  if (!user.twoFactorSecret) {
    return null;
  }
  
  if (isEncrypted(user.twoFactorSecret)) {
    return decryptString(user.twoFactorSecret);
  }
  
  return user.twoFactorSecret;
};

// @route   POST /api/admin/escalate/start
// @desc    Start admin escalation - returns available methods
// @access  Admin
router.post('/start', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user is admin or super_admin
    if (!['admin', 'super_admin'].includes(user.role)) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    // Determine available methods
    const hasPasskeys = user.passkeys && user.passkeys.length > 0;
    const hasTOTP = user.twoFactorEnabled === true;
    
    const availableMethods = [];
    
    if (hasPasskeys) {
      availableMethods.push('passkey');
    }
    
    if (hasTOTP) {
      availableMethods.push('totp');
    }
    
    // PHASE G: If user has passkeys or TOTP, do NOT allow password-only escalation
    // Only allow password reauth if user has neither (with strong warning)
    if (!hasPasskeys && !hasTOTP) {
      availableMethods.push('password');
    }
    
    res.json({
      success: true,
      availableMethods,
      hasPasskeys,
      hasTOTP,
      requiresSetup: availableMethods.length === 0 || availableMethods.includes('password'),
      warning: availableMethods.includes('password') 
        ? 'Password-only escalation is insecure. Please set up passkey or TOTP for better security.'
        : null
    });
  } catch (error) {
    logger.error('Admin escalation start error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/escalate/finish/passkey/start
// @desc    Start passkey authentication for escalation
// @access  Admin
router.post('/finish/passkey/start', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (!user.passkeys || user.passkeys.length === 0) {
      return res.status(400).json({ message: 'No passkeys registered' });
    }
    
    // Generate authentication options
    const options = await generatePasskeyAuthenticationOptions(user.passkeys);
    
    // Store challenge
    const challengeKey = `${user._id}_${Date.now()}`;
    challenges.set(challengeKey, {
      challenge: options.challenge,
      userId: user._id.toString(),
      createdAt: Date.now()
    });
    
    // Clean up old challenges (older than 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    for (const [key, value] of challenges.entries()) {
      if (value.createdAt < fiveMinutesAgo) {
        challenges.delete(key);
      }
    }
    
    res.json({
      success: true,
      options,
      challengeKey
    });
  } catch (error) {
    logger.error('Passkey escalation start error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/escalate/finish/passkey
// @desc    Complete passkey authentication for escalation
// @access  Admin
router.post('/finish/passkey', async (req, res) => {
  try {
    const { credential, challengeKey } = req.body;

    if (!credential || !challengeKey) {
      return res.status(400).json({ message: 'Credential and challenge key are required' });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get challenge
    const challengeData = challenges.get(challengeKey);
    if (!challengeData) {
      return res.status(400).json({ message: 'Invalid or expired challenge' });
    }

    // Verify user matches
    if (challengeData.userId !== user._id.toString()) {
      return res.status(403).json({ message: 'Challenge does not match user' });
    }

    // Find the passkey
    const passkey = user.passkeys.find(p => p.credentialId === credential.id);
    if (!passkey) {
      return res.status(400).json({ message: 'Passkey not found' });
    }

    // Verify passkey authentication
    const verification = await verifyPasskeyAuthentication(
      credential,
      challengeData.challenge,
      passkey
    );

    if (!verification.verified) {
      return res.status(400).json({ message: 'Passkey verification failed' });
    }

    // Update passkey counter and last used
    const passkeyIndex = user.passkeys.findIndex(p => p.credentialId === credential.id);
    user.passkeys[passkeyIndex].counter = verification.authenticationInfo.newCounter;
    user.passkeys[passkeyIndex].lastUsedAt = new Date();
    await user.save();

    // Clean up challenge
    challenges.delete(challengeKey);

    // Create escalation token
    const escalationToken = await AdminEscalationToken.createToken({
      userId: user._id,
      sessionId: req.sessionId,
      method: 'passkey',
      deviceId: passkey.deviceName,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      ttlMinutes: 15
    });

    // Log the escalation
    await AdminActionLog.logAction({
      actorId: user._id,
      action: 'ADMIN_ESCALATION_GRANTED',
      targetType: 'ADMIN',
      targetId: user._id,
      details: {
        method: 'passkey',
        deviceName: passkey.deviceName,
        ttlMinutes: 15
      },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent']
    });

    logger.info(`Admin ${user.username} escalated privileges using passkey`);

    // Set escalation token in httpOnly cookie
    res.cookie('pryde_admin_escalated', escalationToken.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/'
    });

    res.json({
      success: true,
      message: 'Admin privileges escalated successfully',
      expiresAt: escalationToken.expiresAt,
      method: 'passkey'
    });
  } catch (error) {
    logger.error('Passkey escalation finish error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/escalate/finish/totp
// @desc    Complete TOTP authentication for escalation
// @access  Admin
router.post('/finish/totp', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'TOTP token is required' });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA is not enabled' });
    }

    // Decrypt secret for verification
    const decryptedSecret = getDecrypted2FASecret(user);

    if (!decryptedSecret) {
      return res.status(500).json({ message: '2FA secret not found' });
    }

    // Verify TOTP token
    const verified = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token: token,
      window: 2
    });

    if (!verified) {
      return res.status(400).json({ message: 'Invalid TOTP code' });
    }

    // Create escalation token
    const escalationToken = await AdminEscalationToken.createToken({
      userId: user._id,
      sessionId: req.sessionId,
      method: 'totp',
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      ttlMinutes: 15
    });

    // Log the escalation
    await AdminActionLog.logAction({
      actorId: user._id,
      action: 'ADMIN_ESCALATION_GRANTED',
      targetType: 'ADMIN',
      targetId: user._id,
      details: {
        method: 'totp',
        ttlMinutes: 15
      },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent']
    });

    logger.info(`Admin ${user.username} escalated privileges using TOTP`);

    // Set escalation token in httpOnly cookie
    res.cookie('pryde_admin_escalated', escalationToken.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/'
    });

    res.json({
      success: true,
      message: 'Admin privileges escalated successfully',
      expiresAt: escalationToken.expiresAt,
      method: 'totp'
    });
  } catch (error) {
    logger.error('TOTP escalation finish error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/escalate/revoke
// @desc    Revoke admin escalation (lock now)
// @access  Admin
router.post('/revoke', async (req, res) => {
  try {
    const token = req.cookies?.pryde_admin_escalated;

    if (!token) {
      return res.json({
        success: true,
        message: 'No active escalation to revoke'
      });
    }

    // Find and revoke the token
    const escalationToken = await AdminEscalationToken.findOne({ token });

    if (escalationToken) {
      escalationToken.revoked = true;
      escalationToken.revokedAt = new Date();
      escalationToken.revokedReason = 'Manual revocation by user';
      await escalationToken.save();

      // Log the revocation
      await AdminActionLog.logAction({
        actorId: req.user.id,
        action: 'ADMIN_ESCALATION_REVOKED',
        targetType: 'ADMIN',
        targetId: req.user.id,
        details: {
          method: escalationToken.method,
          reason: 'Manual revocation'
        },
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent']
      });
    }

    // Clear cookie
    res.clearCookie('pryde_admin_escalated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/'
    });

    logger.info(`Admin ${req.user.username} revoked escalation`);

    res.json({
      success: true,
      message: 'Admin escalation revoked successfully'
    });
  } catch (error) {
    logger.error('Escalation revoke error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/escalate/status
// @desc    Check current escalation status
// @access  Admin
router.get('/status', async (req, res) => {
  try {
    const token = req.cookies?.pryde_admin_escalated;

    if (!token) {
      return res.json({
        escalated: false,
        expiresAt: null,
        method: null
      });
    }

    // Verify token
    const escalationToken = await AdminEscalationToken.verifyToken(
      token,
      req.user.id,
      req.sessionId
    );

    if (!escalationToken) {
      // Token invalid or expired - clear cookie
      res.clearCookie('pryde_admin_escalated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/'
      });

      return res.json({
        escalated: false,
        expiresAt: null,
        method: null
      });
    }

    res.json({
      escalated: true,
      expiresAt: escalationToken.expiresAt,
      method: escalationToken.method,
      remainingMinutes: Math.ceil((escalationToken.expiresAt - new Date()) / (60 * 1000))
    });
  } catch (error) {
    logger.error('Escalation status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

