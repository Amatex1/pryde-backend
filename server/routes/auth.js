import express from 'express';
const router = express.Router();
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import Badge from '../models/Badge.js';
import SecurityLog from '../models/SecurityLog.js';
import AdminEscalationToken from '../models/AdminEscalationToken.js'; // PHASE G: Auto-revoke escalation on security events
import Invite from '../models/Invite.js'; // Phase 7B: Invite-only growth
import Session from '../models/Session.js'; // Phase 3B-A: First-class sessions
import auth from '../middleware/auth.js';
import { getSessionInfo, clearSessionActivity, SESSION_TIMEOUT_MS } from '../middleware/sessionTimeout.js';
import config from '../config/config.js';
import { sendPasswordResetEmail, sendLoginAlertEmail, sendSuspiciousLoginEmail, sendVerificationEmail, sendPasswordChangedEmail } from '../utils/emailService.js';
import {
  generateSessionId,
  parseUserAgent,
  getClientIp,
  isNewDevice,
  isSuspiciousLogin,
  cleanupOldSessions,
  limitLoginHistory,
  findOrCreateSession,
  getIpGeolocation,
  enforceMaxSessions
} from '../utils/sessionUtils.js';
import { logEmailVerification, logPasswordChange } from '../utils/securityLogger.js';
import { loginLimiter, signupLimiter, passwordResetLimiter } from '../middleware/rateLimiter.js';
import { validateSignup, validateLogin } from '../middleware/validation.js';
import logger from '../utils/logger.js';
import { incCounter } from '../utils/authMetrics.js'; // Phase 4A
import { generateTokenPair, getRefreshTokenExpiry } from '../utils/tokenUtils.js';
import { getRefreshTokenCookieOptions } from '../utils/cookieUtils.js';
import { decryptObject, isEncrypted } from '../utils/encryption.js';
// 🔧 BADGE CHURN FIX: Badge processing removed from login (now event-driven + daily sweep)

/**
 * Helper to get the decrypted 2FA secret
 * Handles both encrypted and legacy unencrypted secrets
 */
function getDecrypted2FASecret(user) {
  if (!user.twoFactorSecret) return null;

  // Check if secret is encrypted (hex string of sufficient length)
  if (isEncrypted(user.twoFactorSecret)) {
    return decryptString(user.twoFactorSecret);
  }

  // Legacy: return as-is (base32 encoded TOTP secret)
  return user.twoFactorSecret;
}

