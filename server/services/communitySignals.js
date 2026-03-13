/**
 * Community Signals Service
 *
 * Generates lightweight community activity signals that surface real
 * platform activity in the feed — making the platform feel alive even
 * with low posting volume.
 *
 * Signals are stored as FeedEntry documents with type: 'community_signal'
 * and userId: null (global — shown to all users).
 *
 * Spam prevention: max 1 signal per signalType per hour.
 */

import FeedEntry from '../models/FeedEntry.js';
import logger from '../utils/logger.js';

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Check whether a signal of the given type was already emitted in the last hour.
 * Prevents the same signal type from firing more than once per hour.
 *
 * @param {string} signalType
 * @returns {Promise<boolean>} true if a recent signal already exists
 */
const recentSignalExists = async (signalType) => {
  const since = new Date(Date.now() - ONE_HOUR_MS);
  const existing = await FeedEntry.findOne({
    type: 'community_signal',
    signalType,
    createdAt: { $gte: since }
  }).lean();
  return Boolean(existing);
};

/**
 * Insert a community signal entry.
 *
 * @param {string} signalType
 * @param {Object} signalData  - Payload rendered in the frontend card
 * @returns {Promise<Object|null>} Created FeedEntry or null if deduped
 */
const insertSignal = async (signalType, signalData) => {
  if (await recentSignalExists(signalType)) {
    logger.debug(`[CommunitySignals] Deduped ${signalType} signal (already fired in last hour)`);
    return null;
  }

  const entry = await FeedEntry.create({
    userId: null,
    postId: null,
    type: 'community_signal',
    signalType,
    signalData,
    score: 0,
    createdAt: new Date()
  });

  logger.info(`[CommunitySignals] Created ${signalType} signal`, signalData);
  return entry;
};

/**
 * Fire when a new user completes signup.
 *
 * @param {Object} user  - Mongoose User document (or plain object with _id, username, displayName)
 */
export const createNewMemberSignal = async (user) => {
  return insertSignal('new_member', {
    userId: user._id?.toString(),
    username: user.username,
    displayName: user.displayName || user.username
  });
};

/**
 * Fire when a post accumulates 5+ replies in the last hour.
 *
 * @param {string|ObjectId} postId
 * @param {number}          replyCount  - Current replies in the last hour
 */
export const createReplySpikeSignal = async (postId, replyCount) => {
  return insertSignal('reply_spike', {
    postId: postId?.toString(),
    replyCount
  });
};

/**
 * Fire when a non-group post accumulates multiple comments (active journaling thread).
 *
 * @param {string|ObjectId} postId
 * @param {string}          [postContent]  - First 80 chars of post content for the card
 */
export const createActiveJournalSignal = async (postId, postContent) => {
  return insertSignal('active_journal', {
    postId: postId?.toString(),
    preview: postContent ? postContent.slice(0, 80) : null
  });
};

/**
 * Fire when a new post is created inside a group.
 *
 * @param {string|ObjectId} groupId
 * @param {string}          groupName
 */
export const createGroupDiscussionSignal = async (groupId, groupName) => {
  return insertSignal('group_discussion', {
    groupId: groupId?.toString(),
    groupName
  });
};

export default {
  createNewMemberSignal,
  createReplySpikeSignal,
  createActiveJournalSignal,
  createGroupDiscussionSignal
};
