/**
 * Notification Bundling + Quiet Mode Utility
 *
 * Upserts notifications so repeated activity on the same target
 * is collapsed into one record instead of creating spam.
 *
 * Also enforces Quiet Mode: if the recipient is currently in quiet hours,
 * low-priority notifications are queued and held until quiet hours end.
 *
 * Query key: recipient + bundleKey + read:false
 * On hit  → append actorId to actorIds (if not already present), bump updatedAt
 * On miss → create a fresh notification
 */

import Notification from '../models/Notification.js';
import User          from '../models/User.js';
import { isQuietHours, nextQuietModeEnd } from './quietModeCheck.js';

/**
 * @param {object} opts
 * @param {string}   opts.type       – Notification type ('like', 'comment', …)
 * @param {string}   opts.bundleKey  – Unique bundle identifier, e.g. "post_like:<postId>"
 * @param {*}        opts.actorId    – ObjectId (or string) of the user performing the action
 * @param {*}        opts.recipient  – ObjectId (or string) of the recipient
 * @param {string}   [opts.priority] – 'critical' | 'important' | 'passive' (default: 'passive')
 * @param {object}   opts.data       – Extra fields (message, postId, commentId, …)
 * @returns {Promise<mongoose.Document>} The created or updated Notification document
 */
export async function bundleNotification({ type, bundleKey, actorId, recipient, priority = 'passive', data }) {
  // ── Quiet Mode check ────────────────────────────────────────────────────────
  const recipientUser = await User.findById(recipient).select('privacySettings').lean();
  const inQuiet       = recipientUser ? isQuietHours(recipientUser) : false;
  const allowCritical = recipientUser?.privacySettings?.allowCriticalDuringQuiet ?? true;

  // Critical notifications bypass quiet mode when the user allows it
  const shouldQueue = inQuiet && !(priority === 'critical' && allowCritical);

  // ── Bundle upsert ───────────────────────────────────────────────────────────
  const existing = await Notification.findOne({ recipient, bundleKey, read: false });

  if (!existing) {
    return Notification.create({
      type,
      bundleKey,
      recipient,
      sender:   actorId,
      actorIds: [actorId],
      priority,
      queued:       shouldQueue,
      deliverAfter: shouldQueue ? nextQuietModeEnd(recipientUser) : null,
      ...data,
    });
  }

  // Add actor if they haven't already contributed to this bundle
  const alreadyIn = existing.actorIds.some(
    (id) => id.toString() === actorId.toString()
  );
  if (!alreadyIn) {
    existing.actorIds.push(actorId);
  }

  // (Re-)queue if we're in quiet hours and not already queued
  if (shouldQueue && !existing.queued) {
    existing.queued       = true;
    existing.deliverAfter = nextQuietModeEnd(recipientUser);
  }

  existing.updatedAt = new Date();
  await existing.save();

  return existing;
}
