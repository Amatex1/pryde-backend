/**
 * Trust Score Calculator
 * 
 * Calculates user trust scores (0-100) based on various signals.
 * Used for content prioritization and moderation decisions.
 */

import User from '../models/User.js';
import logger from './logger.js';

// Trust score weights
const WEIGHTS = {
  // Account age (older = more trusted)
  accountAge: 0.15,
  
  // Verification status
  emailVerified: 0.10,
  ageVerified: 0.05,
  
  // Activity signals
  followerCount: 0.10,
  postCount: 0.10,
  
  // Behavior signals (positive)
  behaviorScore: 0.15,
  trusted: 0.05,
  
  // Behavior signals (negative)
  violationCount: 0.10,
  spamViolationCount: 0.05,
  slurViolationCount: 0.05,
  
  // Moderation signals
  moderationHistory: 0.05,
  onWatchlist: -0.05
};

/**
 * Calculate trust score for a user
 * @param {Object} user - User document
 * @returns {Promise<number>} Trust score (0-100)
 */
export const calculateTrustScore = async (user) => {
  try {
    let score = 50; // Start at neutral
    
    const userObj = user.toObject ? user.toObject() : user;
    
    // 1. Account age (0-15 points)
    if (userObj.createdAt) {
      const accountAgeDays = (Date.now() - new Date(userObj.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      // Max points at 365 days
      const agePoints = Math.min(15, (accountAgeDays / 365) * 15);
      score += agePoints * WEIGHTS.accountAge;
    }
    
    // 2. Email verification (+10 points)
    if (userObj.emailVerified) {
      score += 10 * WEIGHTS.emailVerified;
    }
    
    // 3. Age verification (+5 points)
    if (userObj.ageVerified) {
      score += 5 * WEIGHTS.ageVerified;
    }
    
    // 4. Follower count (0-10 points)
    const followerCount = userObj.followers?.length || 0;
    const followerPoints = Math.min(10, Math.log10(followerCount + 1) * 5);
    score += followerPoints * WEIGHTS.followerCount;
    
    // 5. Post count estimate from moderation history (0-10 points)
    const postCount = userObj.moderationHistory?.filter(h => h.contentType === 'post').length || 0;
    const postPoints = Math.min(10, Math.log10(postCount + 1) * 3);
    score += postPoints * WEIGHTS.postCount;
    
    // 6. Behavior score (0-15 points based on 0-100 scale)
    const behaviorScore = userObj.moderation?.behaviorScore || 100;
    score += (behaviorScore / 100) * 15 * WEIGHTS.behaviorScore;
    
    // 7. Trusted status (+5 points)
    if (userObj.moderation?.trusted) {
      score += 5 * WEIGHTS.trusted;
    }
    
    // 8. Violation counts (negative)
    const violations = userObj.moderation?.violationCount || 0;
    const spamViolations = userObj.moderation?.spamViolationCount || 0;
    const slurViolations = userObj.moderation?.slurViolationCount || 0;
    
    score -= Math.min(10, violations) * WEIGHTS.violationCount * 2;
    score -= Math.min(5, spamViolations) * WEIGHTS.spamViolationCount * 2;
    score -= Math.min(5, slurViolations) * WEIGHTS.slurViolationCount * 2;
    
    // 9. Moderation history length (small positive for active users)
    const modHistoryCount = userObj.moderationHistory?.length || 0;
    score += Math.min(5, modHistoryCount * 0.1) * WEIGHTS.moderationHistory;
    
    // 10. Watchlist status (negative)
    if (userObj.moderation?.onWatchlist) {
      score += 5 * WEIGHTS.onWatchlist; // Negative weight
    }
    
    // Clamp score between 0 and 100
    score = Math.max(0, Math.min(100, Math.round(score)));
    
    return score;
  } catch (error) {
    logger.error('[TrustScore] Calculation error:', error.message);
    return 50; // Return neutral on error
  }
};

/**
 * Update trust score for a user and save to database
 * @param {string} userId - User ID
 * @returns {Promise<number>} New trust score
 */
export const updateUserTrustScore = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      logger.warn(`[TrustScore] User not found: ${userId}`);
      return null;
    }
    
    const newScore = await calculateTrustScore(user);
    
    await User.updateOne(
      { _id: userId },
      { 
        $set: { 
          trustScore: newScore,
          trustScoreLastUpdated: new Date()
        }
      }
    );
    
    logger.info(`[TrustScore] Updated user ${userId}: ${newScore}`);
    return newScore;
  } catch (error) {
    logger.error('[TrustScore] Update error:', error.message);
    return null;
  }
};

/**
 * Batch update trust scores for all users
 * @param {Object} options - Options for batch update
 * @returns {Promise<Object>} Results
 */
export const batchUpdateTrustScores = async (options = {}) => {
  const { limit = 100, dryRun = false } = options;
  
  try {
    // Find users who need updates (not updated in last 24 hours or never)
    const users = await User.find({
      $or: [
        { trustScoreLastUpdated: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        { trustScoreLastUpdated: null }
      ],
      isBanned: false,
      isDeleted: false
    })
    .select('_id username trustScore createdAt emailVerified ageVerified followers moderation moderationHistory')
    .limit(limit);
    
    logger.info(`[TrustScore] Batch processing ${users.length} users`);
    
    let updated = 0;
    let failed = 0;
    
    for (const user of users) {
      try {
        const newScore = await calculateTrustScore(user);
        
        if (!dryRun) {
          await User.updateOne(
            { _id: user._id },
            { 
              $set: { 
                trustScore: newScore,
                trustScoreLastUpdated: new Date()
              }
            }
          );
        }
        
        updated++;
      } catch (err) {
        logger.error(`[TrustScore] Failed to update user ${user._id}:`, err.message);
        failed++;
      }
    }
    
    return { processed: users.length, updated, failed };
  } catch (error) {
    logger.error('[TrustScore] Batch update error:', error.message);
    return { error: error.message };
  }
};

/**
 * Get trust level label
 * @param {number} score - Trust score
 * @returns {string} Trust level
 */
export const getTrustLevel = (score) => {
  if (score >= 80) return 'trusted';
  if (score >= 60) return 'regular';
  if (score >= 40) return 'new';
  if (score >= 20) return 'caution';
  return 'restricted';
};

export default {
  calculateTrustScore,
  updateUserTrustScore,
  batchUpdateTrustScores,
  getTrustLevel,
  WEIGHTS
};
