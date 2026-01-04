import User from '../models/User.js';
import { checkBlockedWords, checkSpam, calculateToxicityScore, getAutoMuteSettings } from '../utils/moderation.js';
import logger from '../utils/logger.js';

/**
 * Check if user is currently muted
 */
export const checkMuted = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('moderation');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // SAFETY: Ensure moderation object exists (older users may not have it)
    if (!user.moderation) {
      return next();
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
    logger.error('Check muted error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Moderate content for blocked words and spam
 * Uses configurable settings from database
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

    // Get configurable auto-mute settings from database
    const autoMuteSettings = await getAutoMuteSettings();

    // SAFETY: Ensure moderation object exists (older users may not have it)
    if (!user.moderation) {
      user.set('moderation', {
        isMuted: false,
        muteExpires: null,
        muteReason: '',
        violationCount: 0,
        lastViolation: null,
        autoMuteEnabled: true
      });
    }
    if (!user.moderationHistory) {
      user.set('moderationHistory', []);
    }

    // Helper to create a truncated content preview (max 200 chars)
    const createContentPreview = (text) => {
      if (!text) return '';
      const cleaned = text.replace(/\s+/g, ' ').trim();
      return cleaned.length > 200 ? cleaned.substring(0, 197) + '...' : cleaned;
    };

    // Determine content type and ID
    const contentType = req.body.postId ? 'comment' : 'post';
    const contentId = req.body.postId || null; // postId for comments, null for new posts

    // Check for blocked words (now async - uses database settings)
    const { isBlocked, blockedWords } = await checkBlockedWords(content);
    if (isBlocked) {
      // Log violation
      user.moderation.violationCount += 1;
      user.moderation.lastViolation = new Date();
      user.moderationHistory.push({
        action: 'warning',
        reason: `Blocked words detected: ${blockedWords.join(', ')}`,
        contentType,
        contentId,
        contentPreview: createContentPreview(content),
        detectedViolations: blockedWords,
        automated: true
      });

      // Auto-mute if enabled globally AND for user, AND violations exceed configurable threshold
      const shouldAutoMute = autoMuteSettings.enabled &&
                             user.moderation.autoMuteEnabled &&
                             user.moderation.violationCount >= autoMuteSettings.violationThreshold;

      if (shouldAutoMute) {
        // Calculate mute duration using configurable settings
        const muteDuration = Math.min(
          user.moderation.violationCount * autoMuteSettings.minutesPerViolation,
          autoMuteSettings.maxMuteDuration
        );
        user.moderation.isMuted = true;
        user.moderation.muteExpires = new Date(Date.now() + muteDuration * 60 * 1000);
        user.moderation.muteReason = 'Repeated violations of community guidelines';
        user.moderationHistory.push({
          action: 'mute',
          reason: `Auto-muted for ${muteDuration} minutes due to repeated violations (${user.moderation.violationCount} violations)`,
          contentType: 'other',
          detectedViolations: [`Total violations: ${user.moderation.violationCount}`],
          automated: true
        });
      }

      await user.save();

      return res.status(400).json({
        message: 'Content contains inappropriate language',
        blockedWords: blockedWords,
        violationCount: user.moderation.violationCount,
        warning: user.moderation.violationCount >= (autoMuteSettings.violationThreshold - 1)
          ? 'Further violations may result in temporary mute'
          : null
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
        contentType,
        contentId,
        contentPreview: createContentPreview(content),
        detectedViolations: [reason],
        automated: true
      });

      // Auto-mute for spam using configurable duration
      if (autoMuteSettings.enabled && user.moderation.autoMuteEnabled) {
        const muteDuration = autoMuteSettings.spamMuteDuration;
        user.moderation.isMuted = true;
        user.moderation.muteExpires = new Date(Date.now() + muteDuration * 60 * 1000);
        user.moderation.muteReason = 'Spam content detected';
        user.moderationHistory.push({
          action: 'mute',
          reason: `Auto-muted for ${muteDuration} minutes due to spam`,
          contentType: 'other',
          detectedViolations: ['Spam detected'],
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

    // Calculate toxicity score (now async - uses database settings)
    const toxicityScore = await calculateToxicityScore(content);
    if (toxicityScore > 50) {
      // Log high toxicity
      user.moderationHistory.push({
        action: 'warning',
        reason: `High toxicity score: ${toxicityScore}`,
        contentType,
        contentId,
        contentPreview: createContentPreview(content),
        detectedViolations: [`Toxicity score: ${toxicityScore}`],
        automated: true
      });
      await user.save();

      // Allow content but warn user
      req.toxicityWarning = true;
    }

    next();
  } catch (error) {
    logger.error('Moderate content error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