// @route   GET /api/auth/status
// @desc    Check authentication status (lightweight endpoint for CSRF initialization)
// @access  Public (returns auth status without requiring token)
router.get('/status', async (req, res) => {
  try {
    // Try to get token from cookies or header
    let token = req.cookies?.token || req.cookies?.accessToken;
    if (!token) {
      token = req.header('Authorization')?.replace('Bearer ', '');
    }

    // If no token, user is not authenticated
    if (!token) {
      return res.json({
        authenticated: false,
        user: null
      });
    }

    // Verify token
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      const user = await User.findById(decoded.userId).select('_id username displayName profilePhoto privacySettings.safeModeEnabled');

      if (!user) {
        return res.json({
          authenticated: false,
          user: null,
          safeModeEnabled: false
        });
      }

      return res.json({
        authenticated: true,
        user: {
          id: user._id,
          _id: user._id,  // Include both for backward compatibility
          username: user.username,
          displayName: user.displayName,
          profilePhoto: user.profilePhoto
        },
        safeModeEnabled: user.privacySettings?.safeModeEnabled || false
      });
    } catch (tokenError) {
      // Token invalid or expired
      return res.json({
        authenticated: false,
        user: null,
        safeModeEnabled: false
      });
    }
  } catch (error) {
    logger.error('Auth status check error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/check-username/:username
// @desc    Check if username is available
// @access  Public
router.get('/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // Basic validation
    if (!username || username.length < 3 || username.length > 30) {
      return res.json({
        available: false,
        message: 'Username must be between 3 and 30 characters'
      });
    }

    // Check if username contains only valid characters
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.json({
        available: false,
        message: 'Username can only contain letters, numbers, and underscores'
      });
    }

    // Check if username exists
    const existingUser = await User.findOne({ username: username.toLowerCase() });

    if (existingUser) {
      return res.json({
        available: false,
        message: 'Username is already taken'
      });
    }

    res.json({
      available: true,
      message: 'Username is available!'
    });
  } catch (error) {
    logger.error('Check username error:', error);
    res.status(500).json({
      available: false,
      message: 'Error checking username availability'
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AGE VALIDATION MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════
// CRITICAL: This middleware MUST run BEFORE the rate limiter.
// Reason: Age validation is a core business rule (403 Forbidden).
//         Rate limiting is a security mechanism (429 Too Many Requests).
//         Users must always see 403 for age violations, never 429.
// ═══════════════════════════════════════════════════════════════════════════
const validateAgeBeforeRateLimit = async (req, res, next) => {
  try {
    const { birthday } = req.body;

    // If no birthday provided, let the main handler deal with required field validation
    if (!birthday) {
      return next();
    }

    // Parse and validate birthday
    const birthDate = new Date(birthday);

    // Check for invalid date
    if (isNaN(birthDate.getTime())) {
      return next(); // Let the main handler deal with invalid date format
    }

    // Calculate age
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    // CRITICAL: Return 403 Forbidden for underage users BEFORE rate limiting
    if (age < 18) {
      // Log underage registration attempt
      try {
        await SecurityLog.create({
          type: 'underage_registration',
          severity: 'high',
          username: req.body.username || 'unknown',
          email: req.body.email || 'unknown',
          birthday: birthDate,
          calculatedAge: age,
          ipAddress: getClientIp(req),
          userAgent: req.headers['user-agent'],
          details: `Underage registration attempt blocked (pre-rate-limit). Age: ${age} years old.`,
          action: 'blocked'
        });
      } catch (logError) {
        logger.error('Failed to log underage registration attempt:', logError);
      }

      return res.status(403).json({
        error: 'Forbidden',
        message: 'You must be at least 18 years old to sign up.'
      });
    }

    // Age is valid, proceed to rate limiter and other middleware
    next();
  } catch (error) {
    // On error, proceed to next middleware (let main handler deal with it)
    logger.error('Age validation middleware error:', error);
    next();
  }
};

// @route   POST /api/auth/signup
// @desc    Register new user
// @access  Public
// MIDDLEWARE ORDER: 1. Age validation → 2. Rate limiter → 3. Input validation → 4. Handler
router.post('/signup', validateAgeBeforeRateLimit, signupLimiter, validateSignup, async (req, res) => {
  try {
    const {
      // Required fields
      fullName,
      username,
      email,
      password,
      birthday,
      termsAccepted,
      captchaToken,
      inviteCode, // Phase 7B: Required when invite-only mode is enabled
      // Optional fields
      displayName,
      identity, // 'LGBTQ+' or 'Ally'
      pronouns,
      bio,
      // Legacy fields (for backward compatibility)
      nickname,
      customPronouns,
      gender,
      customGender
      // REMOVED 2025-12-26: relationshipStatus, isAlly (Phase 5)
    } = req.body;

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 7B: INVITE CODE HANDLING
    // - If inviteOnlyMode is true: invite code is REQUIRED
    // - If inviteOnlyMode is false: invite code is OPTIONAL (for referral tracking)
    // ═══════════════════════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════════════════════
    // VALIDATION ORDER: Per business rules, age check MUST run before CAPTCHA
    // 1. Required fields → 2. Age validation → 3. CAPTCHA → 4. Other validations
    // ═══════════════════════════════════════════════════════════════════════════

    // STEP 1: Validation - Required fields only
    if (!fullName || !username || !email || !password || !birthday) {
      return res.status(400).json({
        message: 'Please provide all required fields: full name, username, email, password, and birthday',
        fields: { fullName, username, email, password, birthday }
      });
    }

    // Validate fullName minimum length
    if (fullName.trim().length < 2) {
      return res.status(400).json({
        message: 'Full name must be at least 2 characters'
      });
    }

    // STEP 2: Validate birthday and calculate age BEFORE any other checks
    // This is a core business invariant - age restriction must never be masked by external checks
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    // Auto-ban users under 18 IMMEDIATELY (before CAPTCHA or any other checks)
    if (age < 18) {
      // Log underage registration attempt
      try {
        await SecurityLog.create({
          type: 'underage_registration',
          severity: 'high',
          username,
          email,
          birthday: birthDate,
          calculatedAge: age,
          ipAddress: getClientIp(req),
          userAgent: req.headers['user-agent'],
          details: `Underage registration attempt blocked. Age: ${age} years old.`,
          action: 'blocked'
        });
      } catch (logError) {
        logger.error('Failed to log underage registration attempt:', logError);
      }

      return res.status(403).json({
        message: 'You must be 18 years or older to register. This platform is strictly 18+ only.',
        reason: 'underage'
      });
    }

    // STEP 3: Verify hCaptcha token (only in production)
    // CAPTCHA is an external protection that should NEVER mask core business logic (age check)
    if (process.env.NODE_ENV === 'production') {
      // Dev-mode safety assertion: warn if this code path is reached before age validation
      // (This should never happen with correct validation order)
      if (process.env.NODE_ENV !== 'production' && !age) {
        logger.warn('⚠️ Validation order violation: CAPTCHA ran before age check');
      }

      if (process.env.HCAPTCHA_SECRET && captchaToken) {
        try {
          const verifyUrl = 'https://hcaptcha.com/siteverify';
          const verifyResponse = await fetch(verifyUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `secret=${process.env.HCAPTCHA_SECRET}&response=${captchaToken}`
          });

          const verifyData = await verifyResponse.json();

          if (!verifyData.success) {
            return res.status(400).json({
              message: 'CAPTCHA verification failed. Please try again.',
              reason: 'captcha_failed'
            });
          }
        } catch (captchaError) {
          logger.error('CAPTCHA verification error:', captchaError);
          return res.status(400).json({
            message: 'CAPTCHA verification failed. Please try again.',
            error: 'captcha_error'
          });
        }
      } else if (!captchaToken) {
        // In production, CAPTCHA is required
        return res.status(400).json({
          message: 'CAPTCHA verification is required.',
          reason: 'captcha_required'
        });
      }
    } else {
      // In development/test mode, log if CAPTCHA would have been verified
      if (captchaToken) {
        logger.debug('CAPTCHA token provided in non-production mode, skipping verification');
      }
    }

    // STEP 4: Validate invite code BEFORE user creation
    // This prevents creating users with invalid invites
    let validatedInvite = null;

    // Check if invite-only mode is enabled
    if (config.platform.inviteOnlyMode) {
      // MANDATORY: Require invite code in invite-only mode
      if (!inviteCode) {
        return res.status(403).json({
          error: 'invite_required',
          message: 'Pryde is currently invite-only. You need an invite code to register.'
        });
      }
    }

    // Validate invite code if provided (works in both modes)
    if (inviteCode) {
      const normalizedCode = inviteCode.toUpperCase().trim();
      const invite = await Invite.findOne({ code: normalizedCode });

      if (!invite) {
        // Invalid invite code - log and block
        await SecurityLog.create({
          type: 'invite_registration_failed',
          severity: 'medium',
          details: `Registration attempted with invalid invite: ${normalizedCode.substring(0, 10)}...`,
          ipAddress: getClientIp(req),
          userAgent: req.headers['user-agent'],
          action: 'blocked'
        });

        return res.status(400).json({
          error: 'invalid_invite',
          message: 'This invite code is not valid.'
        });
      }

      // Check if invite is valid (not expired, not used, not revoked)
      const validation = invite.isValid();

      if (!validation.valid) {
        const messages = {
          already_used: 'This invite has already been used.',
          expired: 'This invite has expired.',
          revoked: 'This invite is no longer valid.'
        };

        return res.status(400).json({
          error: validation.reason,
          message: messages[validation.reason] || 'This invite is not valid.'
        });
      }

      // Invite is valid, store for later use (mark as used after user creation)
      validatedInvite = invite;
    }

    // STEP 5: Continue with other validations (email/username uniqueness, etc.)

    // Check if user exists
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) {
      if (user.email === email) {
        // Check if this is a deleted account in recovery window
        if (user.isDeleted && user.deletionScheduledFor && user.deletionScheduledFor > Date.now()) {
          return res.status(409).json({
            message: 'This account is scheduled for deletion. Please log in to restore your account.'
          });
        }
        // Check if this is a deleted account past recovery window - allow permanent deletion then registration
        else if (user.isDeleted && user.deletionScheduledFor && user.deletionScheduledFor <= Date.now()) {
          // Trigger permanent deletion cleanup
          await user.deleteOne();
          logger.info(`Permanently deleted expired account for email: ${email} during registration`);
        } else {
          return res.status(400).json({ message: 'Email already registered' });
        }
      }
      return res.status(400).json({ message: 'Username already taken' });
    }

    // Create new user
    user = new User({
      // Required fields
      fullName: fullName.trim(),
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      password,
      birthday: birthDate,

      // Optional fields (only set if provided)
      displayName: displayName?.trim() || null,
      identity: identity || null,
      pronouns: pronouns?.trim() || null,
      bio: bio?.trim() || null,

      // Legacy fields (for backward compatibility)
      nickname: nickname?.trim() || '',
      customPronouns: customPronouns?.trim() || '',
      gender: gender?.trim() || '',
      customGender: customGender?.trim() || '',
      // REMOVED 2025-12-26: relationshipStatus, isAlly deleted (Phase 5)

      // Profile state
      profileComplete: false,
      onboardingStep: 'registered',
      onboardingCompleted: false,

      // Terms acceptance
      termsAcceptedAt: new Date(),
      termsVersion: config.termsVersion,
      privacyAcceptedAt: new Date(),
      privacyVersion: config.privacyVersion
    });

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    await user.save();

    // Send verification email (don't block registration if email fails)
    sendVerificationEmail(email, verificationToken, username).catch(err => {
      logger.error('Failed to send verification email:', err);
    });

    // Generate token pair with session
    const { accessToken, refreshToken, sessionId } = generateTokenPair(user._id);

    // Store session with refresh token
    const deviceInfo = parseUserAgent(req.headers['user-agent']);
    const ipAddress = getClientIp(req);
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const sessionData = {
      sessionId,
      refreshToken: null, // 🔐 Don't store plaintext - use hash only
      refreshTokenHash,   // 🔐 Store hash for secure verification
      refreshTokenExpiry: getRefreshTokenExpiry(),
      deviceInfo: deviceInfo.device || 'Unknown Device',
      browser: deviceInfo.browser || 'Unknown Browser',
      os: deviceInfo.os || 'Unknown OS',
      ipAddress,
      createdAt: new Date(),
      lastActive: new Date()
    };

    // Phase 3B-A: Dual-write - create first-class session (authoritative)
    try {
      await Session.create({
        userId: user._id,
        sessionId,
        refreshTokenHash: Session.hashToken(refreshToken),
        refreshTokenExpiry: sessionData.refreshTokenExpiry,
        deviceInfo: sessionData.deviceInfo,
        browser: sessionData.browser,
        os: sessionData.os,
        ipAddress,
        createdAt: sessionData.createdAt,
        lastActiveAt: sessionData.lastActive,
        isActive: true
      });
      logger.debug(`[Phase 3B-A] Created first-class session ${sessionId} for user ${user.username}`);
    } catch (sessionError) {
      // Log but don't fail - User.activeSessions is fallback
      logger.error('[Phase 3B-A] Failed to create Session document:', sessionError.message);
    }

    // Keep existing behavior (User.activeSessions as cache)
    user.activeSessions.push(sessionData);

    // Enforce max concurrent sessions (removes oldest if limit exceeded)
    enforceMaxSessions(user);

    await user.save();

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 7B: Mark invite as used (atomically) after successful registration
    // ═══════════════════════════════════════════════════════════════════════════
    if (validatedInvite) {
      try {
        await validatedInvite.markUsed(user._id);
        logger.info(`Invite ${validatedInvite.code.substring(0, 10)}... used by ${username}`);

        // Log invite usage for security
        await SecurityLog.create({
          type: 'invite_used',
          severity: 'info',
          userId: user._id,
          username: user.username,
          details: `User registered using invite: ${validatedInvite.code.substring(0, 10)}...`,
          ipAddress: getClientIp(req),
          userAgent: req.headers['user-agent'],
          action: 'completed'
        });
      } catch (inviteError) {
        // Don't fail registration if invite marking fails
        logger.error('Failed to mark invite as used:', inviteError);
      }
    }

    logger.debug(`New user registered: ${username} (${email})`);

    // Emit real-time event for new user registration (for admin panel)
    if (req.io) {
      req.io.emit('user_created', {
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          isActive: user.isActive,
          isBanned: user.isBanned,
          isSuspended: user.isSuspended,
          createdAt: user.createdAt
        }
      });
    }

    // Set refresh token in httpOnly cookie (ONLY source of truth for refresh tokens)
    const cookieOptions = getRefreshTokenCookieOptions();

    logger.debug('Setting refresh token cookie (register) with options:', cookieOptions);
    res.cookie('refreshToken', refreshToken, cookieOptions);

    // 🔐 SECURITY: Access token returned ONLY in JSON body, NOT as cookie
    // Frontend stores in memory (AuthContext), not localStorage

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      accessToken,
      // 🔐 SECURITY: refreshToken no longer returned in body - cookie is sole source
      user: {
        id: user._id,
        _id: user._id,  // Include both for backward compatibility
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        displayName: user.displayName,
        nickname: user.nickname,
        pronouns: user.pronouns,
        customPronouns: user.customPronouns,
        gender: user.gender,
        customGender: user.customGender,
        // REMOVED 2025-12-26: relationshipStatus deleted (Phase 5)
        profilePhoto: user.profilePhoto,
        coverPhoto: user.coverPhoto,
        bio: user.bio,
        socialLinks: user.socialLinks,
        role: user.role, // Include role for consistency with login/me endpoints
        permissions: user.permissions,
        // Onboarding tour flags (new user = show tour)
        hasCompletedTour: user.hasCompletedTour,
        hasSkippedTour: user.hasSkippedTour,
        showTour: true // New signup always shows tour
      }
    });
  } catch (error) {
    logger.error('Signup error:', error.message);

    // Handle password validation errors
    if (error.name === 'ValidationError' && error.errors?.password) {
      return res.status(400).json({
        success: false,
        message: error.errors.password.message,
        field: 'password'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', loginLimiter, validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      // Log failed login attempt
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // PHASE B: Lock System Accounts
    // System accounts can NEVER authenticate
    if (user.isSystemAccount === true) {
      // Log security event
      try {
        await SecurityLog.create({
          userId: user._id,
          action: 'SYSTEM_ACCOUNT_LOGIN_ATTEMPT',
          ipAddress: getClientIp(req),
          userAgent: req.headers['user-agent'],
          success: false,
          details: {
            username: user.username,
            systemRole: user.systemRole,
            reason: 'System accounts cannot authenticate'
          }
        });
      } catch (logError) {
        logger.error('Failed to log system account login attempt:', logError);
      }

      return res.status(403).json({
        message: 'System accounts cannot authenticate',
        code: 'SYSTEM_ACCOUNT_LOGIN_DENIED'
      });
    }

    // Check if account is deleted
    if (user.isDeleted) {
      // If within recovery window, automatically restore account
      if (user.deletionScheduledFor && user.deletionScheduledFor > Date.now()) {
        logger.info(`Automatically recovering deleted account for user: ${user.username} (${user.email})`);

        // Restore account
        user.isDeleted = false;
        user.deletionScheduledFor = null;
        user.deletedAt = null;
        user.deletionConfirmationToken = null;
        user.deletionConfirmationExpires = null;

        await user.save();

        // Emit real-time event for admin panel
        const io = req.app.get('io');
        if (io) {
          io.emit('user_recovered', {
            userId: user._id,
            username: user.username,
            automatic: true,
            method: 'login',
            timestamp: new Date()
          });
        }
      } else {
        // Past recovery window - hard block
        return res.status(401).json({
          message: 'Account deleted',
          code: 'ACCOUNT_DELETED'
        });
      }
    }

    // Note: Deactivated accounts will be auto-reactivated after successful password verification
    // (See auto-reactivation logic after password check below)

    // Check if account is locked
    if (user.isLocked()) {
      const lockoutMinutes = Math.ceil((user.lockoutUntil - Date.now()) / 60000);
      return res.status(423).json({
        message: `Account is temporarily locked due to too many failed login attempts. Please try again in ${lockoutMinutes} minute(s).`,
        lockoutUntil: user.lockoutUntil
      });
    }

    // Check age if birthday exists (auto-ban underage users)
    if (user.birthday) {
      const birthDate = new Date(user.birthday);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      if (age < 18) {
        // Auto-ban underage user
        user.isBanned = true;
        user.bannedReason = 'Underage - Platform is strictly 18+ only';
        await user.save();

        // Log underage login attempt
        try {
          await SecurityLog.create({
            type: 'underage_login',
            severity: 'critical',
            username: user.username,
            email: user.email,
            userId: user._id,
            birthday: user.birthday,
            calculatedAge: age,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'],
            details: `Underage user attempted login and was auto-banned. Age: ${age} years old.`,
            action: 'banned'
          });
        } catch (logError) {
          logger.error('Failed to log underage login attempt:', logError);
        }

        return res.status(403).json({
          message: 'Your account has been banned. This platform is strictly 18+ only.',
          reason: 'underage'
        });
      }
    }

    // Check if user is banned
    if (user.isBanned) {
      return res.status(403).json({
        message: `Your account has been banned. Reason: ${user.bannedReason}`
      });
    }

    // Check if user is suspended
    if (user.isSuspended) {
      const suspendedUntil = new Date(user.suspendedUntil);
      if (suspendedUntil > new Date()) {
        return res.status(403).json({
          message: `Your account is suspended until ${suspendedUntil.toLocaleDateString()}. Reason: ${user.suspensionReason}`
        });
      } else {
        // Suspension expired, unsuspend user
        user.isSuspended = false;
        user.suspendedUntil = null;
        user.suspensionReason = '';
      }
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Phase 4A: Track failed login
      incCounter('auth.login.failure');

      // Increment login attempts and potentially lock account
      await user.incrementLoginAttempts();

      // Log failed login attempt
      const ipAddress = getClientIp(req);
      const { deviceInfo } = parseUserAgent(req.headers['user-agent']);

      user.loginHistory.push({
        ipAddress,
        deviceInfo,
        success: false,
        failureReason: 'Invalid password',
        timestamp: new Date()
      });

      limitLoginHistory(user);
      await user.save();

      // Reload user to get updated loginAttempts
      const updatedUser = await User.findById(user._id);
      const attemptsLeft = 5 - updatedUser.loginAttempts;

      if (updatedUser.isLocked()) {
        return res.status(423).json({
          message: 'Too many failed login attempts. Your account has been temporarily locked for 15 minutes.',
          lockoutUntil: updatedUser.lockoutUntil
        });
      }

      return res.status(401).json({
        message: 'Invalid email or password',
        attemptsLeft: attemptsLeft > 0 ? attemptsLeft : undefined
      });
    }

    // Password is correct - reset login attempts
    if (user.loginAttempts > 0 || user.lockoutUntil) {
      await user.resetLoginAttempts();
    }

    // Auto-reactivate deactivated accounts on successful login
    if (!user.isActive) {
      user.isActive = true;
      user.deactivatedAt = null;
      await user.save();

      logger.info(`✅ Account auto-reactivated for user: ${user.username} (${user.email})`);

      // Emit real-time event for admin panel
      const io = req.app.get('io');
      if (io) {
        io.emit('user_reactivated', {
          userId: user._id,
          username: user.username,
          automatic: true,
          timestamp: new Date()
        });
      }
    }

    // Get device and IP info
    const ipAddress = getClientIp(req);
    const { browser, os, deviceInfo } = parseUserAgent(req.headers['user-agent']);

    // Get IP geolocation (async, but don't block login if it fails)
    const location = await getIpGeolocation(ipAddress);

    // Check for login after prolonged inactivity (90+ days)
    const INACTIVITY_THRESHOLD_DAYS = 90;
    const INACTIVITY_THRESHOLD_MS = INACTIVITY_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
    let loginAfterInactivity = false;

    if (user.lastLogin) {
      const daysSinceLastLogin = (Date.now() - new Date(user.lastLogin).getTime()) / (24 * 60 * 60 * 1000);

      if (daysSinceLastLogin > INACTIVITY_THRESHOLD_DAYS) {
        loginAfterInactivity = true;

        // Log security event (async, don't block login)
        SecurityLog.create({
          type: 'login_after_inactivity',
          severity: 'medium',
          username: user.username,
          email: user.email,
          userId: user._id,
          ipAddress,
          userAgent: req.headers['user-agent'],
          details: {
            daysSinceLastLogin: Math.floor(daysSinceLastLogin),
            lastLoginDate: user.lastLogin,
            currentLoginDate: new Date(),
            deviceInfo,
            browser,
            os,
            location
          }
        }).catch(err => {
          logger.error('Failed to log login after inactivity event:', err);
        });

        logger.info(`Login after ${Math.floor(daysSinceLastLogin)} days of inactivity: ${user.username}`);
      }
    }

    // Check if 2FA is enabled (push or TOTP)
    if (user.pushTwoFactorEnabled || user.twoFactorEnabled) {
      // Check if login is suspicious (with location data)
      const suspicious = isSuspiciousLogin(user, ipAddress, deviceInfo, location);

      // Prefer push 2FA if enabled and user has push subscription
      if (user.pushTwoFactorEnabled && user.preferPushTwoFactor && user.pushSubscription) {
        // Use push-based 2FA - client will call /api/login-approval/request
        return res.json({
          success: false,
          requiresPush2FA: true,
          userId: user._id,
          deviceInfo,
          browser,
          os,
          ipAddress,
          suspicious,
          message: 'Push 2FA verification required. Check your other devices.'
        });
      }
      // Fall back to TOTP if push 2FA not available
      else if (user.twoFactorEnabled) {
        // Return temporary token that requires TOTP 2FA verification
        const tempToken = jwt.sign(
          { userId: user._id, requires2FA: true },
          config.jwtSecret,
          { expiresIn: '10m' }
        );

        return res.json({
          success: false,
          requires2FA: true,
          tempToken,
          suspicious,
          message: '2FA verification required'
        });
      }
      // Push 2FA enabled but no subscription - error
      else {
        return res.status(400).json({
          message: 'Push 2FA is enabled but no push subscription found. Please enable notifications or use backup codes.',
          fallbackToTOTP: user.twoFactorEnabled
        });
      }
    }

    // Check if login is suspicious (with location data or inactivity)
    const suspicious = isSuspiciousLogin(user, ipAddress, deviceInfo, location) || loginAfterInactivity;

    // Clean up old sessions first
    cleanupOldSessions(user);

    // Generate token pair with new session
    const { accessToken, refreshToken, sessionId } = generateTokenPair(user._id);

    // 🔐 Hash refresh token for secure storage
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
        lastActiveAt: sessionData.lastActive,
        isActive: true
      });
      logger.debug(`[Phase 3B-A] Created first-class session ${sessionId} for user ${user.username}`);
    } catch (sessionError) {
      // Log but don't fail - User.activeSessions is fallback
      logger.error('[Phase 3B-A] Failed to create Session document:', sessionError.message);
    }

    // Keep existing behavior (User.activeSessions as cache)
    user.activeSessions.push(sessionData);

    // Enforce max concurrent sessions (removes oldest if limit exceeded)
    enforceMaxSessions(user);

    // Log successful login with location
    user.loginHistory.push({
      ipAddress,
      deviceInfo,
      location,
      success: true,
      timestamp: new Date()
    });

    // Update last login
    user.lastLogin = new Date();

    limitLoginHistory(user);
    await user.save();

    // Send login alert emails ONLY for new devices or suspicious logins (async, don't wait)
    const isNew = isNewDevice(user, ipAddress, deviceInfo);

    if (user.loginAlerts?.enabled) {
      const loginInfo = {
        deviceInfo,
        browser,
        os,
        ipAddress,
        location,
        timestamp: new Date()
      };

      // Send suspicious login email if enabled and login is suspicious
      if (suspicious && user.loginAlerts?.emailOnSuspiciousLogin) {
        sendSuspiciousLoginEmail(user.email, user.username, loginInfo).catch(err =>
          logger.error('Failed to send suspicious login email:', err)
        );
      }
      // Send new device email ONLY if it's actually a new device
      else if (isNew && user.loginAlerts?.emailOnNewDevice) {
        sendLoginAlertEmail(user.email, user.username, loginInfo).catch(err =>
          logger.error('Failed to send login alert email:', err)
        );
      }
      // Otherwise, don't send any email (same device, not suspicious)
    }

    logger.debug(`User logged in: ${email} from ${ipAddress}`);

    // Set refresh token in httpOnly cookie (ONLY source of truth for refresh tokens)
    const cookieOptions = getRefreshTokenCookieOptions();

    logger.debug('Setting refresh token cookie (login) with options:', cookieOptions);
    res.cookie('refreshToken', refreshToken, cookieOptions);

    // 🔐 SECURITY: Access token returned ONLY in JSON body, NOT as cookie
    // Frontend stores in memory (AuthContext), not localStorage

    // 🔧 BADGE CHURN FIX: Removed badge processing from login
    // Badges are now only processed on relevant events (post creation, profile update)
    // and via the daily sweep job. This prevents excessive assign/revoke cycles.

    // Determine if tour should be shown (first login with tour not completed/skipped)
    const showTour = !user.hasCompletedTour && !user.hasSkippedTour;

    // Phase 4A: Track successful login
    incCounter('auth.login.success');

    res.json({
      success: true,
      message: 'Login successful',
      accessToken,
      // 🔐 SECURITY: refreshToken no longer returned in body - cookie is sole source
      suspicious,
      // 🌍 Country code for SafetyWarning (avoids CORS issues with frontend geolocation APIs)
      countryCode: location.countryCode || null,
      user: {
        id: user._id,
        _id: user._id,  // Include both for backward compatibility
        username: user.username,
        email: user.email,
        emailVerified: user.emailVerified || false,  // 🔔 CRITICAL: Include emailVerified status
        fullName: user.fullName,
        displayName: user.displayName,
        nickname: user.nickname,
        pronouns: user.pronouns,
        customPronouns: user.customPronouns,
        gender: user.gender,
        customGender: user.customGender,
        // REMOVED 2025-12-26: relationshipStatus deleted (Phase 5)
        profilePhoto: user.profilePhoto,
        coverPhoto: user.coverPhoto,
        bio: user.bio,
        location: user.location,
        website: user.website,
        socialLinks: user.socialLinks,
        role: user.role,
        permissions: user.permissions,
        // Onboarding tour flags
        hasCompletedTour: user.hasCompletedTour,
        hasSkippedTour: user.hasSkippedTour,
        showTour
      }
    });
  } catch (error) {
    logger.error('Login error:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Server error during login',
      error: error.message 
    });
  }
});

