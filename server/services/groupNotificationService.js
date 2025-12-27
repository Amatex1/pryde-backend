/**
 * PHASE 4B: Group Notification Service
 *
 * Calm, opt-in notifications for group activity.
 * Respects Quiet Mode and user preferences.
 *
 * PRINCIPLES:
 * - Nothing is on by default
 * - Users choose what they hear about
 * - No real-time spam
 * - No algorithmic urgency
 */

import mongoose from 'mongoose';
import User from '../models/User.js';
import Group from '../models/Group.js';
import Notification from '../models/Notification.js';
import { isGroupMember } from '../utils/groupPermissions.js';
import logger from '../utils/logger.js';

/**
 * Extract @mentions from post content
 * @param {String} content - Post content
 * @returns {String[]} Array of usernames mentioned
 */
export function extractMentions(content) {
  if (!content) return [];
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;
  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1].toLowerCase());
  }
  return [...new Set(mentions)]; // Dedupe
}

/**
 * Check if user should receive notifications (respects Quiet Mode)
 * @param {Object} user - User document
 * @returns {Boolean} Whether notifications should be sent
 */
export function shouldReceiveNotifications(user) {
  if (!user) return false;

  // Check Quiet Mode
  if (user.privacySettings?.quietModeEnabled) {
    return false;
  }

  // Check if user is active and not banned/muted
  if (!user.isActive || user.isBanned || user.isMuted) {
    return false;
  }

  return true;
}

/**
 * Get user's notification settings for a specific group
 * @param {Object} user - User document
 * @param {String} groupId - Group ID
 * @returns {Object} Notification settings { notifyOnNewPost, notifyOnMention }
 */
export function getGroupNotificationSettings(user, groupId) {
  const defaults = { notifyOnNewPost: false, notifyOnMention: true };

  if (!user?.groupNotificationSettings) return defaults;

  const settings = user.groupNotificationSettings.find(
    s => s.groupId?.toString() === groupId?.toString()
  );

  return settings || defaults;
}

/**
 * Notify group members about a new post (opt-in only)
 * @param {Object} options
 * @param {Object} options.post - The new post
 * @param {Object} options.group - The group
 * @param {Object} options.author - The post author
 * @param {Object} options.io - Socket.IO instance (optional)
 */
export async function notifyNewGroupPost({ post, group, author, io }) {
  try {
    const groupId = group._id.toString();
    const authorId = author._id.toString();

    // Get all group members (owner + moderators + members)
    const allMemberIds = [
      group.owner?.toString(),
      ...(group.moderators || []).map(m => m.toString()),
      ...(group.members || []).map(m => m.toString())
    ].filter(id => id && id !== authorId); // Exclude author

    if (allMemberIds.length === 0) return;

    // Fetch users with their notification settings
    const users = await User.find({
      _id: { $in: allMemberIds },
      isActive: true,
      isBanned: { $ne: true },
      isMuted: { $ne: true }
    }).select('_id privacySettings groupNotificationSettings blockedUsers');

    const notificationsToCreate = [];

    for (const user of users) {
      // Skip if user blocked the author
      if (user.blockedUsers?.some(b => b.toString() === authorId)) continue;

      // Skip if user is in Quiet Mode
      if (!shouldReceiveNotifications(user)) continue;

      // Get user's settings for this group
      const settings = getGroupNotificationSettings(user, groupId);

      // Only notify if user opted in to new post notifications
      if (!settings.notifyOnNewPost) continue;

      notificationsToCreate.push({
        recipient: user._id,
        sender: author._id,
        type: 'group_post',
        message: `New post in ${group.name}`,
        groupId: group._id,
        groupSlug: group.slug,
        groupName: group.name,
        postId: post._id,
        link: `/groups/${group.slug}`
      });
    }

    if (notificationsToCreate.length > 0) {
      await Notification.insertMany(notificationsToCreate);
      logger.info('Group new post notifications created', {
        groupId,
        postId: post._id.toString(),
        recipientCount: notificationsToCreate.length
      });
    }
  } catch (error) {
    logger.error('Error creating group post notifications', { error: error.message });
  }
}

