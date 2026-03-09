import express from 'express';
const router = express.Router();
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import Session from '../models/Session.js'; // Phase 3B-A: First-class sessions
import auth from '../middleware/auth.js';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import {
  generatePasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  generatePasskeyAuthenticationOptions,
  verifyPasskeyAuthentication,
  getDeviceName
} from '../utils/passkeyUtils.js';
import {
  parseUserAgent,
  getClientIp,
  cleanupOldSessions,
  findOrCreateSession,
  getIpGeolocation,
  enforceMaxSessions
} from '../utils/sessionUtils.js';
import { generateTokenPair, getRefreshTokenExpiry } from '../utils/tokenUtils.js';
import { getRefreshTokenCookieOptions } from '../utils/cookieUtils.js';
import { passkeyLimiter } from '../middleware/rateLimiter.js';

// Fallback in-memory challenge store (used when Redis is unavailable)
const challenges = new Map();

// Store a challenge — Redis when available, Map as fallback
async function storeChallenge(redis, key, challenge) {
  if (redis) {
    await redis.set(`passkey:challenge:${key}`, challenge, 'EX', 300);
  } else {
    challenges.set(key, challenge);
    setTimeout(() => challenges.delete(key), 5 * 60 * 1000);
  }
}

// Retrieve a challenge
async function getChallenge(redis, key) {
  if (redis) {
    return await redis.get(`passkey:challenge:${key}`);
  }
  return challenges.get(key) ?? null;
}

