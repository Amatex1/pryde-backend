/**
 * Notification Digest Job
 *
 * Sends a daily activity summary email to users who have unread notifications
 * from the past 24 hours and haven't logged in today.
 *
 * Schedule: Daily at 09:00 local server time (configured via cron)
 *
 * Email includes:
 *   - New reactions (likes)
 *   - Replies to their posts
 *   - Mentions
 *   - New connections (friend_request / friend_accept)
 */

import cron from 'node-cron';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import config from '../config/config.js';
import logger from '../utils/logger.js';

const DIGEST_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Count unread notifications by category for a user over the last 24 hours.
 *
 * @param {string} userId
 * @returns {Promise<{reactions:number, replies:number, mentions:number, connections:number, total:number}>}
 */
async function getDigestCounts(userId) {
  const since = new Date(Date.now() - DIGEST_WINDOW_MS);

  const notifications = await Notification.find({
    recipient: userId,
    read: false,
    createdAt: { $gt: since },
    type: { $ne: 'message' }
  }).select('type count').lean();

  const counts = { reactions: 0, replies: 0, mentions: 0, connections: 0 };

  for (const n of notifications) {
    const c = n.count || 1;
    if (n.type === 'like' || n.type === 'reaction') counts.reactions += c;
    else if (n.type === 'comment') counts.replies += c;
    else if (n.type === 'mention' || n.type === 'group_mention') counts.mentions += c;
    else if (n.type === 'friend_request' || n.type === 'friend_accept') counts.connections += c;
  }

  counts.total = counts.reactions + counts.replies + counts.mentions + counts.connections;
  return counts;
}

/**
 * Build the digest email HTML.
 */
function buildDigestEmail(user, counts) {
  const appUrl = config.app?.url || 'https://prdeapp.com';
  const name = user.displayName || user.username || 'there';

  const rows = [
    counts.reactions  > 0 && `<li>${counts.reactions} new reaction${counts.reactions !== 1 ? 's' : ''}</li>`,
    counts.replies    > 0 && `<li>${counts.replies} repl${counts.replies !== 1 ? 'ies' : 'y'} to your posts</li>`,
    counts.mentions   > 0 && `<li>${counts.mentions} mention${counts.mentions !== 1 ? 's' : ''}</li>`,
    counts.connections > 0 && `<li>${counts.connections} new connection${counts.connections !== 1 ? 's' : ''}</li>`,
  ].filter(Boolean).join('\n');

  const subject = 'Your Pryde activity summary';
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f5f5f5;">
  <div style="background:white;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
    <h1 style="color:#6366f1;margin:0 0 8px;">🌈 Pryde Social</h1>
    <h2 style="color:#1f2937;margin-top:0;">Hey ${name}, here's what happened today</h2>
    <ul style="color:#4b5563;line-height:2;">
      ${rows}
    </ul>
    <div style="text-align:center;margin:24px 0;">
      <a href="${appUrl}/notifications" style="display:inline-block;background:#6366f1;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;">
        See all notifications
      </a>
    </div>
    <div style="text-align:center;margin-top:24px;padding-top:24px;border-top:1px solid #e5e7eb;">
      <p style="color:#6b7280;font-size:14px;margin:0;">No pressure — just letting you know 💜</p>
      <p style="color:#9ca3af;font-size:12px;margin-top:16px;">
        <a href="${appUrl}/settings" style="color:#9ca3af;">Email preferences</a>
        <span style="color:#d1d5db;"> | </span>
        <a href="${appUrl}/unsubscribe" style="color:#9ca3af;">Unsubscribe</a>
      </p>
    </div>
  </div>
  <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:16px;">
    © ${new Date().getFullYear()} Pryde Social
  </p>
</body>
</html>`;

  return { subject, html };
}

/**
 * Send digest emails to all eligible users.
 * A user is eligible if:
 *   - They have an email address
 *   - They have ≥1 unread notification in the last 24h
 *   - They haven't been active in the last 4 hours (don't email active users)
 */
export async function sendDailyDigests() {
  const since = new Date(Date.now() - DIGEST_WINDOW_MS);
  const recentActivityThreshold = new Date(Date.now() - 4 * 60 * 60 * 1000);

  logger.info('[DigestJob] Starting daily notification digest run');

  const users = await User.find({
    email: { $exists: true, $ne: null },
    role: { $nin: ['system', 'prompts'] },
    lastActivityDate: { $lt: recentActivityThreshold }
  }).select('_id email username displayName lastActivityDate').lean();

  let sent = 0;
  let skipped = 0;

  for (const user of users) {
    try {
      const counts = await getDigestCounts(user._id.toString());
      if (counts.total === 0) { skipped++; continue; }

      const { subject, html } = buildDigestEmail(user, counts);
      const { sendEmail } = await import('../services/emailService.js');
      const result = await sendEmail(user.email, subject, html);

      if (result.success) {
        sent++;
      } else {
        logger.warn(`[DigestJob] Email failed for ${user.email}: ${result.error}`);
      }
    } catch (err) {
      logger.error(`[DigestJob] Error for user ${user._id}:`, err.message);
    }
  }

  logger.info(`[DigestJob] Complete — sent: ${sent}, skipped (no activity): ${skipped}`);
  return { sent, skipped };
}

// Run every day at 09:00
cron.schedule('0 9 * * *', sendDailyDigests);

logger.info('[DigestJob] Notification digest job scheduled (daily 09:00)');

export default { sendDailyDigests };
