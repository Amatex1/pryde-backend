import User from '../models/User.js';
import {
  checkBlockedWords,
  checkSpam,
  calculateToxicityScore,
  getAutoMuteSettings,
  getViolationDecaySettings,
  getEnforcementSettings,
  getWarningMessages,
  getWarningTier,
  applyViolationDecay
} from '../utils/moderation.js';
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
 * Uses configurable settings from database.
 *
 * ENFORCEMENT PHILOSOPHY (Community Guidelines):
 * - Profanity: Allowed, contributes to toxicity score only, no violations
 * - Slurs/Hate Speech: Zero tolerance, immediate enforcement
 * - Sexual/Custom blocked: Standard warning ladder
 * - Spam: Separate enforcement track from speech violations
 * - Toxicity Score: Soft warnings only, NEVER auto-mute/ban
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

    // Get all settings
    const [autoMuteSettings, decaySettings, enforcementSettings, warningMessages] = await Promise.all([
      getAutoMuteSettings(),
      getViolationDecaySettings(),
      getEnforcementSettings(),
      getWarningMessages()
    ]);

    // SAFETY: Ensure moderation object exists (older users may not have it)
    if (!user.moderation) {
      user.set('moderation', {
        isMuted: false,
        muteExpires: null,
        muteReason: '',
        violationCount: 0,
        spamViolationCount: 0,
        slurViolationCount: 0,
        lastViolation: null,
        lastDecayApplied: null,
        autoMuteEnabled: true
      });
    }
    // Ensure new fields exist for older users
    if (user.moderation.spamViolationCount === undefined) {
      user.moderation.spamViolationCount = 0;
    }
    if (user.moderation.slurViolationCount === undefined) {
      user.moderation.slurViolationCount = 0;
    }
    if (!user.moderationHistory) {
      user.set('moderationHistory', []);
    }

    // Apply violation decay before processing new content
    const { decayApplied, amountDecayed } = applyViolationDecay(user, decaySettings);
    if (decayApplied) {
      user.moderationHistory.push({
        action: 'decay-applied',
        reason: `Violation count reduced by ${amountDecayed} due to clean behavior period`,
        contentType: 'other',
        detectedViolations: [`Decayed ${amountDecayed} violation(s)`],
        automated: true
      });
    }

    // Helper to create a truncated content preview (max 200 chars)
    const createContentPreview = (text) => {
      if (!text) return '';
      const cleaned = text.replace(/\s+/g, ' ').trim();
      return cleaned.length > 200 ? cleaned.substring(0, 197) + '...' : cleaned;
    };

    // Determine content type and ID
    const contentType = req.body.postId ? 'comment' : 'post';
    const contentId = req.body.postId || null;

    // ═══════════════════════════════════════════════════════════════════════════
    // BLOCKED WORDS CHECK (with category awareness)
    // ═══════════════════════════════════════════════════════════════════════════
    const { isBlocked, blockedWords, categories } = await checkBlockedWords(content);

    if (isBlocked) {
      const hasSlurs = categories.slurs.length > 0;
      const hasSexual = categories.sexual.length > 0;
      const hasCustom = categories.custom.length > 0;
      const hasProfanityOnly = categories.profanity.length > 0 &&
                               !hasSlurs && !hasSexual && !hasCustom;
      const hasSpamWords = categories.spam.length > 0;

      // ─────────────────────────────────────────────────────────────────────────
      // SLUR DETECTION: Zero tolerance, immediate enforcement
      // ─────────────────────────────────────────────────────────────────────────
      if (hasSlurs && enforcementSettings.slursZeroTolerance) {
        user.moderation.slurViolationCount = (user.moderation.slurViolationCount || 0) + 1;
        user.moderation.violationCount += 1;
        user.moderation.lastViolation = new Date();

        // Calculate escalating mute duration for slurs
        const baseDuration = autoMuteSettings.slurMuteDuration || 120;
        const escalationMultiplier = autoMuteSettings.slurEscalationMultiplier || 2;
        const muteDuration = Math.min(
          baseDuration * Math.pow(escalationMultiplier, user.moderation.slurViolationCount - 1),
          autoMuteSettings.maxMuteDuration
        );

        user.moderationHistory.push({
          action: 'slur-detected',
          reason: `Slur/hate speech detected: ${categories.slurs.join(', ')}`,
          contentType,
          contentId,
          contentPreview: createContentPreview(content),
          detectedViolations: categories.slurs,
          automated: true
        });

        // Immediate mute (bypasses warning ladder)
        if (autoMuteSettings.enabled && user.moderation.autoMuteEnabled) {
          user.moderation.isMuted = true;
          user.moderation.muteExpires = new Date(Date.now() + muteDuration * 60 * 1000);
          user.moderation.muteReason = 'Slur or hate speech detected (zero tolerance policy)';
          user.moderationHistory.push({
            action: 'mute',
            reason: `Immediate mute for ${muteDuration} minutes - slur offense #${user.moderation.slurViolationCount}`,
            contentType: 'other',
            detectedViolations: [`Slur violations: ${user.moderation.slurViolationCount}`],
            automated: true
          });
        }

        await user.save();

        return res.status(400).json({
          message: warningMessages.slur,
          blockedWords: categories.slurs,
          violationCount: user.moderation.violationCount,
          isMuted: user.moderation.isMuted,
          warningType: 'slur'
        });
      }

      // ─────────────────────────────────────────────────────────────────────────
      // PROFANITY ONLY: Log but do NOT increment violations (Community Guidelines)
      // ─────────────────────────────────────────────────────────────────────────
      if (hasProfanityOnly && !enforcementSettings.profanityTriggersViolation) {
        // Profanity contributes to toxicity score only
        // Allow the content to proceed - profanity is permitted
        // Just calculate toxicity for soft warning
        const toxicityScore = await calculateToxicityScore(content);
        if (toxicityScore > 50) {
          req.toxicityWarning = true;
          user.moderationHistory.push({
            action: 'warning',
            reason: `High toxicity score (${toxicityScore}) with profanity: ${categories.profanity.join(', ')}`,
            contentType,
            contentId,
            contentPreview: createContentPreview(content),
            detectedViolations: [`Toxicity: ${toxicityScore}`, ...categories.profanity],
            automated: true
          });
          await user.save();
        }
        // Allow content through - profanity alone doesn't block
        return next();
      }

      // ─────────────────────────────────────────────────────────────────────────
      // SEXUAL/CUSTOM BLOCKED WORDS: Standard warning ladder with tiered messages
      // ─────────────────────────────────────────────────────────────────────────
      if (hasSexual || hasCustom) {
        const violatingWords = [...categories.sexual, ...categories.custom];
        user.moderation.violationCount += 1;
        user.moderation.lastViolation = new Date();

        // Determine warning tier based on violation count
        const warningTier = getWarningTier(user.moderation.violationCount, autoMuteSettings.violationThreshold);
        const tierMessage = warningTier === 3 ? warningMessages.tier3 :
                           warningTier === 2 ? warningMessages.tier2 :
                           warningMessages.tier1;

        user.moderationHistory.push({
          action: 'warning',
          reason: `Blocked words detected: ${violatingWords.join(', ')} (Tier ${warningTier} warning)`,
          contentType,
          contentId,
          contentPreview: createContentPreview(content),
          detectedViolations: violatingWords,
          automated: true
        });

        // Auto-mute if threshold exceeded (standard ladder)
        const shouldAutoMute = autoMuteSettings.enabled &&
                               user.moderation.autoMuteEnabled &&
                               user.moderation.violationCount >= autoMuteSettings.violationThreshold;

        if (shouldAutoMute) {
          const muteDuration = Math.min(
            user.moderation.violationCount * autoMuteSettings.minutesPerViolation,
            autoMuteSettings.maxMuteDuration
          );
          user.moderation.isMuted = true;
          user.moderation.muteExpires = new Date(Date.now() + muteDuration * 60 * 1000);
          user.moderation.muteReason = 'Repeated violations of community guidelines';
          user.moderationHistory.push({
            action: 'mute',
            reason: `Auto-muted for ${muteDuration} minutes due to ${user.moderation.violationCount} violations`,
            contentType: 'other',
            detectedViolations: [`Total violations: ${user.moderation.violationCount}`],
            automated: true
          });
        }

        await user.save();

        return res.status(400).json({
          message: tierMessage,
          blockedWords: violatingWords,
          violationCount: user.moderation.violationCount,
          warningTier,
          warningType: 'speech',
          isMuted: user.moderation.isMuted || false
        });
      }

      // ─────────────────────────────────────────────────────────────────────────
      // SPAM WORDS (from blockedWords.spam): Separate track
      // ─────────────────────────────────────────────────────────────────────────
      if (hasSpamWords) {
        // Uses spam violation track, not speech violations
        user.moderation.spamViolationCount = (user.moderation.spamViolationCount || 0) + 1;
        user.moderation.lastViolation = new Date();

        user.moderationHistory.push({
          action: 'spam-detected',
          reason: `Spam keywords detected: ${categories.spam.join(', ')}`,
          contentType,
          contentId,
          contentPreview: createContentPreview(content),
          detectedViolations: categories.spam,
          automated: true
        });

        if (autoMuteSettings.enabled && user.moderation.autoMuteEnabled) {
          const muteDuration = autoMuteSettings.spamMuteDuration;
          user.moderation.isMuted = true;
          user.moderation.muteExpires = new Date(Date.now() + muteDuration * 60 * 1000);
          user.moderation.muteReason = 'Spam content detected';
          user.moderationHistory.push({
            action: 'mute',
            reason: `Auto-muted for ${muteDuration} minutes due to spam words`,
            contentType: 'other',
            detectedViolations: [`Spam violations: ${user.moderation.spamViolationCount}`],
            automated: true
          });
        }

        await user.save();

        return res.status(400).json({
          message: warningMessages.spam,
          blockedWords: categories.spam,
          spamViolationCount: user.moderation.spamViolationCount,
          warningType: 'spam',
          isMuted: user.moderation.isMuted || false
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SPAM PATTERN CHECK (separate from blocked words)
    // Uses separate spam violation track
    // ═══════════════════════════════════════════════════════════════════════════
    const { isSpam, reason, matchedText, details } = checkSpam(content);
    if (isSpam) {
      // Spam uses separate violation track from speech violations
      user.moderation.spamViolationCount = (user.moderation.spamViolationCount || 0) + 1;
      user.moderation.lastViolation = new Date();

      const spamViolations = details.length > 0 ? details : [reason];
      if (matchedText && !spamViolations.some(v => v.includes(matchedText))) {
        spamViolations.push(`Matched: "${matchedText}"`);
      }

      user.moderationHistory.push({
        action: 'spam-detected',
        reason: reason,
        contentType,
        contentId,
        contentPreview: createContentPreview(content),
        detectedViolations: spamViolations,
        automated: true
      });

      // Auto-mute for spam (separate duration from speech violations)
      if (autoMuteSettings.enabled && user.moderation.autoMuteEnabled) {
        const muteDuration = autoMuteSettings.spamMuteDuration;
        user.moderation.isMuted = true;
        user.moderation.muteExpires = new Date(Date.now() + muteDuration * 60 * 1000);
        user.moderation.muteReason = 'Spam content detected';
        user.moderationHistory.push({
          action: 'mute',
          reason: `Auto-muted for ${muteDuration} minutes due to spam: ${reason}`,
          contentType: 'other',
          detectedViolations: [`Spam trigger: ${reason}`],
          automated: true
        });
      }

      await user.save();

      return res.status(400).json({
        message: warningMessages.spam,
        reason: reason,
        matchedText: matchedText,
        spamViolationCount: user.moderation.spamViolationCount,
        warningType: 'spam',
        isMuted: user.moderation.isMuted || false
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TOXICITY SCORE (soft warnings only - NEVER auto-mute/ban)
    // Uses configurable warningThreshold from settings
    // ═══════════════════════════════════════════════════════════════════════════
    const toxicityScore = await calculateToxicityScore(content);
    const toxicityThreshold = autoMuteSettings.warningThreshold || 65;
    if (toxicityScore > toxicityThreshold) {
      // Log for moderator review prioritisation
      user.moderationHistory.push({
        action: 'warning',
        reason: `High toxicity score: ${toxicityScore} (threshold: ${toxicityThreshold})`,
        contentType,
        contentId,
        contentPreview: createContentPreview(content),
        detectedViolations: [`Toxicity score: ${toxicityScore}`],
        automated: true
      });
      await user.save();

      // Set warning flag for user-facing soft warning
      // IMPORTANT: This MUST NOT trigger auto-mute or auto-ban
      req.toxicityWarning = true;
    }

    next();
  } catch (error) {
    logger.error('Moderate content error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

