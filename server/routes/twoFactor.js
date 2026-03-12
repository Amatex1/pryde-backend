import express from 'express';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { authenticateToken } from '../middleware/auth.js';
import { twoFactorLimiter } from '../middleware/rateLimiter.js';
import User from '../models/User.js';
import { encryptMessage, decryptMessage, isEncrypted } from '../utils/encryption.js';
import { logTwoFactorEnabled, logTwoFactorDisabled } from '../utils/securityLogger.js';

const router = express.Router();

/**
 * Helper to get the decrypted 2FA secret
 * Handles both encrypted and legacy unencrypted secrets
 */
function getDecrypted2FASecret(user) {
  if (!user.twoFactorSecret) return null;

  // Check if secret is encrypted (hex string of sufficient length)
  if (isEncrypted(user.twoFactorSecret)) {
    return decryptMessage(user.twoFactorSecret);
  }

  // Legacy: return as-is (base32 encoded TOTP secret)
  return user.twoFactorSecret;
}

// Generate 2FA secret and QR code
router.post('/setup', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA is already enabled' });
    }

    // Generate TOTP secret and URI
    const totp = new OTPAuth.TOTP({
      issuer: 'Pryde Social',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: new OTPAuth.Secret(),
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(totp.toString());

    // Generate backup codes (10 codes) using secure random bytes
    const backupCodes = [];
    for (let i = 0; i < 10; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      backupCodes.push({
        code: code,
        used: false
      });
    }

    // Save ENCRYPTED secret and backup codes (but don't enable 2FA yet)
    // SECURITY: 2FA secrets are encrypted at rest
    user.twoFactorSecret = encryptMessage(totp.secret.base32);
    user.twoFactorBackupCodes = backupCodes;
    await user.save();

    res.json({
      secret: totp.secret.base32,
      qrCode: qrCodeUrl,
      backupCodes: backupCodes.map(bc => bc.code),
      message: 'Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)'
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({ message: 'Server error during 2FA setup' });
  }
});

// Verify and enable 2FA
router.post('/verify', authenticateToken, async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Verification token is required' });
    }

    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.twoFactorSecret) {
      return res.status(400).json({ message: 'Please set up 2FA first' });
    }

    // Decrypt secret for verification
    const decryptedSecret = getDecrypted2FASecret(user);

    // Verify token
    const setupTotp = new OTPAuth.TOTP({
      algorithm: 'SHA1', digits: 6, period: 30,
      secret: OTPAuth.Secret.fromBase32(decryptedSecret),
    });
    const verified = setupTotp.validate({ token, window: 2 }) !== null;

    if (!verified) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    // Enable 2FA
    user.twoFactorEnabled = true;
    await user.save();

    logTwoFactorEnabled(user, req.ip, req.headers['user-agent']).catch(() => {});

    res.json({
      message: '2FA enabled successfully',
      backupCodes: user.twoFactorBackupCodes.map(bc => bc.code)
    });
  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({ message: 'Server error during 2FA verification' });
  }
});

// Verify 2FA token during login
router.post('/verify-login', twoFactorLimiter, async (req, res) => {
  try {
    const { userId, token } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ message: 'User ID and token are required' });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA is not enabled for this account' });
    }

    // Check if it's a backup code
    const backupCodeIndex = user.twoFactorBackupCodes.findIndex(
      bc => bc.code === token && !bc.used
    );

    if (backupCodeIndex !== -1) {
      // Mark backup code as used
      user.twoFactorBackupCodes[backupCodeIndex].used = true;
      await user.save();
      
      return res.json({
        verified: true,
        message: 'Backup code verified successfully',
        remainingBackupCodes: user.twoFactorBackupCodes.filter(bc => !bc.used).length
      });
    }

    // Decrypt secret for verification
    const decryptedSecret = getDecrypted2FASecret(user);

    // Verify TOTP token
    const loginTotp = new OTPAuth.TOTP({
      algorithm: 'SHA1', digits: 6, period: 30,
      secret: OTPAuth.Secret.fromBase32(decryptedSecret),
    });
    const verified = loginTotp.validate({ token, window: 2 }) !== null;

    if (!verified) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    res.json({
      verified: true,
      message: '2FA verification successful'
    });
  } catch (error) {
    console.error('2FA login verification error:', error);
    res.status(500).json({ message: 'Server error during 2FA verification' });
  }
});

// Disable 2FA
router.post('/disable', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Password is required to disable 2FA' });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA is not enabled' });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Disable 2FA
    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorBackupCodes = [];
    await user.save();

    logTwoFactorDisabled(user, req.ip, req.headers['user-agent']).catch(() => {});

    res.json({ message: '2FA disabled successfully' });
  } catch (error) {
    console.error('2FA disable error:', error);
    res.status(500).json({ message: 'Server error while disabling 2FA' });
  }
});

// Get 2FA status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      enabled: user.twoFactorEnabled,
      backupCodesRemaining: user.twoFactorBackupCodes.filter(bc => !bc.used).length
    });
  } catch (error) {
    console.error('2FA status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Regenerate backup codes
router.post('/regenerate-backup-codes', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: '2FA is not enabled' });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Generate new backup codes using secure random bytes
    const backupCodes = [];
    for (let i = 0; i < 10; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      backupCodes.push({
        code: code,
        used: false
      });
    }

    user.twoFactorBackupCodes = backupCodes;
    await user.save();

    res.json({
      message: 'Backup codes regenerated successfully',
      backupCodes: backupCodes.map(bc => bc.code)
    });
  } catch (error) {
    console.error('Backup codes regeneration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

