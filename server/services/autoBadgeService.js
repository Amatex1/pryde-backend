/**
 * Automatic Badge Service
 * 
 * System-assigned badges based on factual criteria.
 * No popularity, ranking, or engagement-based badges allowed.
 * 
 * Supported automatic badges:
 * - early_member: Joined before public launch
 * - founding_member: Joined during beta
 * - profile_complete: All core profile fields filled
 * - active_this_month: Low activity threshold in last 30 days
 * - group_organizer: Owns at least one group
 */

import Badge from '../models/Badge.js';
import BadgeAssignmentLog from '../models/BadgeAssignmentLog.js';
import User from '../models/User.js';
import Group from '../models/Group.js';
import Post from '../models/Post.js';
import logger from '../utils/logger.js';

// Configuration for automatic badges
const AUTO_BADGE_CONFIG = {
  early_member: {
    // Users who joined before this date get the badge
    cutoffDate: new Date('2025-01-15T00:00:00Z'), // Adjust to actual launch date
    description: 'Joined before public launch'
  },
  founding_member: {
    // Users who joined during beta period
    startDate: new Date('2024-12-01T00:00:00Z'),
    endDate: new Date('2025-01-15T00:00:00Z'),
    description: 'Joined during beta'
  },
  profile_complete: {
    // Required fields for profile completion
    requiredFields: ['displayName', 'bio', 'profilePhoto', 'pronouns'],
    description: 'All core profile fields filled'
  },
  active_this_month: {
    // Minimum posts/comments in last 30 days (low threshold - not engagement-based)
    minActivity: 1, // Just 1 post or comment
    periodDays: 30,
    // 🔧 CHURN FIX: Grace period before revocation (prevents flapping)
    gracePeriodDays: 7,
    description: 'Active in the last 30 days'
  },
  group_organizer: {
    // Owns at least one group
    minGroups: 1,
    description: 'Owns at least one group'
  }
};

// 🔧 CHURN FIX: Badges that should only be assigned (never auto-revoked)
// Revocation for these badges happens only in the daily sweep job with grace period
const ASSIGN_ONLY_BADGES = ['active_this_month'];

// Helper: Calculate days since a date
function daysSince(date) {
  return (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Check if a user qualifies for the early_member badge
 */
async function checkEarlyMember(user) {
  const config = AUTO_BADGE_CONFIG.early_member;
  return new Date(user.createdAt) < config.cutoffDate;
}

/**
 * Check if a user qualifies for the founding_member badge
 */
async function checkFoundingMember(user) {
  const config = AUTO_BADGE_CONFIG.founding_member;
  const joinDate = new Date(user.createdAt);
  return joinDate >= config.startDate && joinDate < config.endDate;
}

/**
 * Check if a user qualifies for the profile_complete badge
 */
async function checkProfileComplete(user) {
  const config = AUTO_BADGE_CONFIG.profile_complete;
  
  for (const field of config.requiredFields) {
    const value = user[field];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return false;
    }
  }
  
  return true;
}

/**
 * Check if a user qualifies for the active_this_month badge
 */
async function checkActiveThisMonth(user) {
  const config = AUTO_BADGE_CONFIG.active_this_month;
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - config.periodDays);
  
  // Count posts in the period
  const postCount = await Post.countDocuments({
    author: user._id,
    createdAt: { $gte: periodStart },
    isDeleted: { $ne: true }
  });
  
  return postCount >= config.minActivity;
}

/**
 * Check if a user qualifies for the group_organizer badge
 */
async function checkGroupOrganizer(user) {
  const config = AUTO_BADGE_CONFIG.group_organizer;
  
  const groupCount = await Group.countDocuments({
    owner: user._id,
    isDeleted: { $ne: true }
  });
  
  return groupCount >= config.minGroups;
}

// Map of badge IDs to their check functions
const BADGE_CHECKS = {
  early_member: checkEarlyMember,
  founding_member: checkFoundingMember,
  profile_complete: checkProfileComplete,
  active_this_month: checkActiveThisMonth,
  group_organizer: checkGroupOrganizer
};

/**
 * Process automatic badges for a single user
 * @param {Object} user - User document
 * @param {Array} autoBadges - List of automatic badge definitions
 * @param {Object} options - Processing options
 * @param {boolean} options.assignOnly - If true, only assign badges, never revoke (default: false)
 * @param {boolean} options.withGracePeriod - If true, check grace period before revocation (default: false)
 * @returns {Object} Results of badge processing
 */