// @route   POST /api/auth/verify-2fa-login
// @desc    Complete login with 2FA verification
// @access  Public (requires temp token)
router.post('/verify-2fa-login', loginLimiter, async (req, res) => {
  try {
    const { tempToken, token: twoFactorToken } = req.body;

    if (!tempToken || !twoFactorToken) {
      return res.status(400).json({ message: 'Temporary token and 2FA code are required' });
    }

    // Verify temp token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, config.jwtSecret);
    } catch (error) {
      return res.status(401).json({ message: 'Invalid or expired temporary token' });
    }

    if (!decoded.requires2FA) {
      return res.status(400).json({ message: 'Invalid token type' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Import speakeasy for verification
    const speakeasy = (await import('speakeasy')).default;

    // Check if it's a backup code
    const backupCodeIndex = user.twoFactorBackupCodes.findIndex(
      bc => bc.code === twoFactorToken && !bc.used
    );

    let verified = false;

    if (backupCodeIndex !== -1) {
      // Mark backup code as used
      user.twoFactorBackupCodes[backupCodeIndex].used = true;
      verified = true;
    } else {
      // Decrypt secret for verification (handles encrypted and legacy secrets)
      const decryptedSecret = getDecrypted2FASecret(user);

      // Verify TOTP token
      verified = speakeasy.totp.verify({
        secret: decryptedSecret,
        encoding: 'base32',
        token: twoFactorToken,
        window: 2
      });
    }

    if (!verified) {
      return res.status(400).json({ message: 'Invalid 2FA code' });
    }

    // Auto-reactivate deactivated accounts on successful 2FA login
    if (!user.isActive) {
      user.isActive = true;
      user.deactivatedAt = null;
      await user.save();

      logger.info(`✅ Account auto-reactivated for user: ${user.username} (${user.email}) via 2FA login`);

      // Emit real-time event for admin panel
      const io = req.app.get('io');
      if (io) {
        io.emit('user_reactivated', {
          userId: user._id,
          username: user.username,
          automatic: true,
          method: '2FA',
          timestamp: new Date()
        });
      }
    }

    // Get device and IP info
    const ipAddress = getClientIp(req);
    const { browser, os, deviceInfo } = parseUserAgent(req.headers['user-agent']);

    // Get IP geolocation (async, but don't block login if it fails)
    const location = await getIpGeolocation(ipAddress);

    // Check for login after prolonged inactivity (90+ days)
    const INACTIVITY_THRESHOLD_DAYS = 90;
    const INACTIVITY_THRESHOLD_MS = INACTIVITY_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
    let loginAfterInactivity = false;

    if (user.lastLogin) {
      const daysSinceLastLogin = (Date.now() - new Date(user.lastLogin).getTime()) / (24 * 60 * 60 * 1000);

      if (daysSinceLastLogin > INACTIVITY_THRESHOLD_DAYS) {
        loginAfterInactivity = true;

        // Log security event (async, don't block login)
        SecurityLog.create({
          type: 'login_after_inactivity',
          severity: 'medium',
          username: user.username,
          email: user.email,
          userId: user._id,
          ipAddress,
          userAgent: req.headers['user-agent'],
          details: {
            daysSinceLastLogin: Math.floor(daysSinceLastLogin),
            lastLoginDate: user.lastLogin,
            currentLoginDate: new Date(),
            deviceInfo,
            browser,
            os,
            location
          }
        }).catch(err => {
          logger.error('Failed to log login after inactivity event:', err);
        });

        logger.info(`Login after ${Math.floor(daysSinceLastLogin)} days of inactivity: ${user.username}`);
      }
    }

	    // Clean up old sessions first (same behavior as primary /login endpoint)
	    cleanupOldSessions(user);

    // Log successful login with location
    user.loginHistory.push({
      ipAddress,
      deviceInfo,
      location,
      success: true,
      timestamp: new Date()
    });

    // Update last login
    user.lastLogin = new Date();

    limitLoginHistory(user);
    await user.save();

    // Send login alert emails ONLY for new devices or suspicious logins (async, don't wait)
    const isNew = isNewDevice(user, ipAddress, deviceInfo);
    const suspicious = isSuspiciousLogin(user, ipAddress, deviceInfo, location) || loginAfterInactivity;

    if (user.loginAlerts?.enabled) {
      const loginInfo = {
        deviceInfo,
        browser,
        os,
        ipAddress,
        location,
        timestamp: new Date()
      };

      // Send suspicious login email if enabled and login is suspicious
      if (suspicious && user.loginAlerts?.emailOnSuspiciousLogin) {
        sendSuspiciousLoginEmail(user.email, user.username, loginInfo).catch(err =>
          logger.error('Failed to send suspicious login email:', err)
        );
      }
      // Send new device email ONLY if it's actually a new device
      else if (isNew && user.loginAlerts?.emailOnNewDevice) {
        sendLoginAlertEmail(user.email, user.username, loginInfo).catch(err =>
          logger.error('Failed to send login alert email:', err)
        );
      }
      // Otherwise, don't send any email (same device, not suspicious)
    }

    // IMPORTANT: Use the same token issuance flow as standard login to keep
    // auth behavior consistent and ensure token "type" fields, TTLs, and
    // refresh rotation all match the primary login endpoint.

	    // Generate token pair with new session (aligned with /api/auth/login)
    const { accessToken, refreshToken, sessionId: newSessionId } = generateTokenPair(user._id);

    // 🔐 Hash refresh token for secure storage
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Create or update session with refresh token hash (no plaintext storage)
    const sessionIndex = user.activeSessions.findIndex(s => s.sessionId === newSessionId);
    const baseSession = {
      sessionId: newSessionId,
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

    // Phase 3B-A: Dual-write - create or update first-class session (authoritative)
    try {
      await Session.findOneAndUpdate(
        { sessionId: newSessionId, userId: user._id },
        {
          $set: {
            refreshTokenHash,
            refreshTokenExpiry: baseSession.refreshTokenExpiry,
            deviceInfo,
            browser,
            os,
            ipAddress,
            location,
            lastActiveAt: new Date(),
            isActive: true
          },
          $setOnInsert: {
            createdAt: baseSession.createdAt
          }
        },
        { upsert: true, new: true }
      );
      logger.debug(`[Phase 3B-A] Created/updated first-class session ${newSessionId} for 2FA login`);
    } catch (sessionError) {
      // Log but don't fail - User.activeSessions is fallback
      logger.error('[Phase 3B-A] Failed to create/update Session document:', sessionError.message);
    }

    // Keep existing behavior (User.activeSessions as cache)
    if (sessionIndex >= 0) {
      user.activeSessions[sessionIndex] = baseSession;
    } else {
      user.activeSessions.push(baseSession);
    }

    // Enforce max concurrent sessions (removes oldest if limit exceeded)
    enforceMaxSessions(user);

    await user.save();

    // Set refresh token in httpOnly cookie (ONLY source of truth for refresh tokens)
    const cookieOptions = getRefreshTokenCookieOptions();
    logger.debug('Setting refresh token cookie (2FA login) with options:', cookieOptions);
    res.cookie('refreshToken', refreshToken, cookieOptions);

    // 🔐 SECURITY: Access token returned ONLY in JSON body, NOT as cookie
    // Frontend stores in memory (AuthContext), not localStorage

    logger.debug(`User logged in with 2FA: ${user.email} from ${ipAddress}`);

    // 🔧 BADGE CHURN FIX: Removed badge processing from 2FA login
    // Badges are now only processed on relevant events (post creation, profile update)
    // and via the daily sweep job. This prevents excessive assign/revoke cycles.

    // Determine if tour should be shown (first login with tour not completed/skipped)
    const showTour = !user.hasCompletedTour && !user.hasSkippedTour;

    // Phase 4A: Track successful 2FA login
    incCounter('auth.login.success');

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
        emailVerified: user.emailVerified || false,  // 🔔 CRITICAL: Include emailVerified status
        fullName: user.fullName,
        displayName: user.displayName,
        nickname: user.nickname,
        pronouns: user.pronouns,
        customPronouns: user.customPronouns,
        gender: user.gender,
        customGender: user.customGender,
        // REMOVED 2025-12-26: relationshipStatus deleted (Phase 5)
        profilePhoto: user.profilePhoto,
        coverPhoto: user.coverPhoto,
        bio: user.bio,
        location: user.location,
        website: user.website,
        socialLinks: user.socialLinks,
        role: user.role,
        permissions: user.permissions,
        // Onboarding tour flags
        hasCompletedTour: user.hasCompletedTour,
        hasSkippedTour: user.hasSkippedTour,
        showTour
      }
    });
  } catch (error) {
    logger.error('2FA login verification error:', error);
    res.status(500).json({ message: 'Server error during 2FA verification' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('-password')
      .populate('friends', 'username displayName profilePhoto')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // BADGE SYSTEM: Resolve badge IDs to full badge objects
    let resolvedBadges = [];
    if (user.badges && user.badges.length > 0) {
      // Check if user has hideBadges enabled
      const hideBadges = user.privacySettings?.hideBadges;
      if (!hideBadges) {
        try {
          const badges = await Badge.find({ id: { $in: user.badges }, isActive: true })
            .select('id label icon tooltip type priority color')
            .lean();
          resolvedBadges = badges.sort((a, b) => (a.priority || 100) - (b.priority || 100));
        } catch (badgeError) {
          logger.error('Failed to resolve badges in /me:', badgeError);
        }
      }
    }

    // Add session timeout info
    const sessionInfo = getSessionInfo(req.userId);

    // Transform response to include both `id` and `_id` for backward compatibility
    // Some frontend code uses `id`, some uses `_id` - support both during migration
    const responseUser = {
      id: user._id,   // New format (matches login endpoint)
      _id: user._id,  // Legacy format (for backward compatibility)
      username: user.username,
      email: user.email,
      emailVerified: user.emailVerified || false,  // CRITICAL: Include emailVerified status
      fullName: user.fullName,
      displayName: user.displayName,
      nickname: user.nickname,
      pronouns: user.pronouns,
      customPronouns: user.customPronouns,
      gender: user.gender,
      customGender: user.customGender,
      profilePhoto: user.profilePhoto,
      coverPhoto: user.coverPhoto,
      bio: user.bio,
      location: user.location,
      website: user.website,
      socialLinks: user.socialLinks,
      role: user.role,
      permissions: user.permissions,
      badges: resolvedBadges,
      friends: user.friends,
      privacySettings: user.privacySettings,
      notificationPreferences: user.notificationPreferences,
      // Onboarding tour flags
      hasCompletedTour: user.hasCompletedTour,
      hasSkippedTour: user.hasSkippedTour,
      showTour: !user.hasCompletedTour && !user.hasSkippedTour,
      // Session info
      session: {
        timeoutMs: SESSION_TIMEOUT_MS,
        timeUntilTimeout: sessionInfo?.timeUntilTimeout || SESSION_TIMEOUT_MS,
        lastActivity: sessionInfo?.lastActivity || Date.now()
      },
      // Additional fields that may be needed
      identity: user.identity,
      createdAt: user.createdAt,
      lastActive: user.lastActive
    };

    res.json(responseUser);
  } catch (error) {
    logger.error('Get me error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post('/forgot-password', passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash token before saving to database
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Save hashed token and expiration to user
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send email with unhashed token (non-blocking - don't fail if email fails)
    try {
      await sendPasswordResetEmail(user.email, resetToken, user.username);
    } catch (emailError) {
      logger.error('Failed to send password reset email:', emailError);
      // Continue anyway - token is saved in database
    }

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing password reset request'
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    // Validate password length (must match signup requirements)
    if (newPassword.length < 12) {
      return res.status(400).json({ message: 'Password must be at least 12 characters' });
    }

    // Validate password complexity (must match signup requirements)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/])/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      });
    }

    // Hash the token from URL to compare with database
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Update password (will be hashed by pre-save hook)
    user.password = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    // Log security event
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    logPasswordChange(user, ipAddress, userAgent).catch(err => {
      logger.error('Failed to log password change:', err);
    });

    // Send password changed notification email
    sendPasswordChangedEmail(user.email, user.username).catch(err => {
      logger.error('Failed to send password changed email:', err);
    });

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.'
    });
  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password'
    });
  }
});

