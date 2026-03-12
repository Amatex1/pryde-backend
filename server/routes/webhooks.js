import express from 'express';
import crypto from 'crypto';
import config from '../config/config.js';
import InboundEmail from '../models/InboundEmail.js';
import logger from '../utils/logger.js';

const router = express.Router();

// @route   POST /api/webhooks/resend/inbound
// @desc    Resend inbound email webhook (noreply@ & support@prydeapp.com)
// @access  Public (webhook signature verified)
router.post('/resend/inbound', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['resend-signature'];
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    // Verify webhook signature (security)
    if (webhookSecret && signature) {
      const expectedSignature = 'v1=' + crypto
        .createHmac('sha256', webhookSecret)
        .update(req.body)
        .digest('hex');

      if (signature !== expectedSignature) {
        logger.warn('Invalid Resend webhook signature', { signature, expectedSignature: signature.substring(0, 20) + '...' });
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const emailData = JSON.parse(req.body.toString());

    // Validate required fields & target addresses
    const noreplyAddr = 'noreply@prydeapp.com';
    const supportAddr = 'support@prydeapp.com';
    
    if (!emailData.to || !Array.isArray(emailData.to)) {
      return res.status(400).json({ error: 'Missing or invalid "to" recipients' });
    }

    const isNoreply = emailData.to.some(to => to.includes(noreplyAddr));
    const isSupport = emailData.to.some(to => to.includes(supportAddr));

    if (!isNoreply && !isSupport) {
      // Ignore emails not sent to our addresses
      logger.debug('Webhook ignored - not for our addresses', { to: emailData.to });
      return res.status(200).json({ ignored: true });
    }

    // Determine mailbox
    const mailbox = isNoreply ? 'noreply' : 'support';

    // Parse sender
    const senderMatch = emailData.from.match(/^(.*?)\\s*<(.+?)>$/) || [null, null, emailData.from];
    const sender = {
      name: senderMatch[1]?.trim() || null,
      email: senderMatch[2] || emailData.from
    };

    // Process attachments (limit size, upload to R2 if large)
    const attachments = emailData.attachments?.map(att => ({
      filename: att.filename,
      contentType: att.content_type,
      size: att.size,
      contentId: att.content_id,
      raw: att.content ? Buffer.from(att.content, 'base64') : null
    })) || [];

    // Normalize recipients
    const recipients = emailData.to.map(to => {
      const match = to.match(/^(.*?)\\s*<(.+?)>$/) || [null, null, to];
      return {
        name: match[1]?.trim() || null,
        email: match[2] || to
      };
    });

    // Create normalized email document
    const inboundEmail = new InboundEmail({
      rawWebhook: {
        id: emailData.id,
        from: emailData.from,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
        createdAt: emailData.created_at ? new Date(emailData.created_at) : new Date(),
        headers: emailData.headers
      },
      sender,
      recipients,
      subject: emailData.subject,
      bodyHtml: emailData.html,
      bodyText: emailData.text,
      headers: {
        messageId: emailData.headers?.['message-id'],
        date: emailData.created_at ? new Date(emailData.created_at) : new Date(),
        userAgent: emailData.headers?.['user-agent'],
        xMailer: emailData.headers?.['x-mailer']
      },
      attachments,
      mailbox
    });

    await inboundEmail.save();

    logger.info(`Inbound email saved: ${sender.email} -> ${mailbox} (${inboundEmail._id})`, {
      sender: sender.email,
      subject: emailData.subject?.substring(0, 100),
      attachments: attachments.length
    });

    res.status(200).json({ 
      success: true, 
      id: inboundEmail._id,
      message: 'Email received and stored' 
    });

  } catch (error) {
    logger.error('Resend webhook error:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

