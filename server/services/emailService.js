/**
 * Email Notification Service
 * 
 * Handles email notifications for user events.
 * Configured for Resend SMTP (resend.com)
 */

import nodemailer from 'nodemailer';
import config from '../config/config.js';
import logger from '../utils/logger.js';

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
export const sendEmail = async (to, subject, html) => {
  if (!transporter) {
    logger.info(`[Email] Mock email to ${to}: ${subject}`);
    return { success: true, mock: true };
  }

  try {
    const result = await transporter.sendMail({
      from: config.email?.from || 'noreply@prydeapp.com',
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
          <h1 style="color: #6366f1; margin: 0;">Pryde Social</h1>
        </div>
        <h2 style="color: #1f2937; margin-top: 0;">Welcome, ${user.displayName || user.username}! 🎉</h2>
        <p style="color: #4b5563; line-height: 1.6;">We're excited to have you join Pryde Social!</p>
        <p style="color: #4b5563; line-height: 1.6;">Get started by:</p>
        <ul style="color: #4b5563; line-height: 1.8;">
          <li>Completing your profile</li>
          <li>Following some users</li>
          <li>Making your first post</li>
        </ul>
        <div style="text-align: center; margin-top: 32px;">
          <a href="${config.app?.url || 'https://prydeapp.com'}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">Get Started</a>
        </div>
        <p style="color: #9ca3af; font-size: 14px; margin-top: 32px; text-align: center;">Enjoy your stay!</p>
      </div>
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">© ${new Date().getFullYear()} Pryde Social</p>
    </body>
    </html>
  `;
  
  return sendEmail(user.email, subject, html);
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (user, resetToken) => {
  const subject = 'Reset your Pryde Social password';
  const resetUrl = `${config.app?.url || 'https://prydeapp.com'}/reset-password?token=${resetToken}`;
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
          <h1 style="color: #6366f1; margin: 0;">Pryde Social</h1>
        </div>
        <h2 style="color: #1f2937; margin-top: 0;">Reset your password</h2>
        <p style="color: #4b5563; line-height: 1.6;">Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">Reset Password</a>
        </div>
        <p style="color: #9ca3af; font-size: 14px;">This link expires in 1 hour.</p>
        <p style="color: #9ca3af; font-size: 14px;">If you didn't request this, please ignore this email.</p>
      </div>
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">© ${new Date().getFullYear()} Pryde Social</p>
    </body>
    </html>
  `;
  
  return sendEmail(user.email, subject, html);
};

/**
 * Send notification digest email
 */
export const sendNotificationDigest = async (user, notifications) => {
  const subject = `You have ${notifications.length} new notifications on Pryde Social`;
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
          <h1 style="color: #6366f1; margin: 0;">Pryde Social</h1>
        </div>
        <h2 style="color: #1f2937; margin-top: 0;">Your recent notifications</h2>
        ${notifications.map(n => `<p style="color: #4b5563; line-height: 1.6;">${n.message}</p>`).join('')}
        <div style="text-align: center; margin-top: 24px;">
          <a href="${config.app?.url || 'https://prydeapp.com'}/notifications" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">View All Notifications</a>
        </div>
      </div>
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">© ${new Date().getFullYear()} Pryde Social</p>
    </body>
    </html>
  `;
  
  return sendEmail(user.email, subject, html);
};

export default {
  initEmailService,
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendNotificationDigest
};