// @route   GET /api/auth/verify-email/:token
// @desc    Verify email address
// @access  Public
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Find user with this verification token
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }

    // Mark email as verified
    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    // Log security event
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    logEmailVerification(user, ipAddress, userAgent).catch(err => {
      logger.error('Failed to log email verification:', err);
    });

    logger.debug(`Email verified for user: ${user.username}`);

    res.json({
      success: true,
      message: 'Email verified successfully! You can now access all features.'
    });
  } catch (error) {
    logger.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying email'
    });
  }
});

// @route   POST /api/auth/resend-verification
// @desc    Resend verification email
// @access  Private
router.post('/resend-verification', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save();

    // Send verification email
    const emailResult = await sendVerificationEmail(user.email, verificationToken, user.username);

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again later.'
      });
    }

    res.json({
      success: true,
      message: 'Verification email sent! Please check your inbox.'
    });
  } catch (error) {
    logger.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending verification email'
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user and invalidate refresh token
// @access  Private
router.post('/logout', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get current session ID from JWT
    const sessionId = req.sessionId;

    // PHASE G: Revoke admin escalation on logout
    if (['admin', 'super_admin'].includes(user.role)) {
      try {
        const revokedCount = await AdminEscalationToken.revokeAllForUser(user._id, 'User logout');
        if (revokedCount > 0) {
          logger.info(`Revoked ${revokedCount} admin escalation token(s) for ${user.username} on logout`);
        }
      } catch (escalationError) {
        logger.error('Error revoking admin escalation on logout:', escalationError);
      }
    }

    // Phase 3B-A: Revoke session in Session collection (authoritative)
    if (sessionId) {
      try {
        await Session.updateOne(
          { sessionId, userId: req.user.id },
          { $set: { isActive: false, revokedAt: new Date() } }
        );
        logger.debug(`[Phase 3B-A] Session ${sessionId} revoked in Session collection`);
      } catch (sessionError) {
        logger.error('[Phase 3B-A] Failed to revoke Session document:', sessionError.message);
      }
    }

    // Remove the current session from User.activeSessions (cache)
    if (sessionId) {
      user.activeSessions = user.activeSessions.filter(
        s => s.sessionId !== sessionId
      );
      await user.save();
      logger.debug(`Session ${sessionId} removed from User.activeSessions for user ${user.username}`);
    }

    // 🔥 CRITICAL: Force disconnect Socket.IO for this session
    // This prevents zombie sockets and ensures clean logout
    const io = req.app.get('io');
    if (io && sessionId) {
      try {
        const sockets = await io.fetchSockets();
        for (const socket of sockets) {
          if (socket.sessionId === sessionId && socket.userId === user._id.toString()) {
            logger.debug(`🔌 Force disconnecting socket for session ${sessionId}`);
            socket.emit('force_logout', {
              reason: 'Logged out',
              final: true // Flag to prevent reconnection
            });
            socket.disconnect(true);
          }
        }
      } catch (socketError) {
        logger.warn('Socket disconnect error (non-critical):', socketError);
      }
    }

    // Clear refresh token cookie
    const isProduction = config.nodeEnv === 'production';
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/'
    });

    // Clear admin escalation cookie
    res.clearCookie('pryde_admin_escalated', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/'
    });

    // Clear CSRF token cookie
    res.clearCookie('XSRF-TOKEN', {
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/'
    });

    // Clear session activity tracking
    clearSessionActivity(req.userId);

    // Phase 4A: Track logout
    incCounter('auth.logout');

    logger.debug(`User ${user.username} logged out successfully`);

    return res.status(200).json({
      message: 'Logged out successfully',
      success: true
    });
  } catch (error) {
    logger.error('Logout error:', error);
    return res.status(500).json({
      message: 'Logout failed',
      success: false
    });
  }
});

