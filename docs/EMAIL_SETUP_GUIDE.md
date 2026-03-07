# Email Service Setup Guide

## Overview

Pryde Social includes an email notification service using Resend (resend.com). It already has full implementations for:
- Password reset emails
- Login alert emails
- Email verification
- Password change notifications
- Account recovery contact notifications
- Account deletion confirmations

## Configuration

The email service is already implemented in `server/utils/emailService.js` and uses the `RESEND_API_KEY` environment variable.

### Add to your `.env` file:

```
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

### Where to get your Resend API key:
1. Go to [resend.com](https://resend.com)
2. Sign in to your account
3. Go to **API Keys** in the dashboard
4. Copy your API key (starts with `re_`)

## Testing

Once configured with a valid Resend API key, emails will send automatically:

```
Password reset email sent: xxxxxxxx
Verification email sent: xxxxxxxx
```

## Current Email Features Working:
- ✅ Password Reset
- ✅ Login Alerts
- ✅ Suspicious Login Warnings
- ✅ Email Verification
- ✅ Password Changed Notification
- ✅ Recovery Contact Requests
- ✅ Account Deletion Confirmations
