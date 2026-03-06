/**
 * Onboarding Detection Utilities
 * 
 * Identifies first-time users for onboarding prompts.
 * Maintains Pryde's calm onboarding philosophy.
 */

import User from '../models/User.js';

const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000; // 48 hours in ms

/**
 * Check if user is a first-time user (onboarding candidate)
 * 
 * Criteria:
 * - userAccountAge < 48 hours
 * - postCount = 0
 * 
 * @param {string} userId - User ID to check
 * @returns {Promise<{isOnboarding: boolean, userAge: number, postCount: number}>}
 */
export async function checkOnboardingStatus(userId) {
  try {
    const user = await User.findById(userId)
      .select('createdAt')
      .lean();
    
    if (!user) {
      return { isOnboarding: false, userAge: 0, postCount: 0 };
    }
    
    const userAge = Date.now() - new Date(user.createdAt).getTime();
    const isOnboarding = userAge < FORTY_EIGHT_HOURS;
    
    // We don't have postCount here, but frontend can pass it
    return { 
      isOnboarding, 
      userAge: Math.floor(userAge / (1000 * 60 * 60)), // hours
      postCount: null // Will be determined by caller if needed
    };
  } catch (error) {
    console.error('[Onboarding] Error checking status:', error);
    return { isOnboarding: false, userAge: 0, postCount: 0 };
  }
}

/**
 * Get onboarding data for user
 * Combines user age with post count
 * 
 * @param {string} userId - User ID
 * @param {number} postCount - User's post count
 * @returns {Promise<object>}
 */
export async function getOnboardingData(userId, postCount = 0) {
  const { isOnboarding, userAge } = await checkOnboardingStatus(userId);
  
  return {
    isOnboarding: isOnboarding && postCount === 0,
    userAge,
    postCount,
    // Gentle prompts for new users
    prompts: isOnboarding ? [
      "What's something that made you smile today?",
      "Share something small from your day.",
      "Say hello to the community."
    ] : []
  };
}

/**
 * Check if user should see welcome prompt
 * Based on account age only (not post count, to allow gradual onboarding)
 * 
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
export async function shouldShowWelcomePrompt(userId) {
  const { isOnboarding } = await checkOnboardingStatus(userId);
  return isOnboarding;
}

export default {
  checkOnboardingStatus,
  getOnboardingData,
  shouldShowWelcomePrompt
};