// ============================================
// ONBOARDING TOUR ENDPOINTS
// ============================================

// @route   POST /api/auth/tour/complete
// @desc    Mark onboarding tour as completed
// @access  Private
router.post('/tour/complete', auth, async (req, res) => {
  try {
    // auth middleware sets req.userId (from token) and req.user (full user doc)
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update tour status
    user.hasCompletedTour = true;
    user.tourCompletedAt = new Date();
    await user.save();

    logger.info(`User ${user.username} completed onboarding tour`);

    return res.status(200).json({
      success: true,
      message: 'Tour completed',
      hasCompletedTour: true,
      tourCompletedAt: user.tourCompletedAt
    });
  } catch (error) {
    logger.error('Tour complete error:', error);
    return res.status(500).json({
      message: 'Failed to update tour status',
      success: false
    });
  }
});

// @route   POST /api/auth/tour/skip
// @desc    Mark onboarding tour as skipped (never show again)
// @access  Private
router.post('/tour/skip', auth, async (req, res) => {
  try {
    // auth middleware sets req.userId (from token) and req.user (full user doc)
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update tour status (skipped)
    user.hasSkippedTour = true;
    await user.save();

    logger.info(`User ${user.username} skipped onboarding tour`);

    return res.status(200).json({
      success: true,
      message: 'Tour skipped',
      hasSkippedTour: true
    });
  } catch (error) {
    logger.error('Tour skip error:', error);
    return res.status(500).json({
      message: 'Failed to update tour status',
      success: false
    });
  }
});

