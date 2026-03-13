import { Resend } from 'resend';
import config from '../config/config.js';
import OutboundEmail from '../models/OutboundEmail.js';
import { EMAIL_SENDERS } from '../config/emailSenders.js';
import { buildEmailTemplate } from './emailTemplate.js';

const logOutbound = (to, subject, type, resendId, success, errorMessage) => {
  OutboundEmail.create({ to, subject, type, resendId: resendId || null, success, errorMessage: errorMessage || null })
    .catch(err => console.error('[emailService] Failed to log outbound email:', err.message));
};

// Initialize Resend client (lazy initialization)
let resend = null;
const getResendClient = () => {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
};

// Sender addresses — see server/config/emailSenders.js for full channel documentation

export const sendPasswordResetEmail = async (email, resetToken, username) => {
  try {
    const resendClient = getResendClient();

    if (!resendClient) {
      console.warn('Resend API key not configured. Email not sent.');
      return { success: false, error: 'Email service not configured' };
    }

    const resetUrl = `${config.frontendURL}/reset-password?token=${resetToken}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
      .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const { data, error } = await resendClient.emails.send({
      from: EMAIL_SENDERS.SYSTEM,
      to: email,
      replyTo: 'support@prydeapp.com',
      subject: 'Password Reset Request - Pryde Social',
      html: buildEmailTemplate({
        title: 'Reset your password',
        body: `Hi ${username},<br><br>
          We received a request to reset your Pryde Social password. Click the button below to create a new password.<br><br>
          If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.`,
        actionText: 'Reset Password',
        actionUrl: resetUrl,
        expiresAt,
      }),
      /*
       * List-Unsubscribe header improves deliverability and allows email clients
       * (Gmail, Outlook, Apple Mail) to display native unsubscribe controls.
       * Required for modern email reputation and spam compliance.
       */
      headers: {
        'List-Unsubscribe': 'mailto:unsubscribe@prydeapp.com',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });

    if (error) {
      logOutbound(email, 'Password Reset Request - Pryde Social', 'password_reset', null, false, error.message);
      console.error('Error sending password reset email:', error);
      throw new Error('Failed to send password reset email');
    }

    logOutbound(email, 'Password Reset Request - Pryde Social', 'password_reset', data.id, true, null);
    console.log('Password reset email sent:', data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};

export const sendLoginAlertEmail = async (email, username, loginInfo) => {
  try {
    const resendClient = getResendClient();

    if (!resendClient) {
      console.warn('Resend API key not configured. Email not sent.');
      return { success: false, error: 'Email service not configured' };
    }

    const { deviceInfo, browser, os, ipAddress, location, timestamp } = loginInfo;
    const formattedDate = new Date(timestamp).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    const { data, error } = await resendClient.emails.send({
      from: EMAIL_SENDERS.SECURITY,
      to: email,
      replyTo: 'security@prydeapp.com',
      subject: '🔐 New Login to Your Pryde Social Account',
      html: buildEmailTemplate({
        title: '🔐 New Login Detected',
        body: `Hi ${username},<br><br>
          We detected a new login to your Pryde Social account. Here are the details:<br><br>
          <strong>Date &amp; Time:</strong> ${formattedDate}<br>
          <strong>Device:</strong> ${deviceInfo || 'Unknown Device'}<br>
          <strong>Browser:</strong> ${browser || 'Unknown'}<br>
          <strong>Operating System:</strong> ${os || 'Unknown'}<br>
          <strong>IP Address:</strong> ${ipAddress || 'Unknown'}<br>
          ${location && location.city ? `<strong>Location:</strong> ${location.city}, ${location.region}, ${location.country}<br>` : ''}
          <br>
          <strong>Was this you?</strong> If you recognize this login, you can safely ignore this email.<br><br>
          <strong>⚠️ Didn't recognize this login?</strong> If this wasn't you, your account may be compromised. Change your password, enable two-factor authentication (2FA), and review your active sessions immediately.`,
        actionText: 'Review Security Settings',
        actionUrl: `${config.frontendURL}/settings/security`,
      }),
    });

    if (error) {
      logOutbound(email, '🔐 New Login to Your Pryde Social Account', 'login_alert', null, false, error.message);
      console.error('Error sending login alert email:', error);
      return { success: false, error: error.message };
    }

    logOutbound(email, '🔐 New Login to Your Pryde Social Account', 'login_alert', data.id, true, null);
    console.log('Login alert email sent:', data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Error sending login alert email:', error);
    // Don't throw error - login should succeed even if email fails
    return { success: false, error: error.message };
  }
};

export const sendSuspiciousLoginEmail = async (email, username, loginInfo) => {
  try {
    const resendClient = getResendClient();

    if (!resendClient) {
      console.warn('Resend API key not configured. Email not sent.');
      return { success: false, error: 'Email service not configured' };
    }

    const { deviceInfo, browser, os, ipAddress, location, timestamp } = loginInfo;
    const formattedDate = new Date(timestamp).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    const { data, error } = await resendClient.emails.send({
      from: EMAIL_SENDERS.SECURITY,
      to: email,
      replyTo: 'security@prydeapp.com',
      subject: '⚠️ SUSPICIOUS LOGIN ATTEMPT - Pryde Social',
      html: buildEmailTemplate({
        title: '⚠️ Suspicious Login Detected',
        body: `Hi ${username},<br><br>
          <strong>⚠️ SUSPICIOUS LOGIN DETECTED</strong><br>
          We detected a login from an unrecognized device or location. This login was allowed, but we recommend reviewing your account security immediately.<br><br>
          <strong>Date &amp; Time:</strong> ${formattedDate}<br>
          <strong>Device:</strong> ${deviceInfo || 'Unknown Device'}<br>
          <strong>Browser:</strong> ${browser || 'Unknown'}<br>
          <strong>Operating System:</strong> ${os || 'Unknown'}<br>
          <strong>IP Address:</strong> ${ipAddress || 'Unknown'}<br>
          ${location && location.city ? `<strong>Location:</strong> ${location.city}, ${location.region}, ${location.country}<br>` : ''}
          <br>
          <strong>If this wasn't you:</strong><br>
          • Change your password immediately<br>
          • Enable two-factor authentication (2FA)<br>
          • Log out all other sessions<br>
          • Review your account activity`,
        actionText: 'Secure My Account',
        actionUrl: `${config.frontendURL}/settings/security`,
      }),
    });

    if (error) {
      logOutbound(email, '⚠️ SUSPICIOUS LOGIN ATTEMPT - Pryde Social', 'suspicious_login', null, false, error.message);
      console.error('Error sending suspicious login email:', error);
      return { success: false, error: error.message };
    }

    logOutbound(email, '⚠️ SUSPICIOUS LOGIN ATTEMPT - Pryde Social', 'suspicious_login', data.id, true, null);
    console.log('Suspicious login alert email sent:', data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Error sending suspicious login email:', error);
    // Don't throw error - login should succeed even if email fails
    return { success: false, error: error.message };
  }
};

/**
 * Send email verification email
 */
export const sendVerificationEmail = async (email, verificationToken, username) => {
  try {
    const resendClient = getResendClient();

    if (!resendClient) {
      console.warn('Resend API key not configured. Email not sent.');
      return { success: false, error: 'Email service not configured' };
    }

    const verificationUrl = `${config.frontendURL}/verify-email?token=${verificationToken}`;

    const { data, error } = await resendClient.emails.send({
      from: EMAIL_SENDERS.SYSTEM,
      to: email,
      replyTo: 'support@prydeapp.com',
      subject: 'Verify Your Email - Pryde Social',
      html: buildEmailTemplate({
        title: 'Welcome to Pryde! 🌈',
        body: `Hi ${username},<br><br>
          Thank you for joining Pryde Social! We're excited to have you in our LGBTQ+ community. 💜<br><br>
          To complete your registration and start connecting with others, please verify your email address by clicking the button below.<br><br>
          <strong>⏰ This link will expire in 24 hours.</strong><br><br>
          If you didn't create an account with Pryde Social, you can safely ignore this email.`,
        actionText: 'Verify Email Address',
        actionUrl: verificationUrl,
      }),
      /*
       * List-Unsubscribe header improves deliverability and allows email clients
       * (Gmail, Outlook, Apple Mail) to display native unsubscribe controls.
       * Required for modern email reputation and spam compliance.
       */
      headers: {
        'List-Unsubscribe': 'mailto:unsubscribe@prydeapp.com',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });

    if (error) {
      logOutbound(email, 'Verify Your Email - Pryde Social', 'verification', null, false, error.message);
      console.error('Error sending verification email:', error);
      return { success: false, error: error.message };
    }

    logOutbound(email, 'Verify Your Email - Pryde Social', 'verification', data.id, true, null);
    console.log('Verification email sent:', data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Error sending verification email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send password changed notification email
 */
export const sendPasswordChangedEmail = async (email, username) => {
  try {
    const resendClient = getResendClient();

    if (!resendClient) {
      console.warn('Resend API key not configured. Email not sent.');
      return { success: false, error: 'Email service not configured' };
    }

    const { data, error } = await resendClient.emails.send({
      from: EMAIL_SENDERS.SECURITY,
      to: email,
      replyTo: 'security@prydeapp.com',
      subject: '🔐 Your Password Has Been Changed - Pryde Social',
      html: buildEmailTemplate({
        title: 'Password Changed ✅',
        body: `Hi ${username},<br><br>
          This is a confirmation that your Pryde Social account password was successfully changed at ${new Date().toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
          })}.<br><br>
          <strong>⚠️ Didn't change your password?</strong><br>
          If you did not make this change, your account may be compromised. Please reset your password immediately, enable two-factor authentication (2FA), review your active sessions, and contact our support team.`,
        actionText: 'Review Security Settings',
        actionUrl: `${config.frontendURL}/settings/security`,
      }),
    });

    if (error) {
      logOutbound(email, '🔐 Your Password Has Been Changed - Pryde Social', 'password_changed', null, false, error.message);
      console.error('Error sending password changed email:', error);
      return { success: false, error: error.message };
    }

    logOutbound(email, '🔐 Your Password Has Been Changed - Pryde Social', 'password_changed', data.id, true, null);
    console.log('Password changed email sent:', data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Error sending password changed email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send account recovery request notification to recovery contact
 */
export const sendRecoveryContactNotificationEmail = async (contactEmail, contactUsername, requesterUsername, requestId, expiresAt) => {
  try {
    const resendClient = getResendClient();

    if (!resendClient) {
      console.warn('Resend API key not configured. Email not sent.');
      return { success: false, error: 'Email service not configured' };
    }

    const approveUrl = `${config.frontendURL}/recovery/approve/${requestId}`;
    const expirationDate = new Date(expiresAt).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    const { data, error } = await resendClient.emails.send({
      from: EMAIL_SENDERS.SYSTEM,
      to: contactEmail,
      replyTo: 'support@prydeapp.com',
      subject: `🔐 Account Recovery Request for ${requesterUsername} - Pryde Social`,
      html: buildEmailTemplate({
        title: '🔐 Account Recovery Request',
        body: `Hi ${contactUsername},<br><br>
          <strong>${requesterUsername}</strong> has requested to recover their Pryde Social account, and you are listed as one of their trusted recovery contacts.<br><br>
          <strong>Requested by:</strong> ${requesterUsername}<br>
          <strong>Request time:</strong> ${new Date().toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
          })}<br>
          <strong>Expires:</strong> ${expirationDate}<br>
          <strong>Time remaining:</strong> 24 hours<br><br>
          To help them recover their account, please review and approve this request. At least 2 trusted contacts must approve before the account can be recovered.<br><br>
          <strong>⚠️ Important Security Notice</strong><br>
          • Only approve this request if you personally know <strong>${requesterUsername}</strong> and can verify their identity<br>
          • If you did not expect this request or suspect fraud, please ignore this email<br>
          • This request will automatically expire in 24 hours<br>
          • Contact us immediately if you believe this is a security threat`,
        actionText: '✓ Review Recovery Request',
        actionUrl: approveUrl,
        expiresAt: expirationDate,
      }),
      /*
       * List-Unsubscribe header improves deliverability and allows email clients
       * (Gmail, Outlook, Apple Mail) to display native unsubscribe controls.
       * Required for modern email reputation and spam compliance.
       */
      headers: {
        'List-Unsubscribe': 'mailto:unsubscribe@prydeapp.com',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });

    if (error) {
      logOutbound(contactEmail, `🔐 Account Recovery Request for ${requesterUsername} - Pryde Social`, 'recovery_contact', null, false, error.message);
      console.error('Error sending recovery contact notification email:', error);
      return { success: false, error: error.message };
    }

    logOutbound(contactEmail, `🔐 Account Recovery Request for ${requesterUsername} - Pryde Social`, 'recovery_contact', data.id, true, null);
    console.log('Recovery contact notification email sent:', data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Error sending recovery contact notification email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send account deletion confirmation email
 */
export const sendAccountDeletionEmail = async (email, username, deletionToken) => {
  try {
    const resendClient = getResendClient();

    if (!resendClient) {
      console.warn('Resend API key not configured. Email not sent.');
      return { success: false, error: 'Email service not configured' };
    }

    const deletionUrl = `${config.frontendURL}/delete-account/confirm?token=${deletionToken}`;

    const { data, error } = await resendClient.emails.send({
      from: EMAIL_SENDERS.SYSTEM,
      to: email,
      replyTo: 'support@prydeapp.com',
      subject: '⚠️ Account Deletion Request - Pryde Social',
      html: buildEmailTemplate({
        title: '⚠️ Account Deletion Request',
        body: `Hi ${username},<br><br>
          We received a request to permanently delete your Pryde Social account. This action cannot be undone.<br><br>
          <strong>⚠️ Account Deletion Consequences:</strong><br>
          • Your profile and all posts will be permanently removed<br>
          • You will lose access to all your data<br>
          • This action cannot be reversed<br>
          • You have 30 days to recover your account after deletion<br><br>
          If you want to proceed, click the button below to confirm. If this was a mistake, simply log back in using your existing credentials to cancel deletion and restore your account.<br><br>
          If you didn't request this deletion, you can safely ignore this email. Your account will remain active.`,
        actionText: 'Confirm Account Deletion',
        actionUrl: deletionUrl,
      }),
      /*
       * List-Unsubscribe header improves deliverability and allows email clients
       * (Gmail, Outlook, Apple Mail) to display native unsubscribe controls.
       * Required for modern email reputation and spam compliance.
       */
      headers: {
        'List-Unsubscribe': 'mailto:unsubscribe@prydeapp.com',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });

    if (error) {
      logOutbound(email, '⚠️ Account Deletion Request - Pryde Social', 'account_deletion', null, false, error.message);
      console.error('Error sending account deletion email:', error);
      return { success: false, error: error.message };
    }

    logOutbound(email, '⚠️ Account Deletion Request - Pryde Social', 'account_deletion', data.id, true, null);
    console.log('Account deletion email sent:', data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Error sending account deletion email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send override step-up verification code to the requesting super_admin.
 */
export const sendOverrideVerificationEmail = async (email, username, { action, targetUsername, ip, code }) => {
  try {
    const resendClient = getResendClient();
    if (!resendClient) return { success: false, error: 'Email service not configured' };

    const expiresNote = 'This code expires in 5 minutes.';
    const actionLabel = {
      DEMOTE_SUPER_ADMIN: 'Demote to Admin',
      RESET_ADMIN_PASSWORD: 'Reset Password',
      LOCK_ADMIN_ACCOUNT: 'Lock Account (30 days)'
    }[action] || action;

    const { data, error } = await resendClient.emails.send({
      from: EMAIL_SENDERS.SECURITY,
      to: email,
      replyTo: 'security@prydeapp.com',
      subject: 'Pryde Security — Admin Override Verification',
      html: buildEmailTemplate({
        title: '🚨 Admin Override Verification',
        body: `Hi ${username},<br><br>
          An emergency admin override was requested from your account.<br><br>
          <strong>Details:</strong><br>
          • <strong>Action:</strong> ${actionLabel}<br>
          • <strong>Target account:</strong> @${targetUsername}<br>
          • <strong>IP Address:</strong> ${ip}<br><br>
          Your verification code is:<br><br>
          <div style="background:#f4f4f4;border-radius:8px;padding:20px 32px;display:inline-block;font-size:32px;font-weight:700;letter-spacing:8px;color:#2B2B2B;margin:8px 0;">${code}</div><br><br>
          ${expiresNote}<br><br>
          If you did not initiate this override, contact <a href="mailto:security@prydeapp.com">security@prydeapp.com</a> immediately and revoke your admin escalation token.`,
      }),
    });

    if (error) {
      logOutbound(email, 'Pryde Security — Admin Override Verification', 'override_verification', null, false, error.message);
      return { success: false, error: error.message };
    }

    logOutbound(email, 'Pryde Security — Admin Override Verification', 'override_verification', data.id, true, null);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Error sending override verification email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send security alert to security@prydeapp.com after a successful override execution.
 */
export const sendOverrideSecurityNotification = async ({ actorName, actorEmail, action, targetUsername, ip, timestamp }) => {
  try {
    const resendClient = getResendClient();
    if (!resendClient) return { success: false, error: 'Email service not configured' };

    const actionLabel = {
      DEMOTE_SUPER_ADMIN: 'Demoted to Admin',
      RESET_ADMIN_PASSWORD: 'Password Reset Sent',
      LOCK_ADMIN_ACCOUNT: 'Account Locked (30 days)'
    }[action] || action;

    const formattedTime = new Date(timestamp).toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
    });

    const { data, error } = await resendClient.emails.send({
      from: EMAIL_SENDERS.SECURITY,
      to: 'security@prydeapp.com',
      replyTo: 'security@prydeapp.com',
      subject: '⚠️ Pryde Security Alert — Admin Override Executed',
      html: buildEmailTemplate({
        title: '⚠️ Admin Override Executed',
        body: `An emergency super admin override was successfully executed and verified.<br><br>
          <strong>Override Details:</strong><br>
          • <strong>Admin:</strong> ${actorName} (${actorEmail})<br>
          • <strong>Action:</strong> ${actionLabel}<br>
          • <strong>Target account:</strong> @${targetUsername}<br>
          • <strong>IP Address:</strong> ${ip}<br>
          • <strong>Time:</strong> ${formattedTime}<br><br>
          This action was verified with step-up authentication (6-digit code sent to the admin's email).<br><br>
          If this action was not expected, investigate immediately.`,
      }),
    });

    if (error) {
      logOutbound('security@prydeapp.com', '⚠️ Pryde Security Alert — Admin Override Executed', 'override_security_notification', null, false, error.message);
      return { success: false, error: error.message };
    }

    logOutbound('security@prydeapp.com', '⚠️ Pryde Security Alert — Admin Override Executed', 'override_security_notification', data.id, true, null);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Error sending override security notification:', error);
    return { success: false, error: error.message };
  }
};
