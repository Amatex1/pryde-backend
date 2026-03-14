/**
 * reportSnapshotService.js
 *
 * Captures an immutable snapshot of reported content at the moment a report
 * is submitted. The snapshot persists even if the original content is later
 * edited or deleted, giving moderators an accurate view of what was reported.
 *
 * Phase 9 note: replies use reportType='comment' — parentCommentId is stored
 * in metadata so moderators can distinguish top-level comments from replies.
 */

import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { createLogger } from '../utils/logger.js';
import { isEncrypted, decryptMessage } from '../utils/encryption.js';

const logger = createLogger('reportSnapshotService');

/**
 * Build a content snapshot for the given report target.
 *
 * @param {string} reportType   'post' | 'comment' | 'message' | 'user'
 * @param {string} contentId    ObjectId of the target document
 * @returns {Object|null}       snapshot object, or null if content not found
 */
export async function buildContentSnapshot(reportType, contentId) {
  if (!contentId) return null;

  try {
    switch (reportType) {
      case 'post':
        return await _snapshotPost(contentId);
      case 'comment':
        return await _snapshotComment(contentId);
      case 'message':
        return await _snapshotMessage(contentId);
      case 'user':
        return await _snapshotUser(contentId);
      default:
        return null;
    }
  } catch (err) {
    // Non-fatal — snapshot failure must never block report submission
    logger.error('buildContentSnapshot failed', { reportType, contentId, err: err.message });
    return null;
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

async function _snapshotPost(postId) {
  const post = await Post.findById(postId)
    .select('content media images gifUrl author createdAt')
    .populate('author', 'username displayName')
    .lean();

  if (!post) return null;

  const mediaUrls = [];
  if (post.media?.length) post.media.forEach(m => m.url && mediaUrls.push(m.url));
  if (post.images?.length) post.images.forEach(url => url && mediaUrls.push(url));
  if (post.gifUrl) mediaUrls.push(post.gifUrl);

  return {
    text: post.content || '',
    media: mediaUrls,
    authorId: post.author?._id,
    authorUsername: post.author?.username || null,
    authorDisplayName: post.author?.displayName || null,
    createdAt: post.createdAt,
    metadata: {}
  };
}

async function _snapshotComment(commentId) {
  const comment = await Comment.findById(commentId)
    .select('content gifUrl authorId parentCommentId postId createdAt isAnonymous anonymousDisplayName')
    .populate('authorId', 'username displayName')
    .lean();

  if (!comment) return null;

  return {
    text: comment.content || '',
    media: comment.gifUrl ? [comment.gifUrl] : [],
    authorId: comment.isAnonymous ? null : comment.authorId?._id,
    authorUsername: comment.isAnonymous ? null : (comment.authorId?.username || null),
    authorDisplayName: comment.isAnonymous
      ? (comment.anonymousDisplayName || 'Anonymous')
      : (comment.authorId?.displayName || null),
    createdAt: comment.createdAt,
    metadata: {
      // Phase 9: lets admins tell apart top-level comments and nested replies
      isReply: !!comment.parentCommentId,
      parentCommentId: comment.parentCommentId || null,
      postId: comment.postId || null
    }
  };
}

async function _snapshotMessage(messageId) {
  const message = await Message.findById(messageId)
    .select('content attachment sender createdAt')
    .populate('sender', 'username displayName')
    .lean();

  if (!message) return null;

  // Attempt to surface human-readable text; fall back gracefully if encrypted
  let text = message.content || '';
  if (text && isEncrypted(text)) {
    try {
      const decrypted = decryptMessage(text);
      text = typeof decrypted === 'string' ? decrypted : (decrypted?.content || '[encrypted]');
    } catch {
      text = '[encrypted message]';
    }
  }

  return {
    text,
    media: message.attachment ? [message.attachment] : [],
    authorId: message.sender?._id,
    authorUsername: message.sender?.username || null,
    authorDisplayName: message.sender?.displayName || null,
    createdAt: message.createdAt,
    metadata: {}
  };
}

async function _snapshotUser(userId) {
  const user = await User.findById(userId)
    .select('username displayName bio profilePhoto createdAt')
    .lean();

  if (!user) return null;

  return {
    text: user.bio || '',
    media: user.profilePhoto ? [user.profilePhoto] : [],
    authorId: user._id,
    authorUsername: user.username || null,
    authorDisplayName: user.displayName || null,
    createdAt: user.createdAt,
    metadata: {}
  };
}
