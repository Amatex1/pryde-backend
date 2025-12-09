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
  limitLoginHistory
} from '../utils/sessionUtils.js';
import { logEmailVerification, logPasswordChange } from '../utils/securityLogger.js';
import { loginLimiter, signupLimiter, passwordResetLimiter } from '../middleware/rateLimiter.js';
import { validateSignup, validateLogin } from '../middleware/validation.js';

// @route   POST /api/auth/signup
// @desc    Register new user
// @access  Public
router.post('/signup', signupLimiter, validateSignup, async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      fullName,
      displayName,
      nickname,
      pronouns,
      customPronouns,
      gender,
      customGender,
      relationshipStatus,
      birthday,
      isAlly // PHASE 6: Ally system
    } = req.body;

    // Validation
    if (!username || !email || !password || !birthday) {
      return res.status(400).json({
        message: 'Please provide all required fields including birthday',
        fields: { username, email, password, birthday }
      });
    }

    // Validate birthday and calculate age
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    // Auto-ban users under 18
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
        console.error('Failed to log underage registration attempt:', logError);
      }

      return res.status(403).json({
        message: 'You must be 18 years or older to register. This platform is strictly 18+ only.',
        reason: 'underage'
      });
    }

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
      username,
      email,
      password,
      fullName: fullName || '',
      displayName: displayName || fullName || username,
      nickname: nickname || '',
      pronouns: pronouns || '',
      customPronouns: customPronouns || '',
      gender: gender || '',
      customGender: customGender || '',
      relationshipStatus: relationshipStatus || '',
      birthday: birthDate,
      isAlly: isAlly || false, // PHASE 6: Ally system
      onboardingCompleted: true // PHASE 6: Mark onboarding as complete
    });

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    await user.save();

    // Send verification email (don't block registration if email fails)
    sendVerificationEmail(email, verificationToken, username).catch(err => {
      console.error('Failed to send verification email:', err);
    });

    // Create JWT token
    const token = jwt.sign(
      { userId: user._id },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    console.log(`New user registered: ${username} (${email})`);

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

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
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
    console.error('Signup error:', error.message);
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
          console.error('Failed to log underage login attempt:', logError);
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

    // Reactivate account if it was deactivated
    if (user.isActive === false) {
      user.isActive = true;
      await user.save();
    }

    // Get device and IP info
    const ipAddress = getClientIp(req);
    const { browser, os, deviceInfo } = parseUserAgent(req.headers['user-agent']);

    // Check if 2FA is enabled (push or TOTP)
    if (user.pushTwoFactorEnabled || user.twoFactorEnabled) {
      // Check if login is suspicious
      const suspicious = isSuspiciousLogin(user, ipAddress, deviceInfo);

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

    // Check if login is suspicious
    const suspicious = isSuspiciousLogin(user, ipAddress, deviceInfo);

    // Create session
    const sessionId = generateSessionId();

    // Clean up old sessions
    cleanupOldSessions(user);

    // Add new session
    user.activeSessions.push({
      sessionId,
      deviceInfo,
      browser,
      os,
      ipAddress,
      location: {
        city: '',
        region: '',
        country: ''
      },
      createdAt: new Date(),
      lastActive: new Date()
    });

    // Log successful login
    user.loginHistory.push({
      ipAddress,
      deviceInfo,
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
        location: { city: '', region: '', country: '' },
        timestamp: new Date()
      };

      // Send suspicious login email if enabled and login is suspicious
      if (suspicious && user.loginAlerts?.emailOnSuspiciousLogin) {
        sendSuspiciousLoginEmail(user.email, user.username, loginInfo).catch(err =>
          console.error('Failed to send suspicious login email:', err)
        );
      }
      // Send new device email ONLY if it's actually a new device
      else if (isNew && user.loginAlerts?.emailOnNewDevice) {
        sendLoginAlertEmail(user.email, user.username, loginInfo).catch(err =>
          console.error('Failed to send login alert email:', err)
        );
      }
      // Otherwise, don't send any email (same device, not suspicious)
    }

    // Create JWT token with session ID
    const token = jwt.sign(
      { userId: user._id, sessionId },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    console.log(`User logged in: ${email} from ${ipAddress}`);

    res.json({
      success: true,
      message: 'Login successful',
      token,
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
    console.error('Login error:', error.message);
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
      // Verify TOTP token
      verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
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

    // Create session
    const sessionId = generateSessionId();

    // Clean up old sessions
    cleanupOldSessions(user);

    // Add new session
    user.activeSessions.push({
      sessionId,
      deviceInfo,
      browser,
      os,
      ipAddress,
      location: {
        city: '',
        region: '',
        country: ''
      },
      createdAt: new Date(),
      lastActive: new Date()
    });

    // Log successful login
    user.loginHistory.push({
      ipAddress,
      deviceInfo,
      success: true,
      timestamp: new Date()
    });

    // Update last login
    user.lastLogin = new Date();

    limitLoginHistory(user);
    await user.save();

    // Send login alert emails ONLY for new devices or suspicious logins (async, don't wait)
    const isNew = isNewDevice(user, ipAddress, deviceInfo);
    const suspicious = isSuspiciousLogin(user, ipAddress, deviceInfo);

    if (user.loginAlerts?.enabled) {
      const loginInfo = {
        deviceInfo,
        browser,
        os,
        ipAddress,
        location: { city: '', region: '', country: '' },
        timestamp: new Date()
      };

      // Send suspicious login email if enabled and login is suspicious
      if (suspicious && user.loginAlerts?.emailOnSuspiciousLogin) {
        sendSuspiciousLoginEmail(user.email, user.username, loginInfo).catch(err =>
          console.error('Failed to send suspicious login email:', err)
        );
      }
      // Send new device email ONLY if it's actually a new device
      else if (isNew && user.loginAlerts?.emailOnNewDevice) {
        sendLoginAlertEmail(user.email, user.username, loginInfo).catch(err =>
          console.error('Failed to send login alert email:', err)
        );
      }
      // Otherwise, don't send any email (same device, not suspicious)
    }

    // Create JWT token with session ID
    const token = jwt.sign(
      { userId: user._id, sessionId },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    console.log(`User logged in with 2FA: ${user.email} from ${ipAddress}`);

    res.json({
      success: true,
      message: 'Login successful',
      token,
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
    console.error('2FA login verification error:', error);
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
    console.error('Get me error:', error);
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
      console.error('Failed to send password reset email:', emailError);
      // Continue anyway - token is saved in database
    }

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
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
      console.error('Failed to log password change:', err);
    });

    // Send password changed notification email
    sendPasswordChangedEmail(user.email, user.username).catch(err => {
      console.error('Failed to send password changed email:', err);
    });

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
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
      console.error('Failed to log email verification:', err);
    });

    console.log(`Email verified for user: ${user.username}`);

    res.json({
      success: true,
      message: 'Email verified successfully! You can now access all features.'
    });
  } catch (error) {
    console.error('Email verification error:', error);
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
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending verification email'
    });
  }
});

export default router;
