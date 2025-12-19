/**
 * Block Helper Utilities
 * 
 * Centralized blocking logic using Block model as single source of truth.
 * Replaces duplicate User.blockedUsers array system.
 */

import Block from '../models/Block.js';
import logger from './logger.js';

/**
 * Check if two users have blocked each other (bidirectional check)
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @returns {Promise<boolean>} - True if either user has blocked the other
 */
export const isBlocked = async (userId1, userId2) => {
  try {
    if (!userId1 || !userId2) {
      return false;
    }

    // Convert to strings for comparison
    const id1 = userId1.toString();
    const id2 = userId2.toString();

    // Same user cannot block themselves
    if (id1 === id2) {
      return false;
    }

    // Check if either user has blocked the other (bidirectional)
    const block = await Block.findOne({
      $or: [
        { blocker: id1, blocked: id2 },
        { blocker: id2, blocked: id1 }
      ]
    });

    return !!block;
  } catch (error) {
    logger.error('Error checking block status:', error);
    return false; // Fail open to avoid breaking functionality
  }
};

/**
 * Get all user IDs that have blocked or been blocked by the given user
 * @param {string} userId - User ID to check
 * @returns {Promise<string[]>} - Array of blocked user IDs
 */
export const getBlockedUserIds = async (userId) => {
  try {
    if (!userId) {
      return [];
    }

    const userIdStr = userId.toString();

    // Find all blocks where user is either blocker or blocked
    const blocks = await Block.find({
      $or: [
        { blocker: userIdStr },
        { blocked: userIdStr }
      ]
    }).lean();

    // Extract the "other" user ID from each block
    const blockedIds = new Set();
    blocks.forEach(block => {
      const blockerId = block.blocker.toString();
      const blockedId = block.blocked.toString();
      
      if (blockerId === userIdStr) {
        blockedIds.add(blockedId);
      } else {
        blockedIds.add(blockerId);
      }
    });

    return Array.from(blockedIds);
  } catch (error) {
    logger.error('Error getting blocked user IDs:', error);
    return []; // Fail open to avoid breaking functionality
  }
};

/**
 * Get all users that the given user has blocked (one-directional)
 * @param {string} userId - User ID
 * @returns {Promise<string[]>} - Array of user IDs that this user has blocked
 */
export const getUsersBlockedBy = async (userId) => {
  try {
    if (!userId) {
      return [];
    }

    const blocks = await Block.find({ blocker: userId }).lean();
    return blocks.map(block => block.blocked.toString());
  } catch (error) {
    logger.error('Error getting users blocked by user:', error);
    return [];
  }
};

/**
 * Get all users that have blocked the given user (one-directional)
 * @param {string} userId - User ID
 * @returns {Promise<string[]>} - Array of user IDs that have blocked this user
 */
export const getUsersWhoBlockedUser = async (userId) => {
  try {
    if (!userId) {
      return [];
    }

    const blocks = await Block.find({ blocked: userId }).lean();
    return blocks.map(block => block.blocker.toString());
  } catch (error) {
    logger.error('Error getting users who blocked user:', error);
    return [];
  }
};

/**
 * Filter out blocked users from an array of user IDs
 * @param {string} currentUserId - Current user ID
 * @param {string[]} userIds - Array of user IDs to filter
 * @returns {Promise<string[]>} - Filtered array with blocked users removed
 */
export const filterBlockedUsers = async (currentUserId, userIds) => {
  try {
    if (!currentUserId || !userIds || userIds.length === 0) {
      return userIds || [];
    }

    const blockedIds = await getBlockedUserIds(currentUserId);
    const blockedSet = new Set(blockedIds);

    return userIds.filter(userId => !blockedSet.has(userId.toString()));
  } catch (error) {
    logger.error('Error filtering blocked users:', error);
    return userIds; // Return original array on error
  }
};

/**
 * Check if a user has blocked another user (one-directional)
 * @param {string} blockerId - User who may have blocked
 * @param {string} blockedId - User who may be blocked
 * @returns {Promise<boolean>} - True if blocker has blocked blockedId
 */
export const hasBlocked = async (blockerId, blockedId) => {
  try {
    if (!blockerId || !blockedId) {
      return false;
    }

    const block = await Block.findOne({
      blocker: blockerId,
      blocked: blockedId
    });

    return !!block;
  } catch (error) {
    logger.error('Error checking if user has blocked another:', error);
    return false;
  }
};