/**
 * Notify mentioned users in a group post
 * @param {Object} options
 * @param {Object} options.post - The new post
 * @param {Object} options.group - The group
 * @param {Object} options.author - The post author
 * @param {String[]} options.mentionedUsernames - Array of usernames mentioned
 * @param {Object} options.io - Socket.IO instance (optional)
 */
export async function notifyGroupMentions({ post, group, author, mentionedUsernames, io }) {
  try {
    if (!mentionedUsernames || mentionedUsernames.length === 0) return;

    const groupId = group._id.toString();
    const authorId = author._id.toString();

    // Find mentioned users who are group members
    const mentionedUsers = await User.find({
      username: { $in: mentionedUsernames.map(u => new RegExp(`^${u}$`, 'i')) },
      isActive: true,
      isBanned: { $ne: true },
      isMuted: { $ne: true }
    }).select('_id username privacySettings groupNotificationSettings blockedUsers');

    const notificationsToCreate = [];

    for (const user of mentionedUsers) {
      // Don't notify self
      if (user._id.toString() === authorId) continue;

      // Skip if user blocked the author
      if (user.blockedUsers?.some(b => b.toString() === authorId)) continue;

      // Skip if user is in Quiet Mode
      if (!shouldReceiveNotifications(user)) continue;

      // Check if user is a group member
      if (!isGroupMember(user._id, group)) continue;

      // Get user's settings for this group
      const settings = getGroupNotificationSettings(user, groupId);

      // Only notify if user has mention notifications enabled
      if (!settings.notifyOnMention) continue;

      notificationsToCreate.push({
        recipient: user._id,
        sender: author._id,
        type: 'group_mention',
        message: `${author.displayName || author.username} mentioned you in ${group.name}`,
        groupId: group._id,
        groupSlug: group.slug,
        groupName: group.name,
        postId: post._id,
        link: `/groups/${group.slug}`
      });
    }

    if (notificationsToCreate.length > 0) {
      await Notification.insertMany(notificationsToCreate);
      logger.info('Group mention notifications created', {
        groupId,
        postId: post._id.toString(),
        recipientCount: notificationsToCreate.length
      });
    }
  } catch (error) {
    logger.error('Error creating group mention notifications', { error: error.message });
  }
}

/**
 * Process notifications for a new group post
 * Handles both new post notifications and mentions
 * @param {Object} options
 * @param {Object} options.post - The new post
 * @param {Object} options.group - The group
 * @param {Object} options.author - The post author
 * @param {Object} options.io - Socket.IO instance (optional)
 */
export async function processGroupPostNotifications({ post, group, author, io }) {
  // Extract mentions from post content
  const mentionedUsernames = extractMentions(post.content);

  // Run both notification types in parallel
  await Promise.all([
    notifyNewGroupPost({ post, group, author, io }),
    notifyGroupMentions({ post, group, author, mentionedUsernames, io })
  ]);
}

/**
 * Update user's group notification settings
 * @param {String} userId - User ID
 * @param {String} groupId - Group ID
 * @param {Object} settings - { notifyOnNewPost, notifyOnMention }
 */
export async function updateGroupNotificationSettings(userId, groupId, settings) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  // Initialize array if not exists
  if (!user.groupNotificationSettings) {
    user.groupNotificationSettings = [];
  }

  // Find existing settings for this group
  const existingIndex = user.groupNotificationSettings.findIndex(
    s => s.groupId?.toString() === groupId.toString()
  );

  if (existingIndex >= 0) {
    // Update existing settings
    if (settings.notifyOnNewPost !== undefined) {
      user.groupNotificationSettings[existingIndex].notifyOnNewPost = settings.notifyOnNewPost;
    }
    if (settings.notifyOnMention !== undefined) {
      user.groupNotificationSettings[existingIndex].notifyOnMention = settings.notifyOnMention;
    }
  } else {
    // Add new settings for this group
    user.groupNotificationSettings.push({
      groupId: new mongoose.Types.ObjectId(groupId),
      notifyOnNewPost: settings.notifyOnNewPost ?? false,
      notifyOnMention: settings.notifyOnMention ?? true
    });
  }

  await user.save();

  logger.info('Group notification settings updated', {
    userId: userId.toString(),
    groupId: groupId.toString(),
    settings
  });

  return user.groupNotificationSettings.find(
    s => s.groupId?.toString() === groupId.toString()
  );
}
