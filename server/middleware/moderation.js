import User from '../models/User.js';
import { checkBlockedWords, checkSpam, calculateToxicityScore } from '../utils/moderation.js';

/**
 * Check if user is currently muted
 */
export const checkMuted = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('moderation');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is muted
    if (user.moderation.isMuted) {
      // Check if mute has expired
      if (user.moderation.muteExpires && new Date() > user.moderation.muteExpires) {
        // Unmute user
        user.moderation.isMuted = false;
        user.moderation.muteExpires = null;
        user.moderation.muteReason = '';
        await user.save();
        return next();
      }

      // User is still muted
      const expiresIn = user.moderation.muteExpires 
        ? Math.ceil((user.moderation.muteExpires - new Date()) / (1000 * 60)) 
        : 'indefinitely';

      return res.status(403).json({
        message: 'You are temporarily muted',
        reason: user.moderation.muteReason,
        expiresIn: expiresIn === 'indefinitely' ? expiresIn : `${expiresIn} minutes`
      });
    }

    next();
  } catch (error) {
    console.error('Check muted error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Moderate content for blocked words and spam
 */
export const moderateContent = async (req, res, next) => {
  try {
    const content = req.body.content || req.body.text || '';

    if (!content) {
      return next();
    }

    const user = await User.findById(req.userId).select('moderation moderationHistory');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check for blocked words
    const { isBlocked, blockedWords } = checkBlockedWords(content);
    if (isBlocked) {
      // Log violation
      user.moderation.violationCount += 1;
      user.moderation.lastViolation = new Date();
      user.moderationHistory.push({
        action: 'warning',
        reason: `Blocked words detected: ${blockedWords.join(', ')}`,
        contentType: req.body.postId ? 'comment' : 'post',
        automated: true
      });

      // Auto-mute if enabled and violations exceed threshold
      if (user.moderation.autoMuteEnabled && user.moderation.violationCount >= 3) {
        const muteDuration = Math.min(user.moderation.violationCount * 30, 1440); // Max 24 hours
        user.moderation.isMuted = true;
        user.moderation.muteExpires = new Date(Date.now() + muteDuration * 60 * 1000);
        user.moderation.muteReason = 'Repeated violations of community guidelines';
        user.moderationHistory.push({
          action: 'mute',
          reason: `Auto-muted for ${muteDuration} minutes due to repeated violations`,
          automated: true
        });
      }

      await user.save();

      return res.status(400).json({
        message: 'Content contains inappropriate language',
        blockedWords: blockedWords,
        violationCount: user.moderation.violationCount,
        warning: user.moderation.violationCount >= 2 ? 'Further violations may result in temporary mute' : null
      });
    }

    // Check for spam
    const { isSpam, reason } = checkSpam(content);
    if (isSpam) {
      // Log spam detection
      user.moderation.violationCount += 1;
      user.moderation.lastViolation = new Date();
      user.moderationHistory.push({
        action: 'spam-detected',
        reason: reason,
        contentType: req.body.postId ? 'comment' : 'post',
        automated: true
      });

      // Auto-mute for spam
      if (user.moderation.autoMuteEnabled) {
        const muteDuration = 60; // 1 hour for spam
        user.moderation.isMuted = true;
        user.moderation.muteExpires = new Date(Date.now() + muteDuration * 60 * 1000);
        user.moderation.muteReason = 'Spam content detected';
        user.moderationHistory.push({
          action: 'mute',
          reason: `Auto-muted for ${muteDuration} minutes due to spam`,
          automated: true
        });
      }

      await user.save();

      return res.status(400).json({
        message: 'Content flagged as spam',
        reason: reason,
        violationCount: user.moderation.violationCount
      });
    }

    // Calculate toxicity score
    const toxicityScore = calculateToxicityScore(content);
    if (toxicityScore > 50) {
      // Log high toxicity
      user.moderationHistory.push({
        action: 'warning',
        reason: `High toxicity score: ${toxicityScore}`,
        contentType: req.body.postId ? 'comment' : 'post',
        automated: true
      });
      await user.save();

      // Allow content but warn user
      req.toxicityWarning = true;
    }

    next();
  } catch (error) {
    console.error('Moderate content error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

