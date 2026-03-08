/**
 * Inactivity Email Job
 * 
 * Sends "Pryde misses you" emails to users who have been inactive for 14+ days.
 * This is part of the retention campaign to bring users back.
 * 
 * Schedule: Daily (checks for users inactive for 14, 30, 60, 90 days)
 * 
 * Usage:
 *   import { getQueue } from '../queues/index.js';
 *   await getQueue('email').add('inactivity-email', { userId: user._id, daysInactive: 14 });
 */

import User from '../models/User.js';
import config from '../config/config.js';
import logger from '../utils/logger.js';

/**
 * Get email template based on inactivity duration
 * @param {number} daysInactive - Days since last activity
 * @param {object} user - User object
 * @returns {object} { subject, html }
 */
const getInactivityEmailTemplate = (daysInactive, user) => {
  const appUrl = config.app?.url || 'https://prdeapp.com';
  
  // Different messaging based on how long they've been away
  let subject, heading, message, ctaText;
  
  if (daysInactive < 21) {
    // 2 weeks - gentle reminder
    subject = '🌈 We miss you on Pryde';
    heading = 'Hey, we miss you!';
    message = "It's been a little while since you visited Pryde. No pressure at all - we just wanted to let you know we're here when you're ready.";
    ctaText = 'Catch up on what you missed';
  } else if (daysInactive < 35) {
    // ~1 month - warmer
    subject = '💜 Thinking of you';
    heading = 'A gentle reminder';
    message = "We've noticed you haven't been around for a bit. That's totally okay - life gets busy. When you're ready, your community is here.";
    ctaText = 'See what\'s new';
  } else if (daysInactive < 65) {
    // ~2 months - re-engagement
    subject = '👋 Your community is still here';
    heading = 'Welcome back (whenever you\'re ready)';
    message = "It's been a while since you visited Pryde. Your friends have been sharing some great moments. We'd love to see you again when the time is right.";
    ctaText = 'See what you missed';
  } else {
    // 3+ months - win-back
    subject = '🌈 A calmer space is waiting for you';
    heading = 'Your community welcomes you back';
    message = "It's been a little while. We wanted to remind you that Pryde is still here - a calm, supportive space for our community. No pressure ever.";
    ctaText = 'Return to Pryde';
  }
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #6366f1; margin: 0;">🌈 Pryde Social</h1>
    </div>
    
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="${appUrl}/pryde-heart.png" alt="Pryde" style="width: 80px; height: 80px;" onerror="this.style.display='none'">
    </div>
    
    <h2 style="color: #1f2937; margin-top: 0; text-align: center;">${heading}</h2>
    <p style="color: #4b5563; line-height: 1.6; text-align: center;">${message}</p>
    
    <!-- Community Highlight -->
    <div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); border-radius: 12px; padding: 20px; margin: 24px 0;">
      <h3 style="color: #1f2937; margin: 0 0 12px 0; font-size: 16px;">💭 This week's prompt</h3>
      <p style="color: #4b5563; margin: 0; font-style: italic;">"What made you smile today?"</p>
    </div>
    
    <!-- CTA Button -->
    <div style="text-align: center; margin: 24px 0;">
      <a href="${appUrl}/feed" style="display: inline-block; background: #6366f1; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        ${ctaText}
      </a>
    </div>
    
    <!-- Gentle Footer -->
    <div style="text-align: center; margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 14px; margin: 0;">
        No worries either way. We'll be here whenever you're ready. 💜
      </p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">
        <a href="${appUrl}/settings" style="color: #9ca3af;">Email preferences</a>
        <span style="color: #d1d5db;"> | </span>
        <a href="${appUrl}/unsubscribe" style="color: #9ca3af;">Unsubscribe</a>
      </p>
    </div>
  </div>
  
  <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">
    © ${new Date().getFullYear()} Pryde Social - A calmer space for the LGBTQ+ community
  </p>