async function processUserBadges(user, autoBadges, options = {}) {
  const { assignOnly = false, withGracePeriod = false } = options;
  const results = { assigned: [], revoked: [], unchanged: [], skipped: [] };

  for (const badge of autoBadges) {
    const checkFn = BADGE_CHECKS[badge.automaticRule];
    if (!checkFn) continue;

    const qualifies = await checkFn(user);
    const hasBadge = user.badges.includes(badge.id);
    const isAssignOnlyBadge = ASSIGN_ONLY_BADGES.includes(badge.id);

    if (qualifies && !hasBadge) {
      // Assign badge
      await User.findByIdAndUpdate(user._id, { $addToSet: { badges: badge.id } });
      await BadgeAssignmentLog.create({
        userId: user._id,
        username: user.username,
        badgeId: badge.id,
        badgeLabel: badge.label,
        action: 'assigned',
        isAutomatic: true,
        automaticRule: badge.automaticRule
      });
      results.assigned.push(badge.id);
    } else if (!qualifies && hasBadge) {
      // 🔧 CHURN FIX: Skip revocation for assign-only badges during normal processing
      // These will be revoked only by the daily sweep job with grace period
      if (assignOnly || isAssignOnlyBadge) {
        results.skipped.push(badge.id);
        continue;
      }

      // 🔧 CHURN FIX: Check grace period before revocation
      if (withGracePeriod && badge.automaticRule === 'active_this_month') {
        const gracePeriodDays = AUTO_BADGE_CONFIG.active_this_month.gracePeriodDays || 7;
        const lastAssignment = await BadgeAssignmentLog.findOne({
          userId: user._id,
          badgeId: badge.id,
          action: 'assigned'
        }).sort({ createdAt: -1 }).lean();

        if (lastAssignment) {
          const daysSinceAssignment = daysSince(lastAssignment.createdAt);
          const totalWindowDays = AUTO_BADGE_CONFIG.active_this_month.periodDays + gracePeriodDays;

          if (daysSinceAssignment < totalWindowDays) {
            // Still within grace period, skip revocation
            results.skipped.push(badge.id);
            logger.debug(`[Badge] Skipping revocation for ${badge.id} - grace period (${daysSinceAssignment.toFixed(1)} days < ${totalWindowDays} days)`);
            continue;
          }
        }
      }

      // Revoke badge (user no longer qualifies and grace period expired)
      await User.findByIdAndUpdate(user._id, { $pull: { badges: badge.id } });
      await BadgeAssignmentLog.create({
        userId: user._id,
        username: user.username,
        badgeId: badge.id,
        badgeLabel: badge.label,
        action: 'revoked',
        isAutomatic: true,
        automaticRule: badge.automaticRule
      });
      results.revoked.push(badge.id);
    } else {
      results.unchanged.push(badge.id);
    }
  }

  return results;
}

/**
 * Process automatic badges for a single user by ID
 * @param {string} userId - User ID
 * @returns {Object} Results of badge processing
 */
async function processUserBadgesById(userId) {
  try {
    const user = await User.findById(userId).lean();
    if (!user) {
      return { error: 'User not found' };
    }

    const autoBadges = await Badge.find({
      assignmentType: 'automatic',
      isActive: true
    }).lean();

    return await processUserBadges(user, autoBadges);
  } catch (error) {
    logger.error('Error processing user badges:', error);
    return { error: error.message };
  }
}

/**
 * Run automatic badge processing for all users (batch job)
 * @param {Object} options - Processing options
 * @returns {Object} Summary of batch processing
 */
async function runBatchBadgeProcessing(options = {}) {
  const { batchSize = 100, dryRun = false } = options;
  const summary = {
    usersProcessed: 0,
    badgesAssigned: 0,
    badgesRevoked: 0,
    errors: 0,
    startedAt: new Date(),
    completedAt: null
  };

  try {
    const autoBadges = await Badge.find({
      assignmentType: 'automatic',
      isActive: true
    }).lean();

    if (autoBadges.length === 0) {
      logger.info('No automatic badges configured');
      summary.completedAt = new Date();
      return summary;
    }

    logger.info(`Starting batch badge processing with ${autoBadges.length} automatic badges`);

    // Process users in batches
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const users = await User.find({
        isActive: true,
        isBanned: false
      })
        .select('_id username badges createdAt displayName bio profilePhoto pronouns')
        .skip(skip)
        .limit(batchSize)
        .lean();

      if (users.length === 0) {
        hasMore = false;
        break;
      }

      for (const user of users) {
        try {
          if (!dryRun) {
            const results = await processUserBadges(user, autoBadges);
            summary.badgesAssigned += results.assigned.length;
            summary.badgesRevoked += results.revoked.length;
          }
          summary.usersProcessed++;
        } catch (error) {
          logger.error(`Error processing badges for user ${user.username}:`, error);
          summary.errors++;
        }
      }

      skip += batchSize;

      // Log progress
      if (summary.usersProcessed % 500 === 0) {
        logger.info(`Processed ${summary.usersProcessed} users...`);
      }
    }

    summary.completedAt = new Date();
    logger.info(`Batch badge processing complete: ${summary.usersProcessed} users, ${summary.badgesAssigned} assigned, ${summary.badgesRevoked} revoked`);

    return summary;
  } catch (error) {
    logger.error('Batch badge processing error:', error);
    summary.errors++;
    summary.completedAt = new Date();
    return summary;
  }
}

/**
 * Seed the default automatic badges
 */