// ============================================
// CALM ONBOARDING ENDPOINTS (Phase 1-5)
// ============================================

// @route   POST /api/auth/onboarding/welcome-seen
// @desc    Mark welcome page as seen (Phase 1)
// @access  Private
router.post('/onboarding/welcome-seen', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update onboarding step
    user.onboardingStep = 'welcome_seen';
    await user.save();

    logger.info(`User ${user.username} saw welcome page`);

    return res.status(200).json({
      success: true,
      message: 'Welcome seen',
      onboardingStep: 'welcome_seen'
    });
  } catch (error) {
    logger.error('Welcome seen error:', error);
    return res.status(500).json({
      message: 'Failed to update onboarding status',
      success: false
    });
  }
});

// @route   POST /api/auth/onboarding/tour-dismissed
// @desc    Mark tour as dismissed from intro page (Phase 2)
// @access  Private
router.post('/onboarding/tour-dismissed', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Mark tour as dismissed (never show again)
    user.onboardingTourDismissed = true;
    user.hasSkippedTour = true;
    user.onboardingStep = 'tour_dismissed';
    await user.save();

    logger.info(`User ${user.username} dismissed tour from intro`);

    return res.status(200).json({
      success: true,
      message: 'Tour dismissed',
      onboardingTourDismissed: true
    });
  } catch (error) {
    logger.error('Tour dismissed error:', error);
    return res.status(500).json({
      message: 'Failed to update tour status',
      success: false
    });
  }
});

