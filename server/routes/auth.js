import express from 'express';
const router = express.Router();
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import SecurityLog from '../models/SecurityLog.js';
import auth from '../middleware/auth.js';
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
import { generateTokenPair, getRefreshTokenExpiry } from '../utils/tokenUtils.js';
import { getRefreshTokenCookieOptions } from '../utils/cookieUtils.js';
import { decryptString, isEncrypted } from '../utils/encryption.js';

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
      // Optional fields
      displayName,
      identity, // 'LGBTQ+' or 'Ally'
      pronouns,
      bio,
      // Legacy fields (for backward compatibility)
      nickname,
      customPronouns,
      gender,
      customGender,
      relationshipStatus,
      isAlly
    } = req.body;

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

    // STEP 4: Continue with other validations (email/username uniqueness, etc.)

    // Check if user exists
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) {
      if (user.email === email) {
        return res.status(400).json({ message: 'Email already registered' });
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
      relationshipStatus: relationshipStatus?.trim() || '',
      isAlly: isAlly || (identity === 'Ally') || false,

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
    user.activeSessions.push({
      sessionId,
      refreshToken,
      refreshTokenExpiry: getRefreshTokenExpiry(),
      deviceInfo: deviceInfo.device || 'Unknown Device',
      browser: deviceInfo.browser || 'Unknown Browser',
      os: deviceInfo.os || 'Unknown OS',
      ipAddress: getClientIp(req),
      createdAt: new Date(),
      lastActive: new Date()
    });

    // Enforce max concurrent sessions (removes oldest if limit exceeded)
    enforceMaxSessions(user);

    await user.save();

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

    // Set refresh token in httpOnly cookie
    const cookieOptions = getRefreshTokenCookieOptions();

    logger.debug('Setting refresh token cookie (register) with options:', cookieOptions);
    res.cookie('refreshToken', refreshToken, cookieOptions);

    // CRITICAL: Also set access token in cookie for cross-origin auth
    const accessTokenCookieOptions = {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000 // 15 minutes (access token expiry)
    };
    res.cookie('token', accessToken, accessTokenCookieOptions);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      accessToken,
      // Send refresh token in response for cross-domain setups (Cloudflare Pages → Render)
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        displayName: user.displayName,
        nickname: user.nickname,
        pronouns: user.pronouns,
        customPronouns: user.customPronouns,
        gender: user.gender,
        customGender: user.customGender,
        relationshipStatus: user.relationshipStatus,
        profilePhoto: user.profilePhoto,
        coverPhoto: user.coverPhoto,
        bio: user.bio,
        socialLinks: user.socialLinks
      }
    });
  } catch (error) {
    logger.error('Signup error:', error.message);
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

    // CRITICAL: Check if account is deleted (hard block - cannot login)
    if (user.isDeleted) {
      return res.status(401).json({
        message: 'Account deleted',
        code: 'ACCOUNT_DELETED'
      });
    }

    // CRITICAL: Check if account is deactivated (soft block - cannot login)
    if (!user.isActive) {
      return res.status(403).json({
        message: 'Account deactivated. Contact support to reactivate.',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

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

    // NOTE: Removed auto-reactivation logic - deactivated users must contact support

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

    // Create session with refresh token and location
    const session = {
      sessionId,
      refreshToken,
      refreshTokenExpiry: getRefreshTokenExpiry(),
      deviceInfo,
      browser,
      os,
      ipAddress,
      location,
      createdAt: new Date(),
      lastActive: new Date()
    };

    // Add new session
    user.activeSessions.push(session);

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

    // Set refresh token in httpOnly cookie
    const cookieOptions = getRefreshTokenCookieOptions();

    logger.debug('Setting refresh token cookie (login) with options:', cookieOptions);
    logger.debug('Refresh token (first 20 chars):', refreshToken.substring(0, 20) + '...');
    res.cookie('refreshToken', refreshToken, cookieOptions);

    // CRITICAL: Also set access token in cookie for cross-origin auth
    const accessTokenCookieOptions = {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000 // 15 minutes (access token expiry)
    };
    logger.debug('Setting access token cookie (login) with options:', accessTokenCookieOptions);
    res.cookie('token', accessToken, accessTokenCookieOptions);

    res.json({
      success: true,
      message: 'Login successful',
      accessToken,
      // Send refresh token in response for cross-domain setups (Cloudflare Pages → Render)
      // Frontend will store it securely and send it back when needed
      refreshToken,
      suspicious,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        displayName: user.displayName,
        nickname: user.nickname,
        pronouns: user.pronouns,
        customPronouns: user.customPronouns,
        gender: user.gender,
        customGender: user.customGender,
        relationshipStatus: user.relationshipStatus,
        profilePhoto: user.profilePhoto,
        coverPhoto: user.coverPhoto,
        bio: user.bio,
        location: user.location,
        website: user.website,
        socialLinks: user.socialLinks,
        role: user.role,
        permissions: user.permissions
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

    // Reactivate account if it was deactivated
    if (user.isActive === false) {
      user.isActive = true;
      await user.save();
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

    // Create or update session with refresh token and location
    const sessionIndex = user.activeSessions.findIndex(s => s.sessionId === newSessionId);
    const baseSession = {
      sessionId: newSessionId,
      refreshToken,
      refreshTokenExpiry: getRefreshTokenExpiry(),
      deviceInfo,
      browser,
      os,
      ipAddress,
      location,
      createdAt: new Date(),
      lastActive: new Date()
    };

    if (sessionIndex >= 0) {
      user.activeSessions[sessionIndex] = baseSession;
    } else {
      user.activeSessions.push(baseSession);
    }

    // Enforce max concurrent sessions (removes oldest if limit exceeded)
    enforceMaxSessions(user);

    await user.save();

    // Set refresh token cookie (reuse normal login cookie options)
    const cookieOptions = getRefreshTokenCookieOptions();
    logger.debug('Setting refresh token cookie (2FA login) with options:', cookieOptions);
    res.cookie('refreshToken', refreshToken, cookieOptions);

    // Also set access token cookie for cross-origin auth, matching /login
    const accessTokenCookieOptions = {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000 // 15 minutes (access token expiry)
    };
    logger.debug('Setting access token cookie (2FA login) with options:', accessTokenCookieOptions);
    res.cookie('token', accessToken, accessTokenCookieOptions);

    logger.debug(`User logged in with 2FA: ${user.email} from ${ipAddress}`);

    res.json({
      success: true,
      message: 'Login successful',
      accessToken,
      // Send refresh token in response for cross-domain setups (Cloudflare Pages → Render)
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        displayName: user.displayName,
        nickname: user.nickname,
        pronouns: user.pronouns,
        customPronouns: user.customPronouns,
        gender: user.gender,
        customGender: user.customGender,
        relationshipStatus: user.relationshipStatus,
        profilePhoto: user.profilePhoto,
        coverPhoto: user.coverPhoto,
        bio: user.bio,
        location: user.location,
        website: user.website,
        socialLinks: user.socialLinks,
        role: user.role,
        permissions: user.permissions
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
      .populate('friends', 'username displayName profilePhoto');

    res.json(user);
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

    // Validate password length
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
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

    // Remove the current session from activeSessions
    if (sessionId) {
      user.activeSessions = user.activeSessions.filter(
        s => s.sessionId !== sessionId
      );
      await user.save();
      logger.debug(`Session ${sessionId} removed for user ${user.username}`);
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

    // Clear CSRF token cookie
    res.clearCookie('XSRF-TOKEN', {
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/'
    });

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

export default router;
