/*
 * Centralized sender configuration for Pryde.
 *
 * Usage:
 *   EMAIL_SENDERS.SYSTEM    → email verification, password reset, account deletion, recovery
 *   EMAIL_SENDERS.SECURITY  → login alerts, suspicious activity, password changed
 *   EMAIL_SENDERS.SUPPORT   → user support responses
 *   EMAIL_SENDERS.LEGAL     → DMCA, subpoenas, copyright, law enforcement, legal requests
 *   EMAIL_SENDERS.NOTIFY    → platform notifications (comments, follows, mentions, digests)
 *
 * Note: admin@prydeapp.com is for internal use only and must never appear on public-facing pages.
 */

export const EMAIL_SENDERS = {
  SYSTEM:   'Pryde <noreply@prydeapp.com>',
  SECURITY: 'Pryde Security <security@prydeapp.com>',
  SUPPORT:  'Pryde Support <support@prydeapp.com>',
  LEGAL:    'Pryde Legal <legal@prydeapp.com>',
  NOTIFY:   'Pryde Notifications <notify@prydeapp.com>',
};