// @route   POST /api/auth/onboarding/remind-later
// @desc    Defer tour for 3 days (Phase 3 - "Remind me later")
// @access  Private
router.post('/onboarding/remind-later', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Set remind later date to 3 days from now
    const remindDate = new Date();
    remindDate.setDate(remindDate.getDate() + 3);

    user.tourRemindLaterDate = remindDate;
    user.onboardingStep = 'remind_later';
    await user.save();

    logger.info(`User ${user.username} deferred tour until ${remindDate.toISOString()}`);

    return res.status(200).json({
      success: true,
      message: 'Tour deferred',
      tourRemindLaterDate: remindDate
    });
  } catch (error) {
    logger.error('Remind later error:', error);
    return res.status(500).json({
      message: 'Failed to defer tour',
      success: false
    });
  }
});

// ============================================
// CALM ONBOARDING: Phase 4 - Quiet Return
// ============================================

/**
 * @route   GET /api/auth/onboarding/quiet-return
 * @desc    Check if user should see quiet return message (inactive 14-30 days)
 * @access  Private
 *
 * Returns:
 * - showQuietReturn: boolean - true if user should see the message
 * - Only returns true ONCE per inactivity window
 */
router.get('/onboarding/quiet-return', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        showQuietReturn: false
      });
    }

    // Don't show to users who haven't completed initial onboarding
    if (!user.hasCompletedTour && !user.hasSkippedTour && !user.onboardingTourDismissed) {
      return res.json({
        success: true,
        showQuietReturn: false,
        reason: 'onboarding_not_complete'
      });
    }

    // Check if user has been inactive for 14-30 days
    const now = new Date();
    const lastActivity = user.lastActivityDate;

    // If no activity recorded, don't show (they're new or we don't have data)
    if (!lastActivity) {
      return res.json({
        success: true,
        showQuietReturn: false,
        reason: 'no_activity_recorded'
      });
    }

    const daysSinceActivity = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));

    // Only show for 14-30 days of inactivity
    if (daysSinceActivity < 14 || daysSinceActivity > 30) {
      return res.json({
        success: true,
        showQuietReturn: false,
        reason: daysSinceActivity < 14 ? 'too_recent' : 'too_long'
      });
    }

    // Check if we've already shown the quiet return message in this inactivity window
    const quietReturnShown = user.quietReturnShownAt;
    if (quietReturnShown) {
      // If shown after their last activity, don't show again
      if (quietReturnShown > lastActivity) {
        return res.json({
          success: true,
          showQuietReturn: false,
          reason: 'already_shown_this_window'
        });
      }
    }

    // User qualifies for quiet return message
    return res.json({
      success: true,
      showQuietReturn: true,
      daysSinceActivity
    });

  } catch (error) {
    logger.error('Quiet return check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      showQuietReturn: false
    });
  }
});

/**
 * @route   POST /api/auth/onboarding/quiet-return-shown
 * @desc    Mark quiet return message as shown (once per inactivity window)
 * @access  Private
 */
router.post('/onboarding/quiet-return-shown', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.quietReturnShownAt = new Date();
    await user.save();

    logger.info(`User ${user.username} saw quiet return message`);

    return res.status(200).json({
      success: true,
      message: 'Quiet return marked as shown',
      quietReturnShownAt: user.quietReturnShownAt
    });

  } catch (error) {
    logger.error('Quiet return shown error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark quiet return as shown'
    });
  }
});

export default router;
