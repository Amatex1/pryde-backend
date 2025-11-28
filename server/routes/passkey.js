import express from 'express';
const router = express.Router();
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import auth from '../middleware/auth.js';
import config from '../config/config.js';
import {
  generatePasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  generatePasskeyAuthenticationOptions,
  verifyPasskeyAuthentication,
  getDeviceName
} from '../utils/passkeyUtils.js';

// Store challenges temporarily (in production, use Redis)
const challenges = new Map();

// @route   GET /api/passkey/test
// @desc    Test endpoint to verify passkey routes are working
// @access  Public
router.get('/test', (req, res) => {
  res.json({
    message: 'Passkey routes are working!',
    timestamp: new Date().toISOString(),
    availableRoutes: [
      'POST /api/passkey/register-start',
      'POST /api/passkey/register-finish',
      'POST /api/passkey/login-start',
      'POST /api/passkey/login-finish',
      'GET /api/passkey/list',
      'DELETE /api/passkey/:credentialId'
    ]
  });
});

// @route   POST /api/passkey/register-start
// @desc    Start passkey registration process
// @access  Private (user must be logged in)
router.post('/register-start', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate registration options
    const options = await generatePasskeyRegistrationOptions(user);

    // Store challenge for verification
    challenges.set(user._id.toString(), options.challenge);

    // Set challenge to expire in 5 minutes
    setTimeout(() => {
      challenges.delete(user._id.toString());
    }, 5 * 60 * 1000);

    res.json(options);
  } catch (error) {
    console.error('Passkey registration start error:', error);
    res.status(500).json({ message: 'Failed to start passkey registration' });
  }
});

// @route   POST /api/passkey/register-finish
// @desc    Complete passkey registration
// @access  Private
router.post('/register-finish', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { credential, deviceName } = req.body;

    // Get stored challenge
    const expectedChallenge = challenges.get(user._id.toString());
    if (!expectedChallenge) {
      return res.status(400).json({ message: 'Challenge expired or not found' });
    }

    // Verify registration response
    const verification = await verifyPasskeyRegistration(credential, expectedChallenge);

    if (!verification.verified) {
      return res.status(400).json({ message: 'Passkey verification failed' });
    }

    const { registrationInfo } = verification;

    // Save passkey to user account
    const newPasskey = {
      credentialId: Buffer.from(registrationInfo.credentialID).toString('base64'),
      publicKey: Buffer.from(registrationInfo.credentialPublicKey).toString('base64'),
      counter: registrationInfo.counter,
      deviceName: deviceName || getDeviceName(req.headers['user-agent']),
      transports: credential.response.transports || [],
      createdAt: new Date(),
      lastUsedAt: new Date()
    };

    user.passkeys.push(newPasskey);
    await user.save();

    // Clean up challenge
    challenges.delete(user._id.toString());

    res.json({
      success: true,
      message: 'Passkey registered successfully',
      passkey: {
        id: newPasskey.credentialId,
        deviceName: newPasskey.deviceName,
        createdAt: newPasskey.createdAt
      }
    });
  } catch (error) {
    console.error('Passkey registration finish error:', error);
    res.status(500).json({ message: 'Failed to complete passkey registration' });
  }
});

// @route   POST /api/passkey/login-start
// @desc    Start passkey login process
// @access  Public
router.post('/login-start', async (req, res) => {
  try {
    const { email } = req.body;

    let passkeys = [];
    
    // If email provided, get user's passkeys
    if (email) {
      const user = await User.findOne({ email });
      if (user && user.passkeys) {
        passkeys = user.passkeys;
      }
    }

    // Generate authentication options
    const options = await generatePasskeyAuthenticationOptions(passkeys);

    // Store challenge (use email or 'anonymous' as key)
    const challengeKey = email || `anonymous-${Date.now()}`;
    challenges.set(challengeKey, options.challenge);

    // Set challenge to expire in 5 minutes
    setTimeout(() => {
      challenges.delete(challengeKey);
    }, 5 * 60 * 1000);

    res.json({ ...options, challengeKey });
  } catch (error) {
    console.error('Passkey login start error:', error);
    res.status(500).json({ message: 'Failed to start passkey login' });
  }
});

// @route   POST /api/passkey/login-finish
// @desc    Complete passkey login
// @access  Public
router.post('/login-finish', async (req, res) => {
  try {
    const { credential, challengeKey } = req.body;

    // Get stored challenge
    const expectedChallenge = challenges.get(challengeKey);
    if (!expectedChallenge) {
      return res.status(400).json({ message: 'Challenge expired or not found' });
    }

    // Find user by credential ID
    const credentialId = Buffer.from(credential.rawId, 'base64').toString('base64');
    const user = await User.findOne({ 'passkeys.credentialId': credentialId });

    if (!user) {
      return res.status(404).json({ message: 'Passkey not found' });
    }

    // Check if account is suspended or banned
    if (user.isSuspended) {
      const suspendedUntil = user.suspendedUntil ? new Date(user.suspendedUntil) : null;
      if (suspendedUntil && suspendedUntil > new Date()) {
        return res.status(403).json({
          message: `Account suspended until ${suspendedUntil.toLocaleDateString()}`,
          reason: user.suspensionReason
        });
      }
    }

    if (user.isBanned) {
      return res.status(403).json({
        message: 'Account has been permanently banned',
        reason: user.bannedReason
      });
    }

    // Find the specific passkey
    const passkey = user.passkeys.find(pk => pk.credentialId === credentialId);
    if (!passkey) {
      return res.status(404).json({ message: 'Passkey not found' });
    }

    // Verify authentication response
    const verification = await verifyPasskeyAuthentication(credential, expectedChallenge, passkey);

    if (!verification.verified) {
      return res.status(400).json({ message: 'Passkey verification failed' });
    }

    // Update passkey counter and last used
    passkey.counter = verification.authenticationInfo.newCounter;
    passkey.lastUsedAt = new Date();

    // Update user last login
    user.lastLogin = new Date();
    user.lastSeen = new Date();

    await user.save();

    // Clean up challenge
    challenges.delete(challengeKey);

    // Create JWT token
    const token = jwt.sign(
      { userId: user._id },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        profilePhoto: user.profilePhoto,
        coverPhoto: user.coverPhoto
      }
    });
  } catch (error) {
    console.error('Passkey login finish error:', error);
    res.status(500).json({ message: 'Failed to complete passkey login' });
  }
});

// @route   GET /api/passkey/list
// @desc    Get user's passkeys
// @access  Private
router.get('/list', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const passkeys = user.passkeys.map(pk => ({
      id: pk.credentialId,
      deviceName: pk.deviceName,
      createdAt: pk.createdAt,
      lastUsedAt: pk.lastUsedAt
    }));

    res.json({ passkeys });
  } catch (error) {
    console.error('List passkeys error:', error);
    res.status(500).json({ message: 'Failed to list passkeys' });
  }
});

// @route   DELETE /api/passkey/:credentialId
// @desc    Delete a passkey
// @access  Private
router.delete('/:credentialId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { credentialId } = req.params;

    // Find passkey index
    const passkeyIndex = user.passkeys.findIndex(pk => pk.credentialId === credentialId);
    if (passkeyIndex === -1) {
      return res.status(404).json({ message: 'Passkey not found' });
    }

    // Remove passkey
    user.passkeys.splice(passkeyIndex, 1);
    await user.save();

    res.json({
      success: true,
      message: 'Passkey deleted successfully'
    });
  } catch (error) {
    console.error('Delete passkey error:', error);
    res.status(500).json({ message: 'Failed to delete passkey' });
  }
});

export default router;