// Delete a challenge after use
async function deleteChallenge(redis, key) {
  if (redis) {
    await redis.del(`passkey:challenge:${key}`);
  } else {
    challenges.delete(key);
  }
}

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

    console.log('🔐 Starting passkey registration for user:', user.username);
    console.log('   User ID:', user._id.toString());
    console.log('   Email:', user.email);
    console.log('   Existing passkeys:', user.passkeys?.length || 0);

    // Generate registration options
    const options = await generatePasskeyRegistrationOptions(user);

    console.log('✅ Registration options generated successfully');

    // Store challenge for verification (Redis when available, Map as fallback)
    const redis = req.app.get('redis');
    await storeChallenge(redis, user._id.toString(), options.challenge);

    res.json(options);
  } catch (error) {
    console.error('❌ Passkey registration start error:', error);
    console.error('   Error name:', error.name);
    console.error('   Error message:', error.message);
    console.error('   Error stack:', error.stack);
    res.status(500).json({
      message: 'Failed to start passkey registration',
      error: config.nodeEnv === 'development' ? error.message : undefined
    });
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

    console.log('🔐 Finishing passkey registration for user:', user.username);
    const { credential, deviceName } = req.body;
    console.log('   Device name:', deviceName);
    console.log('   Credential type:', typeof credential);

    // Get stored challenge
    const redis = req.app.get('redis');
    const expectedChallenge = await getChallenge(redis, user._id.toString());
    if (!expectedChallenge) {
      console.error('❌ Challenge not found or expired');
      return res.status(400).json({ message: 'Challenge expired or not found' });
    }

    console.log('✅ Challenge found, verifying registration...');

    // Verify registration response
    const verification = await verifyPasskeyRegistration(credential, expectedChallenge);

    console.log('   Verification result:', verification.verified);

    if (!verification.verified) {
      console.error('❌ Passkey verification failed');
      return res.status(400).json({ message: 'Passkey verification failed' });
    }

    const { registrationInfo } = verification;
    const { credential: registeredCredential, credentialDeviceType, credentialBackedUp } = registrationInfo;

    console.log('✅ Verification successful, saving passkey...');
    console.log('   Credential ID:', registeredCredential.id);
    console.log('   Device type:', credentialDeviceType);
    console.log('   Backed up:', credentialBackedUp);

    // Save passkey to user account
    // Note: @simplewebauthn v13+ structure
    const newPasskey = {
      credentialId: registeredCredential.id,
      publicKey: Buffer.from(registeredCredential.publicKey).toString('base64'),
      counter: registeredCredential.counter,
      deviceName: deviceName || getDeviceName(req.headers['user-agent']),
      transports: registeredCredential.transports || [],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      createdAt: new Date(),
      lastUsedAt: new Date()
    };

    console.log('   New passkey object:', {
      credentialId: newPasskey.credentialId,
      credentialIdType: typeof newPasskey.credentialId,
      deviceName: newPasskey.deviceName
    });

    user.passkeys.push(newPasskey);
    await user.save();

    console.log('✅ Passkey saved successfully');

    // Clean up challenge
    const redisForCleanup = req.app.get('redis');
    await deleteChallenge(redisForCleanup, user._id.toString());

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
    console.error('❌ Passkey registration finish error:', error);
    console.error('   Error name:', error.name);
    console.error('   Error message:', error.message);
    console.error('   Error stack:', error.stack);
    res.status(500).json({
      message: 'Failed to complete passkey registration',
      error: config.nodeEnv === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/passkey/login-start
// @desc    Start passkey login process
// @access  Public
router.post('/login-start', passkeyLimiter, async (req, res) => {
  try {
    console.log('🔐 Starting passkey login...');
    const { email } = req.body;
    console.log('   Email:', email || 'none (discoverable credential)');

    let passkeys = [];

    // If email provided, look up that user's passkeys specifically.
    // IMPORTANT: if the user has NO passkeys we must return early.
    // Falling through with an empty allowCredentials list triggers a
    // "discoverable credential" flow — the browser then offers every
    // passkey stored on the device for this RP ID, including ones
    // belonging to completely different accounts.
    if (email) {
      const user = await User.findOne({ email });
      if (!user) {
        console.log('   No user found for email');
        return res.status(200).json({ hasPasskeys: false });
      }
      if (!user.passkeys || user.passkeys.length === 0) {
        console.log('   User has no passkeys registered');
        return res.status(200).json({ hasPasskeys: false });
      }
      passkeys = user.passkeys;
      console.log('   Found', passkeys.length, 'passkey(s) for user');
    } else {
      // No email — refuse to start a discoverable-credential flow that
      // would expose all passkeys on the device across accounts.
      console.log('   No email provided, refusing discoverable credential flow');
      return res.status(400).json({
        message: 'Please enter your email before using a passkey.',
        code: 'EMAIL_REQUIRED'
      });
    }

    // Generate authentication options
    console.log('🔐 Generating authentication options...');
    let options;
    try {
      options = await generatePasskeyAuthenticationOptions(passkeys);
      console.log('✅ Authentication options generated');
    } catch (optionsError) {
      console.error('❌ Failed to generate authentication options:', optionsError);
      return res.status(500).json({
        message: 'Failed to generate authentication options',
        code: 'OPTIONS_GENERATION_FAILED',
        details: optionsError.message
      });
    }

    // Store challenge (use email or 'anonymous' as key)
    const challengeKey = email || `anonymous-${Date.now()}`;
    const redis = req.app.get('redis');
    await storeChallenge(redis, challengeKey, options.challenge);
    console.log('✅ Challenge stored with key:', challengeKey);

    res.json({ ...options, challengeKey });
  } catch (error) {
    console.error('❌ Passkey login start error:', error);
    console.error('   Error name:', error.name);
    console.error('   Error message:', error.message);
    console.error('   Error stack:', error.stack);

    // Return detailed error in development, generic in production
    const isDevelopment = process.env.NODE_ENV !== 'production';

    res.status(500).json({
      message: 'Failed to start passkey login. Please try again.',
      code: 'INTERNAL_ERROR',
      ...(isDevelopment && {
        details: error.message,
        errorType: error.name
      })
    });
  }
});

// @route   POST /api/passkey/login-finish
// @desc    Complete passkey login
// @access  Public
router.post('/login-finish', passkeyLimiter, async (req, res) => {
  try {
    console.log('🔐 Starting passkey login finish...');
    const { credential, challengeKey } = req.body;

    // Validate request body
    if (!credential || !challengeKey) {
      console.error('❌ Missing required fields');
      return res.status(400).json({
        message: 'Missing required fields',
        details: {
          credential: !credential ? 'missing' : 'present',
          challengeKey: !challengeKey ? 'missing' : 'present'
        }
      });
    }

    console.log('   Challenge key:', challengeKey);
    console.log('   Credential ID:', credential?.id);

    // Get stored challenge
    const redis = req.app.get('redis');
    const expectedChallenge = await getChallenge(redis, challengeKey);
    if (!expectedChallenge) {
      console.error('❌ Challenge not found or expired');
      return res.status(400).json({
        message: 'Challenge expired or not found. Please try logging in again.',
        code: 'CHALLENGE_EXPIRED'
      });
    }
    console.log('✅ Challenge found');

    // Validate credential ID
    if (!credential.id) {
      console.error('❌ Credential ID missing');
      return res.status(400).json({
        message: 'Invalid credential data',
        code: 'INVALID_CREDENTIAL'
      });
    }

    // Find user by credential ID
    console.log('🔍 Looking for user with credential ID:', credential.id);
    const user = await User.findOne({ 'passkeys.credentialId': credential.id });

    if (!user) {
      console.error('❌ User not found for credential ID:', credential.id);
      // Clean up challenge
      await deleteChallenge(redis, challengeKey);
      return res.status(404).json({
        message: 'Passkey not found. It may have been removed.',
        code: 'PASSKEY_NOT_FOUND'
      });
    }
    console.log('✅ User found:', user.username);

    // Check if account is suspended or banned
    if (user.isSuspended) {
      const suspendedUntil = user.suspendedUntil ? new Date(user.suspendedUntil) : null;
      if (suspendedUntil && suspendedUntil > new Date()) {
        // Clean up challenge
        await deleteChallenge(redis, challengeKey);
        return res.status(403).json({
          message: `Account suspended until ${suspendedUntil.toLocaleDateString()}`,
          reason: user.suspensionReason,
          code: 'ACCOUNT_SUSPENDED'
        });
      }
    }

    if (user.isBanned) {
      // Clean up challenge
      await deleteChallenge(redis, challengeKey);
      return res.status(403).json({
        message: 'Account has been permanently banned',
        reason: user.bannedReason,
        code: 'ACCOUNT_BANNED'
      });
    }

    // Find the specific passkey
    const passkey = user.passkeys.find(pk => pk.credentialId === credential.id);
    if (!passkey) {
      console.error('❌ Passkey not found in user passkeys');
      // Clean up challenge
      await deleteChallenge(redis, challengeKey);
      return res.status(404).json({
        message: 'Passkey not found in user account',
        code: 'PASSKEY_MISMATCH'
      });
    }
    console.log('✅ Passkey found:', passkey.deviceName);

    // Verify authentication response
    console.log('🔐 Verifying authentication...');
    let verification;
    try {
      verification = await verifyPasskeyAuthentication(credential, expectedChallenge, passkey);
    } catch (verifyError) {
      console.error('❌ Verification error:', verifyError);
      // Clean up challenge
      await deleteChallenge(redis, challengeKey);
      return res.status(400).json({
        message: 'Passkey verification failed. Please try again.',
        code: 'VERIFICATION_ERROR',
        details: verifyError.message
      });
    }

    if (!verification.verified) {
      console.error('❌ Verification failed');
      // Clean up challenge
      await deleteChallenge(redis, challengeKey);
      return res.status(400).json({
        message: 'Passkey verification failed. The signature did not match.',
        code: 'VERIFICATION_FAILED'
      });
    }

    // Update passkey counter and last used
    passkey.counter = verification.authenticationInfo.newCounter;
    passkey.lastUsedAt = new Date();

    // Auto-reactivate deactivated accounts on successful passkey login
    if (!user.isActive) {
      user.isActive = true;
      user.deactivatedAt = null;

      logger.info(`✅ Account auto-reactivated for user: ${user.username} (${user.email}) via passkey login`);

      // Emit real-time event for admin panel
      const io = req.app?.get('io');
      if (io) {
        io.emit('user_reactivated', {
          userId: user._id,
          username: user.username,
          automatic: true,
          method: 'passkey',
          timestamp: new Date()
        });
      }
    }

    // Update user last login
    user.lastLogin = new Date();
    user.lastSeen = new Date();

    // Get device and IP info
    const ipAddress = getClientIp(req);
    const { browser, os, deviceInfo } = parseUserAgent(req.headers['user-agent']);

    // Get IP geolocation (async, but don't block login if it fails)
    const location = await getIpGeolocation(ipAddress);

    // Clean up old sessions first
    cleanupOldSessions(user);

    // Generate token pair with new session
    const { accessToken, refreshToken, sessionId } = generateTokenPair(user._id);

    // 🔐 Hash refresh token for secure storage (aligned with auth.js)
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Create session with refresh token hash (no plaintext storage)
    const sessionData = {
      sessionId,
      refreshToken: null,    // 🔐 Don't store plaintext
      refreshTokenHash,      // 🔐 Store hash for secure verification
      refreshTokenExpiry: getRefreshTokenExpiry(),
      deviceInfo,
      browser,
      os,
      ipAddress,
      location,
      createdAt: new Date(),
      lastActive: new Date()
    };

    // Phase 3B-A: Dual-write - create first-class session (authoritative)
    try {
      await Session.create({
        userId: user._id,
        sessionId,
        refreshTokenHash,
        refreshTokenExpiry: sessionData.refreshTokenExpiry,
        deviceInfo,
        browser,
        os,
        ipAddress,
        location,
        createdAt: sessionData.createdAt,
        lastActiveAt: sessionData.lastActive, // 🔧 FIX: Use correct field name (was 'lastActive')
        isActive: true // 🔧 FIX: Explicitly set (aligns with auth.js)
      });
      logger.debug(`[Phase 3B-A] Created first-class session ${sessionId} for user ${user.username} (passkey)`);
    } catch (sessionError) {
      logger.error('Failed to create Session document (passkey):', sessionError.message);
      // Continue with legacy storage - don't fail the login
    }

    // Add to legacy activeSessions array (backward compatibility)
    user.activeSessions.push(sessionData);

    // Enforce max concurrent sessions (removes oldest if limit exceeded)
    enforceMaxSessions(user);

    await user.save();

    // Clean up challenge
    challenges.delete(challengeKey);

    // Set refresh token in httpOnly cookie (ONLY source of truth for refresh tokens)
    const cookieOptions = getRefreshTokenCookieOptions(req);

    logger.debug('Setting refresh token cookie (passkey) with options:', cookieOptions);
    res.cookie('refreshToken', refreshToken, cookieOptions);

    res.json({
      success: true,
      message: 'Login successful',
      accessToken,
      // 🔐 SECURITY: refreshToken no longer returned in body - cookie is sole source
      user: {
        id: user._id,
        _id: user._id,  // Include both for backward compatibility
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        profilePhoto: user.profilePhoto,
        coverPhoto: user.coverPhoto,
        role: user.role,
        permissions: user.permissions
      }
    });
  } catch (error) {
    console.error('❌ Passkey login finish error:', error);
    console.error('   Error name:', error.name);
    console.error('   Error message:', error.message);
    console.error('   Error stack:', error.stack);

    // Return detailed error in development, generic in production
    const isDevelopment = process.env.NODE_ENV !== 'production';

    res.status(500).json({
      message: 'Failed to complete passkey login. Please try again.',
      code: 'INTERNAL_ERROR',
      ...(isDevelopment && {
        details: error.message,
        errorType: error.name
      })
    });
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