</body>
</html>
  `;
  
  return { subject, html };
};

/**
 * Process inactivity email job
 * @param {object} job - BullMQ job
 */
export async function processInactivityEmailJob(job) {
  const { userId, daysInactive } = job.data;
  logger.info(`[InactivityEmail] Processing for user ${userId}, ${daysInactive} days inactive`);
  
  try {
    const user = await User.findById(userId).select('username displayName email lastActivityDate');
    
    if (!user || !user.email) {
      logger.warn(`[InactivityEmail] No user or email for ${userId}`);
      return { success: false, reason: 'no_user_or_email' };
    }
    
    // Check if we've already sent an email recently for this inactivity tier
    const emailPrefs = user.emailPreferences || {};
    const lastSent = emailPrefs[`inactivity_${daysInactive}EmailSentAt`];
    
    if (lastSent) {
      const daysSinceEmail = (Date.now() - new Date(lastSent).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceEmail < 30) {
        logger.info(`[InactivityEmail] Already sent ${daysInactive}d email recently for ${userId}`);
        return { success: false, reason: 'email_recently_sent' };
      }
    }
    
    const { subject, html } = getInactivityEmailTemplate(daysInactive, user);
    
    // Import email service
    const { sendEmail } = await import('../services/emailService.js');
    const result = await sendEmail(user.email, subject, html);
    
    if (result.success) {
      // Update user preference to prevent duplicate sends
      const updateKey = `emailPreferences.inactivity_${daysInactive}EmailSentAt`;
      await User.findByIdAndUpdate(userId, {
        [updateKey]: new Date()
      });
      
      logger.info(`[InactivityEmail] Sent to ${user.email} (${daysInactive}d inactive)`);
      return { success: true };
    } else {
      logger.error(`[InactivityEmail] Failed: ${result.error}`);
      return { success: false, error: result.error };
    }
  } catch (error) {
    logger.error(`[InactivityEmail] Error: ${error.message}`);
    throw error;
  }
};

/**
 * Find users eligible for inactivity emails
 * Returns users who have been inactive for 14, 30, or 60+ days
 * and haven't received an email for that tier recently
 */
export const findUsersForInactivityEmails = async () => {
  const now = new Date();
  const users = await User.find({
    email: { $exists: true, $ne: null },
    role: { $nin: ['system', 'prompts'] }
  }).select('_id email username displayName lastActivityDate emailPreferences createdAt');
  
  const eligibleUsers = [];
  
  for (const user of users) {
    if (!user.lastActivityDate && !user.createdAt) continue;
    
    const lastActive = user.lastActivityDate || user.createdAt;
    const daysInactive = Math.floor((now - new Date(lastActive)) / (1000 * 60 * 60 * 24));
    
    // Only interested in specific tiers
    if (![14, 30, 60, 90].includes(daysInactive)) continue;
    
    const prefs = user.emailPreferences || {};
    const lastSent = prefs[`inactivity_${daysInactive}EmailSentAt`];
    
    // Skip if already sent recently
    if (lastSent) {
      const daysSinceEmail = (now - new Date(lastSent)) / (1000 * 60 * 60 * 24);
      if (daysSinceEmail < 30) continue;
    }
    
    eligibleUsers.push({
      userId: user._id,
      daysInactive,
      email: user.email
    });
  }
  
  logger.info(`[InactivityEmail] Found ${eligibleUsers.length} eligible users for inactivity emails`);
  return eligibleUsers;
};

/**
 * Queue inactivity emails for all eligible users
 * Should be run daily
 */
export const queueInactivityEmails = async () => {
  const { getQueue } = await import('../queues/index.js');
  const queue = getQueue('email');
  
  const eligible = await findUsersForInactivityEmails();
  
  for (const user of eligible) {
    await queue.add('inactivity-email', {
      userId: user.userId,
      daysInactive: user.daysInactive
    }, {
      delay: Math.random() * 3600000 // Random delay 0-1 hour to spread load
    });
  }
  
  logger.info(`[InactivityEmail] Queued ${eligible.length} inactivity emails`);
  return { queued: eligible.length };
};

export default {
  getInactivityEmailTemplate,
  processInactivityEmailJob,
  findUsersForInactivityEmails,
  queueInactivityEmails
};

