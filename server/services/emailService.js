/**
 * Email Notification Service
 * 
 * Handles email notifications for user events.
 * Configured for Resend SMTP (resend.com)
 */

import nodemailer from 'nodemailer';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import { EMAIL_SENDERS } from '../config/emailSenders.js';
import { buildEmailTemplate } from './emailTemplate.js';

let transporter = null;

/**
 * Initialize email transporter with Resend
 */
export const initEmailService = async () => {
  const { host, port, secure, auth, from } = config.email || {};
  
  if (!host) {
    logger.warn('[EmailService] SMTP not configured - emails will be logged only');
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      host: host,
      port: port,
      secure: secure,
      auth: auth?.user ? {
        user: auth.user,
        pass: auth.pass
      } : undefined
    });

    // Verify connection
    await transporter.verify();
    logger.info('[EmailService] Email service initialized successfully');
    
    return transporter;
  } catch (error) {
    logger.error('[EmailService] Failed to initialize:', error.message);
    return null;
  }
};

/**
 * Send email notification
 */
export const sendEmail = async (to, subject, html, from = EMAIL_SENDERS.SYSTEM) => {
  if (!transporter) {
    logger.info(`[Email] Mock email to ${to}: ${subject}`);
    return { success: true, mock: true };
  }

  try {
    const result = await transporter.sendMail({
      from: config.email?.from || from,
      to,
      subject,
      html
    });
    return { success: true, messageId: result.messageId };
  } catch (error) {
    logger.error('[EmailService] Send error:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send welcome email
 */
export const sendWelcomeEmail = async (user) => {
  const subject = 'Welcome to Pryde Social! 🎉';
  const html = buildEmailTemplate({
    title: `Welcome, ${user.displayName || user.username}! 🎉`,
    body: `We're excited to have you join Pryde Social!<br><br>
      Get started by:<br>
      • Completing your profile<br>
      • Following some users<br>
      • Making your first post<br><br>
      Enjoy your stay!`,
    actionText: 'Get Started',
    actionUrl: config.app?.url || 'https://prydeapp.com',
  });

  return sendEmail(user.email, subject, html, EMAIL_SENDERS.NOTIFY);
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (user, resetToken) => {
  const subject = 'Reset your Pryde Social password';
  const resetUrl = `${config.app?.url || 'https://prydeapp.com'}/reset-password?token=${resetToken}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
    .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const html = buildEmailTemplate({
    title: 'Reset your password',
    body: `Click the button below to reset your password.<br><br>
      If you didn't request this, please ignore this email.`,
    actionText: 'Reset Password',
    actionUrl: resetUrl,
    expiresAt,
  });

  return sendEmail(user.email, subject, html, EMAIL_SENDERS.SYSTEM);
};

/**
 * Send notification digest email
 */
export const sendNotificationDigest = async (user, notifications) => {
  const subject = `You have ${notifications.length} new notifications on Pryde Social`;
  const html = buildEmailTemplate({
    title: 'Your recent notifications',
    body: notifications.map(n => n.message).join('<br>'),
    actionText: 'View All Notifications',
    actionUrl: `${config.app?.url || 'https://prydeapp.com'}/notifications`,
  });

  return sendEmail(user.email, subject, html, EMAIL_SENDERS.NOTIFY);
};

export default {
  initEmailService,
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendNotificationDigest
};
