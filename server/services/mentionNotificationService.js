/**
 * Mention Notification Service
 * 
 * Handles @mention parsing and notification creation for:
 * - Comments
 * - Replies
 * - Lounge messages
 * 
 * RULES (per CODE_ARGUMENT):
 * - One notification per mentioned user per content item (no duplicates)
 * - Self-mentions ignored
 * - @all, @everyone, @here forbidden
 * - Quiet Mode respected (notifications still delivered, no urgency)
 * - Mentions do NOT affect ranking, discovery, or visibility
 */

import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { shouldReceiveNotifications } from './groupNotificationService.js';
import logger from '../utils/logger.js';

// Forbidden mass mention patterns
const FORBIDDEN_MENTIONS = ['all', 'everyone', 'here'];

// Allowed surfaces for mention notifications (safety guard)
const ALLOWED_SURFACES = ['comment', 'reply', 'lounge'];

// FORBIDDEN surfaces (overreach prevention)
const FORBIDDEN_SURFACES = ['feed_post', 'discovery', 'ranking', 'search'];

/**
 * Extract @mentions from content
 * @param {String} content - Text content
 * @returns {String[]} Array of unique lowercase usernames
 */
export function extractMentions(content) {
  if (!content || typeof content !== 'string') return [];
  
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const mentions = [];
  let match;
  
  while ((match = mentionRegex.exec(content)) !== null) {
    const username = match[1].toLowerCase();
    
    // Filter out forbidden mass mentions
    if (FORBIDDEN_MENTIONS.includes(username)) {
      logger.warn('[Mention] Forbidden mass mention blocked', { username });
      continue;
    }
    
    mentions.push(username);
  }
  
  return [...new Set(mentions)]; // Deduplicate
}

/**
 * Resolve usernames to user documents
 * @param {String[]} usernames - Array of usernames to resolve
 * @param {String} authorId - ID of content author (to exclude self-mentions)
 * @returns {Object[]} Array of user documents
 */
async function resolveUsers(usernames, authorId) {
  if (!usernames || usernames.length === 0) return [];
  
  const users = await User.find({
    username: { $in: usernames.map(u => new RegExp(`^${u}$`, 'i')) },
    isActive: true,
    isBanned: { $ne: true },
    isMuted: { $ne: true }
  }).select('_id username privacySettings blockedUsers');
  
  // Filter out self-mentions
  return users.filter(user => user._id.toString() !== authorId);
}

/**
 * Create mention notifications for a comment or reply
 * @param {Object} options
 * @param {String} options.content - The content containing mentions
 * @param {String} options.authorId - The content author's ID
 * @param {Object} options.author - The author user object (with displayName/username)
 * @param {String} options.commentId - The comment ID (sourceEntityId)
 * @param {String} options.postId - The post ID (for link construction)
 * @param {String} options.surface - 'comment' | 'reply' (for validation)
 * @returns {Number} Number of notifications created
 */
export async function notifyMentionsInComment({ content, authorId, author, commentId, postId, surface = 'comment' }) {
  try {
    // Safety guard: block forbidden surfaces (overreach prevention)
    if (FORBIDDEN_SURFACES.includes(surface)) {
      logger.error('[Mention] BLOCKED: Notification attempted on forbidden surface', { surface });
      return 0;
    }

    // Safety guard: validate allowed surface
    if (!ALLOWED_SURFACES.includes(surface)) {
      logger.warn('[Mention] Notification attempted outside allowed surface', { surface });
      return 0;
    }
    
    // Extract mentions from content
    const mentionedUsernames = extractMentions(content);
    if (mentionedUsernames.length === 0) return 0;
    
    // Resolve usernames to user documents
    const mentionedUsers = await resolveUsers(mentionedUsernames, authorId);
    if (mentionedUsers.length === 0) return 0;
    
    const notificationsToCreate = [];
    const authorName = author?.displayName || author?.username || 'Someone';
    
    for (const user of mentionedUsers) {
      // Skip if user blocked the author
      if (user.blockedUsers?.some(b => b.toString() === authorId)) continue;
      
      // Skip if user shouldn't receive notifications (Quiet Mode check is informational only)
      // Per spec: notifications still delivered in Quiet Mode, just no urgency
      // But we still respect shouldReceiveNotifications for banned/muted users
      if (!shouldReceiveNotifications(user) && !user.privacySettings?.quietModeEnabled) {
        continue;
      }
      
      // Message varies by surface (calm language, no exclamation marks)
      const message = surface === 'reply'
        ? `${authorName} mentioned you in a reply`
        : `${authorName} mentioned you in a comment`;
      
      notificationsToCreate.push({
        recipient: user._id,
        sender: authorId,
        type: 'mention',
        message,
        postId,
        commentId,
        link: `/post/${postId}?comment=${commentId}`,
        batchCount: 1 // Enforced, no batching
      });
    }
    
    if (notificationsToCreate.length > 0) {
      await Notification.insertMany(notificationsToCreate);
      logger.info('[Mention] Notifications created', {
        surface,
        commentId,
        recipientCount: notificationsToCreate.length
      });
    }
    
    return notificationsToCreate.length;
  } catch (error) {
    logger.error('[Mention] Error creating notifications', { error: error.message, surface });
    return 0;
  }
}

/**
 * Create mention notifications for a lounge message
 * @param {Object} options
 * @param {String} options.content - The message content containing mentions
 * @param {String} options.authorId - The message author's ID
 * @param {Object} options.author - The author user object (with displayName/username)
 * @param {String} options.messageId - The message ID (sourceEntityId)
 * @returns {Number} Number of notifications created
 */
export async function notifyMentionsInLounge({ content, authorId, author, messageId }) {
  try {
    // Extract mentions from content
    const mentionedUsernames = extractMentions(content);
    if (mentionedUsernames.length === 0) return 0;

    // Resolve usernames to user documents
    const mentionedUsers = await resolveUsers(mentionedUsernames, authorId);
    if (mentionedUsers.length === 0) return 0;

    const notificationsToCreate = [];
    const authorName = author?.displayName || author?.username || 'Someone';

    for (const user of mentionedUsers) {
      // Skip if user blocked the author
      if (user.blockedUsers?.some(b => b.toString() === authorId)) continue;

      // Respect shouldReceiveNotifications for banned/muted users
      if (!shouldReceiveNotifications(user) && !user.privacySettings?.quietModeEnabled) {
        continue;
      }

      notificationsToCreate.push({
        recipient: user._id,
        sender: authorId,
        type: 'mention',
        message: `${authorName} mentioned you in the Lounge`,
        link: '/lounge',
        batchCount: 1
      });
    }

    if (notificationsToCreate.length > 0) {
      await Notification.insertMany(notificationsToCreate);
      logger.info('[Mention] Lounge notifications created', {
        messageId,
        recipientCount: notificationsToCreate.length
      });
    }

    return notificationsToCreate.length;
  } catch (error) {
    logger.error('[Mention] Error creating lounge notifications', { error: error.message });
    return 0;
  }
}