async function seedAutomaticBadges() {
  const defaultBadges = [
    {
      id: 'early_member',
      label: 'Early Member',
      type: 'activity',
      assignmentType: 'automatic',
      automaticRule: 'early_member',
      icon: '🌟',
      tooltip: 'Joined before public launch',
      description: 'This member joined Pryde before our public launch. Early members helped shape the platform.',
      priority: 10,
      color: 'gold'
    },
    {
      id: 'founding_member',
      label: 'Founding Member',
      type: 'activity',
      assignmentType: 'automatic',
      automaticRule: 'founding_member',
      icon: '🏛️',
      tooltip: 'Joined during beta',
      description: 'This member joined during our beta period and helped test and improve the platform.',
      priority: 5,
      color: 'purple'
    },
    {
      id: 'profile_complete',
      label: 'Profile Complete',
      type: 'activity',
      assignmentType: 'automatic',
      automaticRule: 'profile_complete',
      icon: '✨',
      tooltip: 'Completed their profile',
      description: 'This member has filled out all core profile fields.',
      priority: 50,
      color: 'green'
    },
    {
      id: 'active_this_month',
      label: 'Active This Month',
      type: 'activity',
      assignmentType: 'automatic',
      automaticRule: 'active_this_month',
      icon: '💫',
      tooltip: 'Active in the community',
      description: 'This member has been active in the last 30 days.',
      priority: 60,
      color: 'blue'
    },
    {
      id: 'group_organizer',
      label: 'Group Organizer',
      type: 'community',
      assignmentType: 'automatic',
      automaticRule: 'group_organizer',
      icon: '👥',
      tooltip: 'Organizes a community group',
      description: 'This member owns and organizes at least one community group.',
      priority: 30,
      color: 'teal'
    }
  ];

  let created = 0;
  let existing = 0;

  for (const badgeData of defaultBadges) {
    const exists = await Badge.findOne({ id: badgeData.id });
    if (!exists) {
      await Badge.create(badgeData);
      created++;
      logger.info(`Created automatic badge: ${badgeData.id}`);
    } else {
      existing++;
    }
  }

  return { created, existing };
}

/**
 * 🔧 CHURN FIX: Daily badge sweep with grace period
 * Only revokes badges that have been unqualified for longer than the grace period
 * This prevents badge flapping for active_this_month and similar badges
 * @param {Object} options - Processing options
 * @returns {Object} Summary of sweep processing
 */
async function runDailyBadgeSweep(options = {}) {
  const { batchSize = 100, dryRun = false } = options;
  const summary = {
    usersProcessed: 0,
    badgesRevoked: 0,
    badgesSkipped: 0,
    errors: 0,
    startedAt: new Date(),
    completedAt: null
  };

  try {
    // Only process badges that can be revoked (not the permanent ones)
    const revocableBadges = await Badge.find({
      assignmentType: 'automatic',
      isActive: true,
      id: { $in: ASSIGN_ONLY_BADGES } // Only process badges that need grace period checking
    }).lean();

    if (revocableBadges.length === 0) {
      logger.info('[DailySweep] No revocable badges configured');
      summary.completedAt = new Date();
      return summary;
    }

    logger.info(`[DailySweep] Starting daily badge sweep for ${revocableBadges.length} badge types`);

    // Find users who have any of these badges
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const users = await User.find({
        isActive: true,
        isBanned: false,
        badges: { $in: ASSIGN_ONLY_BADGES }
      })
        .select('_id username badges createdAt displayName bio profilePhoto pronouns')
        .skip(skip)
        .limit(batchSize)
        .lean();

      if (users.length === 0) {
        hasMore = false;
        break;
      }

      for (const user of users) {
        try {
          if (!dryRun) {
            // Process with grace period checking enabled
            const results = await processUserBadges(user, revocableBadges, { withGracePeriod: true });
            summary.badgesRevoked += results.revoked.length;
            summary.badgesSkipped += results.skipped.length;
          }
          summary.usersProcessed++;
        } catch (error) {
          logger.error(`[DailySweep] Error processing badges for user ${user.username}:`, error);
          summary.errors++;
        }
      }

      skip += batchSize;

      // Log progress
      if (summary.usersProcessed % 500 === 0) {
        logger.info(`[DailySweep] Processed ${summary.usersProcessed} users...`);
      }
    }

    summary.completedAt = new Date();
    logger.info(`[DailySweep] Complete: ${summary.usersProcessed} users, ${summary.badgesRevoked} revoked, ${summary.badgesSkipped} skipped (in grace period)`);

    return summary;
  } catch (error) {
    logger.error('[DailySweep] Error:', error);
    summary.errors++;
    summary.completedAt = new Date();
    return summary;
  }
}

export {
  processUserBadges,
  processUserBadgesById,
  runBatchBadgeProcessing,
  runDailyBadgeSweep,
  seedAutomaticBadges,
  BADGE_CHECKS,
  AUTO_BADGE_CONFIG,
  ASSIGN_ONLY_BADGES
};

