import { Resend } from 'resend';
import config from '../config/config.js';

// Initialize Resend client (lazy initialization)
let resend = null;
const getResendClient = () => {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
};

// Email sender address
// Force correct format - ignore env var for now to debug
const FROM_EMAIL = 'Pryde Social <noreply@prydeapp.com>';

export const sendPasswordResetEmail = async (email, resetToken, username) => {
  try {
    const resendClient = getResendClient();

    if (!resendClient) {
      console.warn('Resend API key not configured. Email not sent.');
      return { success: false, error: 'Email service not configured' };
    }

    const resetUrl = `${config.frontendURL}/reset-password?token=${resetToken}`;

    const { data, error } = await resendClient.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Password Reset Request - Pryde Social',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <!--[if mso]>
          <style type="text/css">
            body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
          </style>
          <![endif]-->
        </head>
        <body style="margin: 0; padding: 0; background-color: #F7F7F7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #F7F7F7;">
            <tr>
              <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto;">

                  <!-- Header with Purple Gradient -->
                  <tr>
                    <td style="background-color: #6C5CE7; padding: 40px 30px; text-align: center;">
                      <h1 style="margin: 0; color: #FFFFFF; font-size: 28px; font-weight: 700;">✨ Pryde Social</h1>
                      <p style="margin: 10px 0 0; color: #EDEAFF; font-size: 16px;">Password Reset Request</p>
                    </td>
                  </tr>

                  <!-- Main Content -->
                  <tr>
                    <td style="background-color: #FFFFFF; padding: 40px 30px;">
                      <h2 style="margin: 0 0 20px 0; color: #2B2B2B; font-size: 22px; font-weight: 600;">Hi ${username},</h2>

                      <p style="margin: 0 0 20px 0; color: #2B2B2B; font-size: 16px; line-height: 1.6;">
                        We received a request to reset your password. Click the button below to create a new password:
                      </p>

                      <!-- Button -->
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;">
                        <tr>
                          <td style="background-color: #6C5CE7; text-align: center;">
                            <a href="${resetUrl}" style="display: inline-block; padding: 16px 40px; color: #FFFFFF; text-decoration: none; font-weight: 600; font-size: 16px;">Reset Password</a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin: 30px 0 10px 0; color: #616161; font-size: 14px;">
                        Or copy and paste this link into your browser:
                      </p>
                      <p style="margin: 0 0 30px 0; color: #6C5CE7; font-size: 14px; word-break: break-all;">
                        ${resetUrl}
                      </p>

                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 30px 0; background-color: #FFF3CD; border-left: 4px solid #FFC107;">
                        <tr>
                          <td style="padding: 15px;">
                            <p style="margin: 0; color: #856404; font-size: 14px; font-weight: 600;">
                              ⏰ This link will expire in 1 hour.
                            </p>
                          </td>
                        </tr>
                      </table>

                      <p style="margin: 0 0 20px 0; color: #2B2B2B; font-size: 16px; line-height: 1.6;">
                        If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
                      </p>

                      <p style="margin: 30px 0 0 0; color: #2B2B2B; font-size: 16px; line-height: 1.6;">
                        Best regards,<br>
                        <strong>The Pryde Social Team</strong>
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #F7F7F7; padding: 30px; text-align: center;">
                      <p style="margin: 0 0 10px 0; color: #616161; font-size: 12px;">
                        © ${new Date().getFullYear()} Pryde Social. All rights reserved.
                      </p>
                      <p style="margin: 0; color: #616161; font-size: 12px;">
                        This is an automated email. Please do not reply.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    });

    if (error) {
      console.error('Error sending password reset email:', error);
      throw new Error('Failed to send password reset email');
    }

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
      from: FROM_EMAIL,
      to: email,
      subject: '🔐 New Login to Your Pryde Social Account',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #2B2B2B;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background: linear-gradient(135deg, #6C5CE7 0%, #0984E3 100%);
              border-radius: 16px;
              padding: 40px;
              color: white;
            }
            .content {
              background: white;
              border-radius: 12px;
              padding: 30px;
              margin-top: 20px;
              color: #2B2B2B;
            }
            .info-box {
              background: #F7F7F7;
              border-left: 4px solid #6C5CE7;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #E0E0E0;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .label {
              font-weight: 600;
              color: #616161;
            }
            .value {
              color: #2B2B2B;
            }
            .button {
              display: inline-block;
              background: linear-gradient(135deg, #6C5CE7 0%, #0984E3 100%);
              color: white;
              padding: 14px 32px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              margin: 20px 0;
            }
            .warning {
              background: #FFF3CD;
              border-left: 4px solid #FFC107;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
              color: #856404;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              font-size: 12px;
              color: #616161;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 style="margin: 0;">🔐 Pryde Social Security</h1>
            <p style="margin: 10px 0 0;">New Login Detected</p>
          </div>

          <div class="content">
            <h2>Hi ${username},</h2>
            <p>We detected a new login to your Pryde Social account. Here are the details:</p>

            <div class="info-box">
              <div class="info-row">
                <span class="label">Date & Time:</span>
                <span class="value">${formattedDate}</span>
              </div>
              <div class="info-row">
                <span class="label">Device:</span>
                <span class="value">${deviceInfo || 'Unknown Device'}</span>
              </div>
              <div class="info-row">
                <span class="label">Browser:</span>
                <span class="value">${browser || 'Unknown'}</span>
              </div>
              <div class="info-row">
                <span class="label">Operating System:</span>
                <span class="value">${os || 'Unknown'}</span>
              </div>
              <div class="info-row">
                <span class="label">IP Address:</span>
                <span class="value">${ipAddress || 'Unknown'}</span>
              </div>
              ${location && location.city ? `
              <div class="info-row">
                <span class="label">Location:</span>
                <span class="value">${location.city}, ${location.region}, ${location.country}</span>
              </div>
              ` : ''}
            </div>

            <p><strong>Was this you?</strong></p>
            <p>If you recognize this login, you can safely ignore this email.</p>

            <div class="warning">
              <strong>⚠️ Didn't recognize this login?</strong><br>
              If this wasn't you, your account may be compromised. Please secure your account immediately:
              <ul>
                <li>Change your password</li>
                <li>Enable two-factor authentication (2FA)</li>
                <li>Review your active sessions and log out suspicious devices</li>
              </ul>
            </div>

            <a href="${config.frontendURL}/settings/security" class="button">Review Security Settings</a>

            <p>Best regards,<br>The Pryde Social Security Team</p>
          </div>

          <div class="footer">
            <p>© ${new Date().getFullYear()} Pryde Social. All rights reserved.</p>
            <p>This is an automated security alert. Please do not reply.</p>
          </div>
        </body>
        </html>
      `
    });

    if (error) {
      console.error('Error sending login alert email:', error);
      return { success: false, error: error.message };
    }

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
      from: FROM_EMAIL,
      to: email,
      subject: '⚠️ SUSPICIOUS LOGIN ATTEMPT - Pryde Social',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #2B2B2B;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background: linear-gradient(135deg, #DC3545 0%, #C82333 100%);
              border-radius: 16px;
              padding: 40px;
              color: white;
            }
            .content {
              background: white;
              border-radius: 12px;
              padding: 30px;
              margin-top: 20px;
              color: #2B2B2B;
            }
            .info-box {
              background: #F7F7F7;
              border-left: 4px solid #DC3545;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #E0E0E0;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .label {
              font-weight: 600;
              color: #616161;
            }
            .value {
              color: #2B2B2B;
            }
            .button {
              display: inline-block;
              background: linear-gradient(135deg, #DC3545 0%, #C82333 100%);
              color: white;
              padding: 14px 32px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              margin: 20px 0;
            }
            .alert {
              background: #F8D7DA;
              border-left: 4px solid #DC3545;
              padding: 20px;
              margin: 20px 0;
              border-radius: 4px;
              color: #721C24;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              font-size: 12px;
              color: #616161;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 style="margin: 0;">⚠️ Security Alert</h1>
            <p style="margin: 10px 0 0;">Suspicious Login Detected</p>
          </div>

          <div class="content">
            <h2>Hi ${username},</h2>

            <div class="alert">
              <strong>⚠️ SUSPICIOUS LOGIN DETECTED</strong><br>
              We detected a login from an unrecognized device or location. This login was allowed, but we recommend reviewing your account security.
            </div>

            <p>Login details:</p>

            <div class="info-box">
              <div class="info-row">
                <span class="label">Date & Time:</span>
                <span class="value">${formattedDate}</span>
              </div>
              <div class="info-row">
                <span class="label">Device:</span>
                <span class="value">${deviceInfo || 'Unknown Device'}</span>
              </div>
              <div class="info-row">
                <span class="label">Browser:</span>
                <span class="value">${browser || 'Unknown'}</span>
              </div>
              <div class="info-row">
                <span class="label">Operating System:</span>
                <span class="value">${os || 'Unknown'}</span>
              </div>
              <div class="info-row">
                <span class="label">IP Address:</span>
                <span class="value">${ipAddress || 'Unknown'}</span>
              </div>
              ${location && location.city ? `
              <div class="info-row">
                <span class="label">Location:</span>
                <span class="value">${location.city}, ${location.region}, ${location.country}</span>
              </div>
              ` : ''}
            </div>

            <p><strong>Was this you?</strong></p>
            <p>If you recognize this login, you can mark this device as trusted in your security settings.</p>

            <p><strong>If this wasn't you:</strong></p>
            <ul>
              <li><strong>Change your password immediately</strong></li>
              <li>Enable two-factor authentication (2FA)</li>
              <li>Log out all other sessions</li>
              <li>Review your account activity</li>
            </ul>

            <a href="${config.frontendURL}/settings/security" class="button">Secure My Account</a>

            <p>Best regards,<br>The Pryde Social Security Team</p>
          </div>

          <div class="footer">
            <p>© ${new Date().getFullYear()} Pryde Social. All rights reserved.</p>
            <p>This is an automated security alert. Please do not reply.</p>
          </div>
        </body>
        </html>
      `
    });

    if (error) {
      console.error('Error sending suspicious login email:', error);
      return { success: false, error: error.message };
    }

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
      from: FROM_EMAIL,
      to: email,
      subject: 'Verify Your Email - Pryde Social',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #F7F7F7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #F7F7F7;">
            <tr>
              <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #6C5CE7 0%, #0984E3 100%); border-radius: 16px; overflow: hidden;">
                  <tr>
                    <td style="padding: 40px; text-align: center;">
                      <h1 style="margin: 0; color: #FFFFFF; font-size: 32px; font-weight: 700;">Welcome to Pryde! 🌈</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color: #FFFFFF; padding: 40px;">
                      <p style="margin: 0 0 20px; color: #2B2B2B; font-size: 16px; line-height: 1.6;">Hi ${username},</p>

                      <p style="margin: 0 0 20px; color: #2B2B2B; font-size: 16px; line-height: 1.6;">
                        Thank you for joining Pryde Social! We're excited to have you in our LGBTQ+ community. 💜
                      </p>

                      <p style="margin: 0 0 30px; color: #2B2B2B; font-size: 16px; line-height: 1.6;">
                        To complete your registration and start connecting with others, please verify your email address by clicking the button below:
                      </p>

                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                          <td style="text-align: center; padding: 20px 0;">
                            <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #6C5CE7 0%, #0984E3 100%); color: #FFFFFF; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                              Verify Email Address
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin: 30px 0 20px; color: #616161; font-size: 14px; line-height: 1.6;">
                        Or copy and paste this link into your browser:
                      </p>
                      <p style="margin: 0 0 30px; color: #0984E3; font-size: 14px; word-break: break-all;">
                        ${verificationUrl}
                      </p>

                      <div style="background-color: #FFF3CD; border-left: 4px solid #FFC107; padding: 15px; margin: 30px 0; border-radius: 4px;">
                        <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.6;">
                          <strong>⏰ This link will expire in 24 hours.</strong><br>
                          If you didn't create an account with Pryde Social, you can safely ignore this email.
                        </p>
                      </div>

                      <p style="margin: 30px 0 0; color: #2B2B2B; font-size: 16px; line-height: 1.6;">
                        Best regards,<br>
                        The Pryde Social Team
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color: #F7F7F7; padding: 30px; text-align: center;">
                      <p style="margin: 0 0 10px; color: #616161; font-size: 12px;">
                        © ${new Date().getFullYear()} Pryde Social. All rights reserved.
                      </p>
                      <p style="margin: 0; color: #616161; font-size: 12px;">
                        This is an automated email. Please do not reply.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    });

    if (error) {
      console.error('Error sending verification email:', error);
      return { success: false, error: error.message };
    }

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
      from: FROM_EMAIL,
      to: email,
      subject: '🔐 Your Password Has Been Changed - Pryde Social',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #F7F7F7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #F7F7F7;">
            <tr>
              <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #10B981 0%, #059669 100%); border-radius: 16px; overflow: hidden;">
                  <tr>
                    <td style="padding: 40px; text-align: center;">
                      <h1 style="margin: 0; color: #FFFFFF; font-size: 32px; font-weight: 700;">Password Changed ✅</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color: #FFFFFF; padding: 40px;">
                      <p style="margin: 0 0 20px; color: #2B2B2B; font-size: 16px; line-height: 1.6;">Hi ${username},</p>

                      <p style="margin: 0 0 20px; color: #2B2B2B; font-size: 16px; line-height: 1.6;">
                        This is a confirmation that your Pryde Social account password was successfully changed.
                      </p>

                      <div style="background-color: #D1FAE5; border-left: 4px solid #10B981; padding: 15px; margin: 30px 0; border-radius: 4px;">
                        <p style="margin: 0; color: #065F46; font-size: 14px; line-height: 1.6;">
                          <strong>✅ Password Changed Successfully</strong><br>
                          Your password was changed at ${new Date().toLocaleString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZoneName: 'short'
                          })}
                        </p>
                      </div>

                      <div style="background-color: #FEE2E2; border-left: 4px solid #DC2626; padding: 15px; margin: 30px 0; border-radius: 4px;">
                        <p style="margin: 0; color: #991B1B; font-size: 14px; line-height: 1.6;">
                          <strong>⚠️ Didn't change your password?</strong><br>
                          If you did not make this change, your account may be compromised. Please:
                        </p>
                        <ul style="margin: 10px 0 0 20px; color: #991B1B; font-size: 14px;">
                          <li>Reset your password immediately</li>
                          <li>Enable two-factor authentication (2FA)</li>
                          <li>Review your active sessions</li>
                          <li>Contact our support team</li>
                        </ul>
                      </div>

                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                          <td style="text-align: center; padding: 20px 0;">
                            <a href="${config.frontendURL}/settings/security" style="display: inline-block; background: linear-gradient(135deg, #6C5CE7 0%, #0984E3 100%); color: #FFFFFF; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                              Review Security Settings
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin: 30px 0 0; color: #2B2B2B; font-size: 16px; line-height: 1.6;">
                        Best regards,<br>
                        The Pryde Social Security Team
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color: #F7F7F7; padding: 30px; text-align: center;">
                      <p style="margin: 0 0 10px; color: #616161; font-size: 12px;">
                        © ${new Date().getFullYear()} Pryde Social. All rights reserved.
                      </p>
                      <p style="margin: 0; color: #616161; font-size: 12px;">
                        This is an automated security notification. Please do not reply.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    });

    if (error) {
      console.error('Error sending password changed email:', error);
      return { success: false, error: error.message };
    }

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
      from: FROM_EMAIL,
      to: contactEmail,
      subject: `🔐 Account Recovery Request for ${requesterUsername} - Pryde Social`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #F7F7F7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #F7F7F7;">
            <tr>
              <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto;">

                  <!-- Header with Orange/Warning Gradient -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #FF9800 0%, #F57C00 100%); border-radius: 16px 16px 0 0; padding: 40px 30px; text-align: center;">
                      <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        🔐 Account Recovery Request
                      </h1>
                      <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.95); font-size: 16px;">
                        Your help is needed to recover an account
                      </p>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="background: white; padding: 40px 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

                      <p style="margin: 0 0 20px 0; color: #2B2B2B; font-size: 16px; line-height: 1.6;">
                        Hi <strong>${contactUsername}</strong>,
                      </p>

                      <p style="margin: 0 0 20px 0; color: #2B2B2B; font-size: 16px; line-height: 1.6;">
                        <strong>${requesterUsername}</strong> has requested to recover their Pryde Social account, and you are listed as one of their trusted recovery contacts.
                      </p>

                      <!-- Info Box -->
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 30px 0;">
                        <tr>
                          <td style="background: #FFF3E0; border-left: 4px solid #FF9800; padding: 20px; border-radius: 8px;">
                            <p style="margin: 0 0 10px 0; color: #2B2B2B; font-size: 14px; font-weight: 600;">
                              📋 Recovery Request Details
                            </p>
                            <p style="margin: 5px 0; color: #555; font-size: 14px;">
                              <strong>Requested by:</strong> ${requesterUsername}
                            </p>
                            <p style="margin: 5px 0; color: #555; font-size: 14px;">
                              <strong>Request time:</strong> ${new Date().toLocaleString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                timeZoneName: 'short'
                              })}
                            </p>
                            <p style="margin: 5px 0; color: #555; font-size: 14px;">
                              <strong>Expires:</strong> ${expirationDate}
                            </p>
                            <p style="margin: 5px 0; color: #555; font-size: 14px;">
                              <strong>Time remaining:</strong> 24 hours
                            </p>
                          </td>
                        </tr>
                      </table>

                      <p style="margin: 0 0 20px 0; color: #2B2B2B; font-size: 16px; line-height: 1.6;">
                        To help them recover their account, please review and approve this request. At least 2 trusted contacts must approve before the account can be recovered.
                      </p>

                      <!-- Action Buttons -->
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 30px 0;">
                        <tr>
                          <td align="center">
                            <a href="${approveUrl}" style="display: inline-block; background: linear-gradient(135deg, #6C5CE7 0%, #0984E3 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(108, 92, 231, 0.3); transition: all 0.3s;">
                              ✓ Review Recovery Request
                            </a>
                          </td>
                        </tr>
                      </table>

                      <!-- Warning Box -->
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 30px 0;">
                        <tr>
                          <td style="background: #FFEBEE; border-left: 4px solid #F44336; padding: 20px; border-radius: 8px;">
                            <p style="margin: 0 0 10px 0; color: #2B2B2B; font-size: 14px; font-weight: 600;">
                              ⚠️ Important Security Notice
                            </p>
                            <p style="margin: 5px 0; color: #555; font-size: 14px; line-height: 1.6;">
                              • Only approve this request if you personally know <strong>${requesterUsername}</strong> and can verify their identity
                            </p>
                            <p style="margin: 5px 0; color: #555; font-size: 14px; line-height: 1.6;">
                              • If you did not expect this request or suspect fraud, please ignore this email
                            </p>
                            <p style="margin: 5px 0; color: #555; font-size: 14px; line-height: 1.6;">
                              • This request will automatically expire in 24 hours
                            </p>
                            <p style="margin: 5px 0; color: #555; font-size: 14px; line-height: 1.6;">
                              • Contact us immediately if you believe this is a security threat
                            </p>
                          </td>
                        </tr>
                      </table>

                      <p style="margin: 20px 0 0 0; color: #777; font-size: 14px; line-height: 1.6;">
                        If you cannot click the button above, copy and paste this link into your browser:
                      </p>
                      <p style="margin: 10px 0 0 0; color: #6C5CE7; font-size: 13px; word-break: break-all;">
                        ${approveUrl}
                      </p>

                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 20px; text-align: center;">
                      <p style="margin: 0 0 10px 0; color: #999; font-size: 14px;">
                        This is an automated security notification from Pryde Social
                      </p>
                      <p style="margin: 0; color: #999; font-size: 12px;">
                        © ${new Date().getFullYear()} Pryde Social. All rights reserved.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    });

    if (error) {
      console.error('Error sending recovery contact notification email:', error);
      return { success: false, error: error.message };
    }

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
      from: FROM_EMAIL,
      to: email,
      subject: '⚠️ Account Deletion Request - Pryde Social',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #F7F7F7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #F7F7F7;">
            <tr>
              <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #DC3545 0%, #C82333 100%); border-radius: 16px; overflow: hidden;">
                  <tr>
                    <td style="padding: 40px; text-align: center;">
                      <h1 style="margin: 0; color: #FFFFFF; font-size: 32px; font-weight: 700;">⚠️ Account Deletion</h1>
                      <p style="margin: 10px 0 0; color: rgba(255,255,255,0.95); font-size: 16px;">Please confirm your request</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color: #FFFFFF; padding: 40px;">
                      <p style="margin: 0 0 20px; color: #2B2B2B; font-size: 16px; line-height: 1.6;">Hi ${username},</p>

                      <p style="margin: 0 0 20px; color: #2B2B2B; font-size: 16px; line-height: 1.6;">
                        We received a request to permanently delete your Pryde Social account. This action cannot be undone.
                      </p>

                      <div style="background-color: #FFF3CD; border-left: 4px solid #FFC107; padding: 20px; margin: 30px 0; border-radius: 4px;">
                        <p style="margin: 0 0 10px 0; color: #856404; font-size: 14px; font-weight: 600;">
                          ⚠️ Important: Account Deletion Consequences
                        </p>
                        <ul style="margin: 10px 0 0 20px; color: #856404; font-size: 14px; line-height: 1.6;">
                          <li>Your profile and all posts will be permanently removed</li>
                          <li>You will lose access to all your data</li>
                          <li>This action cannot be reversed</li>
                          <li>You have 30 days to recover your account after deletion</li>
                        </ul>
                      </div>

                      <div style="background-color: #D1FAE5; border-left: 4px solid #10B981; padding: 20px; margin: 30px 0; border-radius: 4px;">
                        <p style="margin: 0 0 10px 0; color: #065F46; font-size: 14px; font-weight: 600;">
                          🔄 Changed Your Mind?
                        </p>
                        <p style="margin: 0; color: #065F46; font-size: 14px; line-height: 1.6;">
                          If this was a mistake, simply log back in using your existing credentials to cancel deletion and restore your account.
                        </p>
                      </div>

                      <p style="margin: 0 0 30px; color: #2B2B2B; font-size: 16px; line-height: 1.6;">
                        If you want to proceed with deleting your account, click the button below to confirm:
                      </p>

                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                          <td style="text-align: center; padding: 20px 0;">
                            <a href="${deletionUrl}" style="display: inline-block; background: linear-gradient(135deg, #DC3545 0%, #C82333 100%); color: #FFFFFF; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                              Confirm Account Deletion
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin: 30px 0 20px; color: #616161; font-size: 14px; line-height: 1.6;">
                        Or copy and paste this link into your browser:
                      </p>
                      <p style="margin: 0 0 30px; color: #DC3545; font-size: 14px; word-break: break-all;">
                        ${deletionUrl}
                      </p>

                      <div style="background-color: #D1FAE5; border-left: 4px solid #10B981; padding: 15px; margin: 30px 0; border-radius: 4px;">
                        <p style="margin: 0; color: #065F46; font-size: 14px; line-height: 1.6;">
                          <strong>Changed your mind?</strong><br>
                          If you didn't request this deletion, you can safely ignore this email. Your account will remain active.
                        </p>
                      </div>

                      <p style="margin: 30px 0 0; color: #2B2B2B; font-size: 16px; line-height: 1.6;">
                        Best regards,<br>
                        The Pryde Social Team
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color: #F7F7F7; padding: 30px; text-align: center;">
                      <p style="margin: 0 0 10px; color: #616161; font-size: 12px;">
                        © ${new Date().getFullYear()} Pryde Social. All rights reserved.
                      </p>
                      <p style="margin: 0; color: #616161; font-size: 12px;">
                        This is an automated email. Please do not reply.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    });

    if (error) {
      console.error('Error sending account deletion email:', error);
      return { success: false, error: error.message };
    }

    console.log('Account deletion email sent:', data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('Error sending account deletion email:', error);
    return { success: false, error: error.message };
  }
};

export default {
  sendPasswordResetEmail,
  sendLoginAlertEmail,
  sendSuspiciousLoginEmail,
  sendVerificationEmail,
  sendPasswordChangedEmail,
  sendRecoveryContactNotificationEmail,
  sendAccountDeletionEmail
};

