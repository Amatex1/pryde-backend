import User from '../models/User.js';
import Post from '../models/Post.js';
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
import { moderateContentV2 } from '../utils/moderationV2.js';
import logger from '../utils/logger.js';
import {
  legacyEnforcementAllowed,
  logSkippedEnforcement,
  createSkippedEnforcementEvent
} from '../utils/legacyModerationGuard.js';

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
 * Moderate content using PRYDE_MODERATION_V2 (5-layer intent-driven system)
 * Maintains backward compatibility with existing response format
 *
 * CONSTRAINTS:
 * - Layer 1: CLASSIFICATION ONLY - never triggers blocks/mutes/decay
 * - Intent: Categorical (expressive/neutral/disruptive/hostile/dangerous) - not toxicity score
 * - Behavior score outweighs formatting signals
 * - Visibility dampening: Non-punitive, temporary, reversible
 * - Admin override: Full undo/restore/remove history/manual actions
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

    // Get all settings for backward compatibility
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

    // Determine content type and ID
    const contentType = req.body.postId ? 'comment' : 'post';
    const contentId = req.body.postId || null;

    // ═══════════════════════════════════════════════════════════════════════════
    // PRYDE_MODERATION_V2: Use the new 5-layer system
    // ═══════════════════════════════════════════════════════════════════════════

    // Get recent content for behavior analysis (last 10 items from history)
    const recentContent = user.moderationHistory
      .filter(entry => entry.contentPreview && entry.timestamp)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10)
      .map(entry => ({
        content: entry.contentPreview,
        timestamp: entry.timestamp
      }));

    // Call the new moderation system
    const moderationResult = await moderateContentV2(content, req.userId, {
      recentContent,
      userContext: {
        recentHostileContent: user.moderationHistory.some(entry =>
          entry.action === 'hostile-detected' &&
          new Date(entry.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        )
      },
      returnAllLayers: true
    });

    // Log the layer outputs to moderation history
    user.moderationHistory.push({
      action: 'moderation-v2-processed',
      reason: `PRYDE_MODERATION_V2 processed - Action: ${moderationResult.action}`,
      contentType,
      contentId,
      contentPreview: content.length > 200 ? content.substring(0, 197) + '...' : content,
      detectedViolations: [`Intent: ${moderationResult.layer_outputs.layer2.intent_category}`],
      automated: true,
      layer_outputs: moderationResult.layer_outputs
    });

    // Handle different actions from the new system
    switch (moderationResult.action) {
      case 'ALLOW':
        // Content allowed - proceed
        return next();

      case 'ALLOW_WITH_INTERNAL_NOTE':
        // Content allowed but flagged for monitoring
        await user.save();
        return next();

      case 'VISIBILITY_DAMPEN':
        // Temporarily reduce visibility (non-punitive)
        req.visibilityDampened = true;
        req.dampeningDuration = moderationResult.dampening_duration;
        await user.save();
        return next();

      case 'QUEUE_FOR_REVIEW':
        // Queue for human review
        req.queuedForReview = true;
        req.queuePriority = moderationResult.queue_priority;
        await user.save();
        return next();

      case 'TEMP_MUTE':
        // PRYDE_LEGACY_MODERATION_PASSIVE_MODE: Check if legacy enforcement is allowed
        if (!legacyEnforcementAllowed()) {
          // Log the skipped enforcement
          logSkippedEnforcement('temp-mute', moderationResult.reason, {
            userId: req.userId,
            contentType,
            contentId,
            intentCategory: moderationResult.layer_outputs?.layer2?.intent_category
          });

          // Log to user history but mark as skipped
          user.moderationHistory.push(createSkippedEnforcementEvent('temp-mute', moderationResult.reason, {
            contentType,
            contentId,
            contentPreview: content.length > 200 ? content.substring(0, 197) + '...' : content,
            detectedViolations: [`Intent: ${moderationResult.layer_outputs?.layer2?.intent_category || 'unknown'}`]
          }));

          await user.save();
          return next(); // Allow content, V5 will handle enforcement
        }

        // Apply temporary mute (legacy enforcement ACTIVE)
        if (autoMuteSettings.enabled && user.moderation.autoMuteEnabled) {
          const muteDuration = moderationResult.dampening_duration || 30; // Default 30 minutes
          user.moderation.isMuted = true;
          user.moderation.muteExpires = new Date(Date.now() + muteDuration * 60 * 1000);
          user.moderation.muteReason = moderationResult.reason;
          user.moderationHistory.push({
            action: 'mute',
            reason: `Auto-muted for ${muteDuration} minutes - ${moderationResult.reason}`,
            contentType: 'other',
            detectedViolations: [`Intent: ${moderationResult.layer_outputs.layer2.intent_category}`],
            automated: true
          });
          await user.save();

          return res.status(400).json({
            message: warningMessages.tier3, // Use highest tier message
            violationCount: user.moderation.violationCount,
            warningTier: 3,
            warningType: 'intent_violation',
            isMuted: true,
            intentCategory: moderationResult.layer_outputs.layer2.intent_category
          });
        }
        // If auto-mute disabled, still allow content but log
        await user.save();
        return next();

      case 'HARD_BLOCK':
        // PRYDE_LEGACY_MODERATION_PASSIVE_MODE: Check if legacy enforcement is allowed
        if (!legacyEnforcementAllowed()) {
          // Log the skipped enforcement
          logSkippedEnforcement('hard-block', moderationResult.reason, {
            userId: req.userId,
            contentType,
            contentId,
            intentCategory: moderationResult.layer_outputs?.layer2?.intent_category
          });

          // Log to user history but mark as skipped (NO violation count increment)
          user.moderationHistory.push(createSkippedEnforcementEvent('hard-block', moderationResult.reason, {
            contentType,
            contentId,
            contentPreview: content.length > 200 ? content.substring(0, 197) + '...' : content,
            detectedViolations: [`Intent: ${moderationResult.layer_outputs?.layer2?.intent_category || 'unknown'}`]
          }));

          await user.save();
          return next(); // Allow content, V5 will handle enforcement
        }

        // Hard block content (legacy enforcement ACTIVE)
        user.moderation.violationCount += 1;
        user.moderation.lastViolation = new Date();

        user.moderationHistory.push({
          action: 'hard-block',
          reason: moderationResult.reason,
          contentType,
          contentId,
          contentPreview: content.length > 200 ? content.substring(0, 197) + '...' : content,
          detectedViolations: [`Intent: ${moderationResult.layer_outputs.layer2.intent_category}`],
          automated: true
        });

        await user.save();

        return res.status(400).json({
          message: warningMessages.slur, // Use slur message for hard blocks
          violationCount: user.moderation.violationCount,
          warningType: 'hard_block',
          intentCategory: moderationResult.layer_outputs.layer2.intent_category
        });

      default:
        // Unknown action - allow content
        return next();
    }

  } catch (error) {
    logger.error('Moderate content V2 error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * PRYDE_SAFETY_HARDENING_V1: Probation mode enforcement
 *
 * Applies restrictions to users whose probationUntil has not yet expired:
 *   - 3 posts/day maximum (top-level posts only, not comments/replies)
 *   - No external links in post content
 *
 * Attach AFTER checkMuted in the middleware chain for posts and comments.
 * The DM restriction (no DMs unless mutual follow) is enforced at the DM route.
 */
export const checkProbation = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('moderation');

    if (!user?.moderation?.probationUntil) {
      return next();
    }

    // Check if probation has expired
    if (new Date() >= user.moderation.probationUntil) {
      return next();
    }

    const probationExpiresIn = Math.ceil(
      (user.moderation.probationUntil - Date.now()) / (1000 * 60 * 60)
    );

    // Determine if this is a top-level post (not a comment or reply)
    const isTopLevelPost = !req.params.id && !req.body.postId;

    if (isTopLevelPost) {
      // Enforce 3 posts/day limit during probation
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const todayPostCount = await Post.countDocuments({
        author: req.userId,
        createdAt: { $gte: startOfDay }
      });

      if (todayPostCount >= 3) {
        return res.status(429).json({
          message: 'You can post a maximum of 3 times per day during your account probation period.',
          probationExpiresIn: `${probationExpiresIn} hours`,
          reason: 'probation_post_limit'
        });
      }

      // Block external links during probation
      const content = req.body.content || req.body.text || '';
      if (/https?:\/\/[^\s]+/i.test(content)) {
        return res.status(400).json({
          message: 'Sharing external links is not allowed during your account probation period.',
          probationExpiresIn: `${probationExpiresIn} hours`,
          reason: 'probation_link_restriction'
        });
      }
    }

    next();
  } catch (error) {
    logger.error('checkProbation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

