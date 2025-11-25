import nodemailer from 'nodemailer';
import config from '../config/config.js';

// Create transporter
const createTransporter = () => {
  // For development, use ethereal email (fake SMTP)
  // For production, use a real SMTP service like SendGrid, Gmail, etc.
  
  if (config.nodeEnv === 'production' && process.env.EMAIL_HOST) {
    return nodemailer.createTransporter({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }
  
  // For development/testing - logs to console
  return nodemailer.createTransporter({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER || 'test@example.com',
      pass: process.env.EMAIL_PASS || 'testpassword'
    }
  });
};

export const sendPasswordResetEmail = async (email, resetToken, username) => {
  try {
    const transporter = createTransporter();
    
    const resetUrl = `${config.frontendURL}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"Pryde Social" <noreply@prydeapp.com>',
      to: email,
      subject: 'Password Reset Request - Pryde Social',
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
            <h1 style="margin: 0;">✨ Pryde Social</h1>
            <p style="margin: 10px 0 0;">Password Reset Request</p>
          </div>
          
          <div class="content">
            <h2>Hi ${username},</h2>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            
            <a href="${resetUrl}" class="button">Reset Password</a>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #6C5CE7;">${resetUrl}</p>
            
            <p><strong>This link will expire in 1 hour.</strong></p>
            
            <p>If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>
            
            <p>Best regards,<br>The Pryde Social Team</p>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} Pryde Social. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </body>
        </html>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log('Password reset email sent:', info.messageId);
    
    // For development, log the preview URL
    if (config.nodeEnv !== 'production') {
      console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};

export default {
  sendPasswordResetEmail
};

